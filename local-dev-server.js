const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');

const root = __dirname;
const port = Number(process.env.PORT || 3000);

loadEnv('.env');
loadEnv('.env.local');

const apiRoutes = {
  '/api/admin': './api/admin',
  '/api/public': './api/public',
  '/api/apply': './api/apply',
  '/api/partner': './api/partner',
  '/api/contact': './api/contact',
  '/api/robots': './api/robots',
  '/api/llms': './api/llms',
  '/robots.txt': './api/robots',
  '/llms.txt': './api/llms',
  '/api/sitemap': './api/sitemap',
  '/sitemap.xml': './api/sitemap',
  '/api/markdown': './api/markdown',
};

// Mirrors vercel.json redirects and middleware.js so local runs match production routing.
const redirects = {
  '/process-automation-2': '/process-automation',
  '/smart-data-logger-2': '/smart-data-logger',
};

// middleware.js is an ES module with no imports; load it the same way the tests do.
const middleware = import(`data:text/javascript;base64,${fs.readFileSync(path.join(__dirname, 'middleware.js')).toString('base64')}`);

const rewrites = {
  '/admin': '/admin/index.html',
  '/blog': '/blog.html',
  '/': '/index.html',
};

const types = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
};

function loadEnv(file) {
  const fullPath = path.join(root, file);
  if (!fs.existsSync(fullPath)) return;
  const lines = fs.readFileSync(fullPath, 'utf8').split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#') || !trimmed.includes('=')) continue;
    const index = trimmed.indexOf('=');
    const key = trimmed.slice(0, index).trim();
    const value = trimmed.slice(index + 1).trim().replace(/^["']|["']$/g, '');
    if (!process.env[key]) process.env[key] = value;
  }
}

function safePath(urlPath) {
  const decoded = decodeURIComponent(urlPath);
  const relative = decoded.replace(/^\/+/, '');
  const fullPath = path.resolve(root, relative);
  if (!fullPath.startsWith(root)) return null;
  return fullPath;
}

async function handleApi(route, req, res, parsedUrl) {
  req.query = Object.fromEntries(parsedUrl.searchParams.entries());
  try {
    const handler = require(apiRoutes[route]);
    await handler(req, res);
  } catch (error) {
    if (!res.headersSent) {
      res.statusCode = 500;
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
    }
    res.end(JSON.stringify({ error: error.message }));
  }
}

function serveStatic(req, res, parsedUrl) {
  const pathname = rewrites[parsedUrl.pathname] || parsedUrl.pathname;
  let fullPath = safePath(pathname);
  if (fullPath && !fs.existsSync(fullPath) && fs.existsSync(fullPath + ".html")) {
    fullPath = fullPath + ".html";
  }
  if (!fullPath || !fs.existsSync(fullPath) || fs.statSync(fullPath).isDirectory()) {
    res.statusCode = 404;
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    fs.createReadStream(path.join(root, '404.html')).pipe(res);
    return;
  }

  res.statusCode = 200;
  if (fullPath.endsWith('.html')) res.setHeader('Vary', 'Accept');
  res.setHeader('Content-Type', types[path.extname(fullPath).toLowerCase()] || 'application/octet-stream');
  fs.createReadStream(fullPath).pipe(res);
}

const server = http.createServer(async (req, res) => {
  const parsedUrl = new URL(req.url, `http://${req.headers.host || `localhost:${port}`}`);
  if (redirects[parsedUrl.pathname]) {
    res.writeHead(308, { Location: redirects[parsedUrl.pathname] });
    res.end();
    return;
  }
  const { default: negotiate, config } = await middleware;
  const matched = config.matcher.some((pattern) => new RegExp(`^${pattern}$`).test(parsedUrl.pathname));
  const rewrite = matched && negotiate({ url: parsedUrl.href, headers: { get: (name) => req.headers[name.toLowerCase()] } });
  if (rewrite) {
    const target = new URL(rewrite.headers.get('x-middleware-rewrite'));
    handleApi(target.pathname, req, res, target);
    return;
  }
  const apiRoute = apiRoutes[parsedUrl.pathname] ? parsedUrl.pathname : null;
  if (apiRoute) {
    handleApi(apiRoute, req, res, parsedUrl);
    return;
  }
  serveStatic(req, res, parsedUrl);
});

server.listen(port, () => {
  console.log(`ACS local admin/site running at http://localhost:${port}`);
  console.log(`Admin panel: http://localhost:${port}/admin`);
});
