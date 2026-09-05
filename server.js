/**
 * Node.js / Express runner for Famelack Stream Proxy
 * For deployment on VPS, Alwaysdata, Codespaces, Render, etc.
 */
import http from 'http';
import https from 'https';
import { URL } from 'url';

const PORT = process.env.PORT || 8080;

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, HEAD, OPTIONS',
  'Access-Control-Allow-Headers': '*',
};

const server = http.createServer(async (req, res) => {
  if (req.method === 'OPTIONS') {
    res.writeHead(204, CORS_HEADERS);
    res.end();
    return;
  }

  const reqUrl = new URL(req.url, `http://${req.headers.host}`);
  const targetUrl = reqUrl.searchParams.get('url');

  if (!targetUrl) {
    res.writeHead(200, { 'Content-Type': 'application/json', ...CORS_HEADERS });
    res.end(JSON.stringify({ status: 'ok', service: 'Famelack Stream Proxy Node' }));
    return;
  }

  try {
    const target = new URL(targetUrl);
    const client = target.protocol === 'https:' ? https : http;

    const options = {
      method: req.method,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Linux; Android 14; Mobile) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Mobile Safari/537.36',
        'Accept': '*/*',
        'Referer': `${target.protocol}//${target.host}/`
      }
    };

    if (req.headers.range) {
      options.headers['Range'] = req.headers.range;
    }

    const proxyReq = client.request(targetUrl, options, (proxyRes) => {
      const isM3u8 = targetUrl.toLowerCase().includes('.m3u8');
      
      if (isM3u8 && proxyRes.statusCode === 200) {
        let body = '';
        proxyRes.setEncoding('utf8');
        proxyRes.on('data', chunk => { body += chunk; });
        proxyRes.on('end', () => {
          const baseUrl = targetUrl.substring(0, targetUrl.lastIndexOf('/') + 1);
          const proxyOrigin = `http://${req.headers.host}`;
          const rewritten = body.split('\n').map(line => {
            const trimmed = line.trim();
            if (!trimmed || trimmed.startsWith('#')) return line;
            const resolved = trimmed.startsWith('http') ? trimmed : new URL(trimmed, baseUrl).href;
            return `${proxyOrigin}/?url=${encodeURIComponent(resolved)}`;
          }).join('\n');

          res.writeHead(200, {
            'Content-Type': 'application/vnd.apple.mpegurl',
            ...CORS_HEADERS
          });
          res.end(rewritten);
        });
        return;
      }

      const headers = { ...proxyRes.headers, ...CORS_HEADERS };
      res.writeHead(proxyRes.statusCode, headers);
      proxyRes.pipe(res);
    });

    proxyReq.on('error', (err) => {
      res.writeHead(502, CORS_HEADERS);
      res.end(JSON.stringify({ error: err.message }));
    });

    req.pipe(proxyReq);
  } catch (err) {
    res.writeHead(500, CORS_HEADERS);
    res.end(JSON.stringify({ error: err.message }));
  }
});

server.listen(PORT, () => {
  console.log(`Famelack Stream Proxy running on port ${PORT}`);
});
