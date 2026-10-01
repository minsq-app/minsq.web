const express = require('express');
const { createProxyMiddleware } = require('http-proxy-middleware');
const path = require('path');

const helmet = require('helmet');

const app = express();

// Trust proxy for rate limit headers (Vercel/NGINX)
app.set('trust proxy', process.env.TRUST_PROXY || 1);

// Proxy /api requests to the backend
const apiTarget = process.env.API_URL || 'http://localhost:3001';

// Permissões de conexão estritas (evita exfiltração de dados via XSS)
const connectSrc = [
  "'self'",
  "http://localhost:*",
  "http://127.0.0.1:*",
  "https://challenges.cloudflare.com"
];
if (process.env.API_URL && !connectSrc.includes(process.env.API_URL)) {
  connectSrc.push(process.env.API_URL);
}

// Apply helmet with hardened CSP for the CDN assets and Turnstile we use
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: [
        "'self'",
        "'unsafe-inline'",
        "'unsafe-eval'",
        "https://cdnjs.cloudflare.com",
        "https://cdn.jsdelivr.net",
        "https://challenges.cloudflare.com"
      ],
      scriptSrcAttr: ["'unsafe-inline'"],
      styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com", "https://cdnjs.cloudflare.com"],
      fontSrc: ["'self'", "https://fonts.gstatic.com", "https://cdnjs.cloudflare.com"],
      imgSrc: ["'self'", "data:", "https://*"],
      mediaSrc: ["'self'", "data:", "blob:", "https://*"],
      connectSrc: connectSrc,
      frameSrc: ["'self'", "https://challenges.cloudflare.com"]
    }
  }
}));

app.use('/api', createProxyMiddleware({
  target: apiTarget,
  changeOrigin: true,
  xfwd: true,
  timeout: 30000,
  proxyTimeout: 30000,
  pathRewrite: function (path, req) {
    return '/api' + path;
  },
  onError: (err, req, res) => {
    console.error('[Proxy Error]', err.message);
    if (!res.headersSent) {
      res.status(502).json({ success: false, error: 'Gateway unavailable or backend timed out' });
    }
  }
}));

// Serve specific public folders
app.use('/pages', express.static(path.join(__dirname, 'pages')));
app.use('/assets', express.static(path.join(__dirname, 'assets')));
app.use('/assets', express.static(path.join(__dirname, 'pages', 'web', 'assets')));

// Route and Subdomain resolution (replicates vercel.json rewrites)
app.use((req, res, next) => {
  const host = (req.hostname || req.headers.host || '').toLowerCase();
  const isWebHost = host.startsWith('web.') || host.startsWith('web-') || host === 'web.mohi.com.br';
  const isStatusHost = host.startsWith('status.') || host.startsWith('status-') || host === 'status.mohi.com.br';
  const isMaintHost = host.startsWith('maintenance.') || host.startsWith('maintenance-') || host === 'maintenance.mohi.com.br';

  if (isWebHost || req.path === '/web') {
    if (req.path === '/' || req.path === '/web' || !req.path.includes('.')) {
      return res.sendFile(path.join(__dirname, 'pages', 'web', 'index.html'));
    }
  }

  if (isStatusHost || req.path === '/status') {
    if (req.path === '/' || req.path === '/status' || !req.path.includes('.')) {
      return res.sendFile(path.join(__dirname, 'pages', 'api', 'status.html'));
    }
  }

  if (isMaintHost || req.path === '/maintenance') {
    if (req.path === '/' || req.path === '/maintenance' || !req.path.includes('.')) {
      return res.sendFile(path.join(__dirname, 'pages', 'api', 'maintenance.html'));
    }
  }

  // Fallback for SPA
  if (req.path === '/' || req.path === '/index.html' || !req.path.includes('.')) {
    return res.sendFile(path.join(__dirname, 'index.html'));
  }
  res.status(404).send('Not Found');
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`[Frontend] Server running at http://localhost:${PORT}`);
  console.log(`[Frontend] Proxying /api to ${apiTarget}`);
});

