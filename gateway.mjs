import http from 'http';
import https from 'https';
import { spawn } from 'child_process';
import { URL } from 'url';

const PUBLIC_PORT = parseInt(process.env.PORT || '8100', 10);
const ROUTER_PORT = 8101;

// 1. Spawn 9router on internal port 8101
const routerEnv = {
  ...process.env,
  PORT: String(ROUTER_PORT),
  HOSTNAME: '127.0.0.1',
  INITIAL_PASSWORD: 'default'
};

let routerProcess = null;
try {
  routerProcess = spawn(
    '/usr/bin/node',
    ['server.js'],
    {
      cwd: '/home/ersaz/app/node_modules/9router/app',
      env: routerEnv,
      stdio: 'inherit'
    }
  );

  routerProcess.on('exit', (code, signal) => {
    console.log(`9router exited with code ${code}, signal ${signal}`);
  });
} catch (e) {
  console.error('Failed to start 9router child:', e);
}

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, HEAD, OPTIONS',
  'Access-Control-Allow-Headers': '*',
  'Access-Control-Expose-Headers': 'Content-Length, Content-Type, Content-Range, Accept-Ranges'
};

const server = http.createServer(async (req, res) => {
  if (req.method === 'OPTIONS') {
    res.writeHead(204, CORS_HEADERS);
    res.end();
    return;
  }

  const hostHeader = req.headers.host || 'ersaz.alwaysdata.net';
  const reqUrl = new URL(req.url, `http://${hostHeader}`);

  // Route to HLS Stream Proxy if path is /proxy or /stream
  if (reqUrl.pathname === '/proxy' || reqUrl.pathname === '/stream') {
    const targetUrl = reqUrl.searchParams.get('url');
    if (!targetUrl) {
      res.writeHead(200, { 'Content-Type': 'application/json', ...CORS_HEADERS });
      res.end(JSON.stringify({ status: 'ok', service: 'Famelack Stream Proxy', usage: '/proxy?url=<STREAM_URL>' }));
      return;
    }

    try {
      const target = new URL(targetUrl);
      const isHttps = target.protocol === 'https:';
      const client = isHttps ? https : http;

      const forwardHeaders = {
        'User-Agent': 'Mozilla/5.0 (Linux; Android 14; Mobile) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Mobile Safari/537.36',
        'Accept': '*/*',
        'Referer': `${target.protocol}//${target.host}/`,
        'Origin': `${target.protocol}//${target.host}`
      };

      if (req.headers.range) {
        forwardHeaders['Range'] = req.headers.range;
      }

      const proxyReq = client.request(
        targetUrl,
        {
          method: req.method,
          headers: forwardHeaders,
          rejectUnauthorized: false
        },
        (proxyRes) => {
          // Follow HTTP redirects (301, 302, 307, 308)
          if (proxyRes.statusCode >= 300 && proxyRes.statusCode < 400 && proxyRes.headers.location) {
            const redirectUrl = new URL(proxyRes.headers.location, targetUrl).href;
            const redirectProxy = `https://${hostHeader}${reqUrl.pathname}?url=${encodeURIComponent(redirectUrl)}`;
            res.writeHead(302, { Location: redirectProxy, ...CORS_HEADERS });
            res.end();
            return;
          }

          const contentType = (proxyRes.headers['content-type'] || '').toLowerCase();
          const isM3u8 = targetUrl.toLowerCase().includes('.m3u8') || 
                         contentType.includes('application/vnd.apple.mpegurl') || 
                         contentType.includes('application/x-mpegurl');

          if (isM3u8 && proxyRes.statusCode === 200) {
            let body = '';
            proxyRes.setEncoding('utf8');
            proxyRes.on('data', chunk => { body += chunk; });
            proxyRes.on('end', () => {
              const baseUrl = targetUrl.substring(0, targetUrl.lastIndexOf('/') + 1);
              const proxyOrigin = `https://${hostHeader}`;
              const rewritten = body.split('\n').map(line => {
                const trimmed = line.trim();
                if (!trimmed) return line;
                if (trimmed.startsWith('#')) {
                  if (trimmed.includes('URI="')) {
                    return line.replace(/URI="([^"]+)"/g, (match, uri) => {
                      const resolved = uri.startsWith('http') ? uri : new URL(uri, baseUrl).href;
                      return `URI="${proxyOrigin}/proxy?url=${encodeURIComponent(resolved)}"`;
                    });
                  }
                  return line;
                }
                const resolved = trimmed.startsWith('http') ? trimmed : new URL(trimmed, baseUrl).href;
                return `${proxyOrigin}/proxy?url=${encodeURIComponent(resolved)}`;
              }).join('\n');

              res.writeHead(200, {
                'Content-Type': 'application/vnd.apple.mpegurl',
                'Cache-Control': 'no-cache',
                ...CORS_HEADERS
              });
              res.end(rewritten);
            });
            return;
          }

          const headers = { ...proxyRes.headers, ...CORS_HEADERS };
          delete headers['content-security-policy'];
          res.writeHead(proxyRes.statusCode || 200, headers);
          proxyRes.pipe(res);
        }
      );

      proxyReq.on('error', (err) => {
        res.writeHead(502, { 'Content-Type': 'application/json', ...CORS_HEADERS });
        res.end(JSON.stringify({ error: 'Proxy request error', message: err.message }));
      });

      req.pipe(proxyReq);
    } catch (err) {
      res.writeHead(500, { 'Content-Type': 'application/json', ...CORS_HEADERS });
      res.end(JSON.stringify({ error: 'Invalid URL', message: err.message }));
    }
    return;
  }

  // Forward all other requests (like /v1, /dashboard) to 9router on internal port 8101
  const routerReq = http.request(
    {
      hostname: '127.0.0.1',
      port: ROUTER_PORT,
      path: req.url,
      method: req.method,
      headers: req.headers
    },
    (routerRes) => {
      res.writeHead(routerRes.statusCode || 200, routerRes.headers);
      routerRes.pipe(res);
    }
  );

  routerReq.on('error', (err) => {
    res.writeHead(502, { 'Content-Type': 'text/plain' });
    res.end('9router starting or unavailable');
  });

  req.pipe(routerReq);
});

server.listen(PUBLIC_PORT, '::', () => {
  console.log(`Gateway running on [::]:${PUBLIC_PORT} (9router on ${ROUTER_PORT})`);
});
