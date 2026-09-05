export const config = {
  runtime: 'edge',
};

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, HEAD, OPTIONS',
  'Access-Control-Allow-Headers': '*',
  'Access-Control-Expose-Headers': 'Content-Length, Content-Type, Content-Range, Accept-Ranges',
};

const DEFAULT_USER_AGENT = 'Mozilla/5.0 (Linux; Android 14; Mobile) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Mobile Safari/537.36';

export default async function handler(request) {
  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: CORS_HEADERS });
  }

  const reqUrl = new URL(request.url);
  const targetUrl = reqUrl.searchParams.get('url');

  if (!targetUrl) {
    return new Response(
      JSON.stringify({
        status: 'ok',
        service: 'Famelack Stream Proxy on Vercel Edge',
        usage: '/?url=<TARGET_STREAM_URL>'
      }),
      { headers: { 'Content-Type': 'application/json', ...CORS_HEADERS } }
    );
  }

  try {
    const parsedTarget = new URL(targetUrl);
    const headers = new Headers();
    headers.set('User-Agent', request.headers.get('User-Agent') || DEFAULT_USER_AGENT);
    headers.set('Accept', '*/*');
    headers.set('Accept-Encoding', 'identity');

    const range = request.headers.get('Range');
    if (range) headers.set('Range', range);

    headers.set('Referer', `${parsedTarget.protocol}//${parsedTarget.host}/`);
    headers.set('Origin', `${parsedTarget.protocol}//${parsedTarget.host}`);

    const response = await fetch(targetUrl, {
      method: request.method,
      headers: headers,
      redirect: 'follow',
    });

    const contentType = (response.headers.get('Content-Type') || '').toLowerCase();
    const isM3u8 = targetUrl.toLowerCase().includes('.m3u8') ||
                   contentType.includes('application/vnd.apple.mpegurl') ||
                   contentType.includes('application/x-mpegurl');

    if (isM3u8 && response.ok) {
      const text = await response.text();
      const baseUrl = targetUrl.substring(0, targetUrl.lastIndexOf('/') + 1);
      const proxyOrigin = `${reqUrl.protocol}//${reqUrl.host}`;

      const rewrittenLines = text.split('\n').map(line => {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith('#')) {
          if (trimmed.includes('URI="')) {
            return line.replace(/URI="([^"]+)"/g, (match, uri) => {
              const resolvedUri = uri.startsWith('http') ? uri : new URL(uri, baseUrl).href;
              return `URI="${proxyOrigin}/?url=${encodeURIComponent(resolvedUri)}"`;
            });
          }
          return line;
        }

        const resolvedUrl = trimmed.startsWith('http') ? trimmed : new URL(trimmed, baseUrl).href;
        return `${proxyOrigin}/?url=${encodeURIComponent(resolvedUrl)}`;
      });

      const newBody = rewrittenLines.join('\n');
      const outHeaders = new Headers(response.headers);
      Object.entries(CORS_HEADERS).forEach(([k, v]) => outHeaders.set(k, v));
      outHeaders.set('Content-Type', 'application/vnd.apple.mpegurl');
      outHeaders.set('Cache-Control', 'no-cache');
      outHeaders.delete('Content-Security-Policy');

      return new Response(newBody, {
        status: response.status,
        statusText: response.statusText,
        headers: outHeaders,
      });
    }

    const outHeaders = new Headers(response.headers);
    Object.entries(CORS_HEADERS).forEach(([k, v]) => outHeaders.set(k, v));
    outHeaders.delete('Content-Security-Policy');

    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers: outHeaders,
    });
  } catch (err) {
    return new Response(
      JSON.stringify({ error: 'Proxy fetch failed', message: err.message }),
      { status: 502, headers: { 'Content-Type': 'application/json', ...CORS_HEADERS } }
    );
  }
}
