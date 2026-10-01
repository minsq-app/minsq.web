const express = require('express');
const { createProxyMiddleware } = require('http-proxy-middleware');
const path = require('path');

const helmet = require('helmet');

const app = express();

// Trust proxy for rate limit headers (Vercel/NGINX)
app.set('trust proxy', process.env.TRUST_PROXY || 1);

// Apply helmet with relaxed CSP for the CDN assets we still use
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'", "https://cdnjs.cloudflare.com", "https://cdn.jsdelivr.net"],
      scriptSrcAttr: ["'unsafe-inline'"],
      styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com", "https://cdnjs.cloudflare.com"],
      fontSrc: ["'self'", "https://fonts.gstatic.com", "https://cdnjs.cloudflare.com"],
      imgSrc: ["'self'", "data:", "https://*"],
      connectSrc: ["'self'", "http://localhost:*", "https://*"]
    }
  }
}));

// Proxy /api requests to the backend
const apiTarget = process.env.API_URL || 'http://localhost:3001';

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

// Fallback for SPA
app.use((req, res, next) => {
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

