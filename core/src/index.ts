import 'dotenv/config';
import express, { Request, Response, NextFunction, Router } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import path from 'path';
import rateLimit from 'express-rate-limit';
import { maintenanceMiddleware, initializeMaintenanceMode } from './middlewares/maintenance.middleware';
import cookieParser from 'cookie-parser';
import passport from './config/passport';
import { isDev } from './config/env';

// Load environment variables immediately is now handled by import 'dotenv/config'
const app = express();

const PORT = process.env.PORT || 3001;



// Helmet Security Headers (Configurado para APIs JSON, liberando CORS)
app.use(helmet({
  crossOriginResourcePolicy: false,
  crossOriginOpenerPolicy: false,
}));

// Configuração segura de CORS
if (!isDev && !process.env.CORS_ORIGIN) {
  console.error('FATAL ERROR: CORS_ORIGIN is not defined in the environment.');
  process.exit(1);
}

const allowedOrigins = process.env.CORS_ORIGIN 
  ? process.env.CORS_ORIGIN.split(',').map(o => o.trim())
  : ['http://localhost:3000', 'http://127.0.0.1:3000'];

if (!isDev && allowedOrigins.includes('*')) {
  console.error('FATAL ERROR: CORS wildcard (*) is not allowed in production with credentials.');
  process.exit(1);
}

const localNet = /^http:\/\/(localhost|127\.0\.0\.1|192\.168\.\d{1,3}\.\d{1,3}|10\.\d{1,3}\.\d{1,3}\.\d{1,3})(:\d+)?$/;

app.use(cors({
  origin: function (origin, callback) {
    const okLocal = isDev && origin && localNet.test(origin);
    
    if (!origin || allowedOrigins.includes('*') || allowedOrigins.includes(origin) || okLocal) {
      callback(null, true);
    } else {
      console.warn(`[CORS] Origem bloqueada: ${origin}`);
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true
}));
import { apiLimiter, apiExplorerLimiter } from './middlewares/rateLimit.middleware';

// Apply rate limiter before reading payloads to prevent memory exhaustion attacks
app.use('/api', apiLimiter);

// Specific routes that genuinely need large JSON payloads (base64 icons, nodes, etc)
app.use('/api/study', express.json({ limit: '3mb' }));
app.use('/api/mindmaps', express.json({ limit: '3mb' }));

app.use('/api/auth', express.json({ limit: '10kb' }));
app.use(express.json({ limit: '100kb' }));
app.use(express.urlencoded({ limit: '100kb', extended: true }));
app.use(cookieParser());

app.use(passport.initialize());

if (!isDev && !process.env.TRUST_PROXY) {
  console.error('FATAL ERROR: TRUST_PROXY is not defined in production. Proxy spoofing vulnerability.');
  process.exit(1);
}

// TRUST_PROXY = número de proxies na frente do core (ex.: 1 = só o server.js; 2 = Vercel + server.js),
// ou uma lista de IPs/sub-redes confiáveis (ex.: "loopback, 10.0.0.0/8").
// Valor inválido derruba o processo em produção: antes era ignorado em silêncio e o req.ip ficava errado.
// `true` é proibido: confiaria em qualquer X-Forwarded-For e deixaria o IP (e os rate limits) falsificável.
if (process.env.TRUST_PROXY) {
  const raw = process.env.TRUST_PROXY.trim();
  if (/^\d+$/.test(raw) && parseInt(raw, 10) > 0) {
    app.set('trust proxy', parseInt(raw, 10));
  } else if (raw.toLowerCase() === 'true' || raw === '0' || raw.toLowerCase() === 'false' || raw === '') {
    console.error(`FATAL ERROR: TRUST_PROXY="${raw}" inválido. Use o número de proxies (ex.: 1 ou 2) ou uma lista de IPs/sub-redes.`);
    if (!isDev) process.exit(1);
  } else {
    app.set('trust proxy', raw); // lista de IPs/sub-redes/aliases do Express (loopback, linklocal, uniquelocal)
  }
}

// O authLimiter global foi removido. Os limitadores granulares
// são aplicados individualmente em src/routes/auth.routes.ts

// In-memory cache to store loaded routers so we don't import them on every single request
const routerCache: Record<string, Router> = {};
const failedModulesCache = new Set<string>(); // Cache negativo para prevenir Disk I/O Exhaustion

// Gateway for lazy-loaded routes
// Any request to /api/auth/login or /api/goals/list will hit this route
app.use('/api/:module', maintenanceMiddleware as any, async (req: Request, res: Response, next: NextFunction) => {
  const { module } = req.params;

  // Security: prevent directory traversal
  if (!/^[a-zA-Z0-9_-]+$/.test(module)) {
    return res.status(400).json({ error: 'Invalid module name' });
  }

  // Prevenir Disk I/O exhaustion de API Explorers
  if (failedModulesCache.has(module)) {
    return apiExplorerLimiter(req, res, () => res.status(404).json({ error: 'Endpoint não encontrado.' }));
  }

  try {
    // Load module router dynamically if not already cached
    if (!routerCache[module]) {
      const routeFilePath = path.join(__dirname, 'routes', `${module}.routes`);
      console.log(`[LazyLoader] Importing module [${module}] into memory...`);
      
      const routerModule = await import(routeFilePath);
      routerCache[module] = routerModule.default || routerModule;
    }

    // Forward the request to the dynamically imported router
    console.log(`[LazyLoader] Dispatching ${req.method} ${req.url} to module [${module}]`);
    routerCache[module](req, res, next);
  } catch (err: any) {
    console.error(`[LazyLoader] Error loading module [${module}]:`, err.message);
    failedModulesCache.add(module);
    
    // Penalizar e retornar 404
    apiExplorerLimiter(req, res, () => res.status(404).json({ error: `Module '${module}' not found or failed to load.` }));
  }
});

// Diagnóstico de TRUST_PROXY. Desligado por padrão: ligue com ENABLE_IP_TEST=true só pra conferir
// se req.ip é o IP real do cliente, e desligue de novo.
if (isDev || process.env.ENABLE_IP_TEST === 'true') {
  app.get('/api/ip-test', (req: Request, res: Response) => {
    res.json({
      ip: req.ip,
      ips: req.ips,
      xff: req.headers['x-forwarded-for']
    });
  });
}

// Root route to check api status
app.get('/', (req: Request, res: Response) => {
  res.json({
    status: 'online',
    service: 'minsq Core Service',
    loadedModulesCount: Object.keys(routerCache).length,
    loadedModules: Object.keys(routerCache)
  });
});

// Fallback catch-all para rotas não encontradas da API (Honeypot global para exploradores)
app.use('*', apiExplorerLimiter, (req: Request, res: Response) => {
  res.status(404).json({ error: 'Endpoint não encontrado.' });
});

// Global Error Handler
app.use((err: any, req: Request, res: Response, next: NextFunction) => {
  // Erros do cliente (body grande, JSON malformado, CORS) mantêm o status 4xx em vez de virar 500.
  const status: number = err?.status || err?.statusCode;
  if (err?.message === 'Not allowed by CORS') {
    return res.status(403).json({ error: 'Origem não permitida.' });
  }
  if (Number.isInteger(status) && status >= 400 && status < 500) {
    const msg = status === 413 ? 'Requisição grande demais.' : status === 400 ? 'Requisição inválida.' : 'Requisição recusada.';
    return res.status(status).json({ error: msg });
  }
  console.error('[Global Error]', err);
  if (!isDev) {
    res.status(500).json({ error: 'Erro interno no servidor.' });
  } else {
    res.status(500).json({ error: 'Erro interno no servidor.', details: err.message, stack: err.stack });
  }
});

import { initializeAdminSettings } from './config/adminSettings';

app.listen(PORT, async () => {
  console.log(`[minsq Core] Dynamic gateway running on http://localhost:${PORT}`);
  // Initialize maintenance mode state from DB
  await initializeMaintenanceMode();
  await initializeAdminSettings();
});
