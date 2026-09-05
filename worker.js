/**
 * Famelack Stream Proxy — Cloudflare Worker
 * Proxies live HLS (.m3u8) playlists and media segments (.ts, .aac, .mp3, .mp4).
 * Handles CORS, rewrites nested playlist URLs, and bypasses regional ISP blocks.
 */

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, HEAD, OPTIONS',
  'Access-Control-Allow-Headers': '*',
  'Access-Control-Expose-Headers': 'Content-Length, Content-Type, Content-Range, Accept-Ranges'
};

const DEFAULT_USER_AGENT = 'Mozilla/5.0 (Linux; Android 14; Mobile) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Mobile Safari/537.36';

export default {
  async fetch(request, env, ctx) {
    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: CORS_HEADERS });
    }

    const reqUrl = new URL(request.url);
    const targetUrl = reqUrl.searchParams.get('url');

    if (!targetUrl) {
      return new Response(
        JSON.stringify({
          status: 'ok',
          service: 'Famelack Stream Proxy',
          usage: '/?url=<TARGET_STREAM_URL>',
          docs: 'https://github.com/3krbkbkrbrbg/famelack-stream-proxy'
        }),
        {
          headers: { 'Content-Type': 'application/json', ...CORS_HEADERS }
        }
      );
    }

    try {
      const parsedTarget = new URL(targetUrl);
      const headers = new Headers();
      headers.set('User-Agent', request.headers.get('User-Agent') || DEFAULT_USER_AGENT);
      headers.set('Accept', '*/*');
      headers.set('Accept-Encoding', 'identity');

      // Forward Range headers for audio/video seeking
      const range = request.headers.get('Range');
      if (range) {
        headers.set('Range', range);
      }

      // Forward Referer or set target host as referer if needed
      const customReferer = reqUrl.searchParams.get('referer') || `${parsedTarget.protocol}//${parsedTarget.host}/`;
      headers.set('Referer', customReferer);
      headers.set('Origin', `${parsedTarget.protocol}//${parsedTarget.host}`);

      const response = await fetch(targetUrl, {
        method: request.method,
        headers: headers,
        redirect: 'follow'
      });

      const contentType = (response.headers.get('Content-Type') || '').toLowerCase();
      const isM3u8 = targetUrl.toLowerCase().includes('.m3u8') || 
                     contentType.includes('application/vnd.apple.mpegurl') || 
                     contentType.includes('application/x-mpegurl');

      if (isM3u8 && response.ok) {
        const text = await response.text();
        const baseUrl = targetUrl.substring(0, targetUrl.lastIndexOf('/') + 1);
        const proxyOrigin = `${reqUrl.protocol}//${reqUrl.host}`;

        // Rewrite relative URLs in the m3u8 playlist to route back through this proxy
        const rewrittenLines = text.split('\n').map(line => {
          const trimmed = line.trim();
          if (!trimmed || trimmed.startsWith('#')) {
            // Check for URI in tags like #EXT-X-KEY:METHOD=AES-128,URI="..."
            if (trimmed.includes('URI="')) {
              return line.replace(/URI="([^"]+)"/g, (match, uri) => {
                const resolvedUri = uri.startsWith('http') ? uri : new URL(uri, baseUrl).href;
                return `URI="${proxyOrigin}/?url=${encodeURIComponent(resolvedUri)}"`;
              });
            }
            return line;
          }

          // Relative or absolute stream / chunk line
          const resolvedUrl = trimmed.startsWith('http') ? trimmed : new URL(trimmed, baseUrl).href;
          return `${proxyOrigin}/?url=${encodeURIComponent(resolvedUrl)}`;
        });

        const newBody = rewrittenLines.join('\n');
        const outHeaders = new Headers(response.headers);
        Object.entries(CORS_HEADERS).forEach(([k, v]) => outHeaders.set(k, v));
        outHeaders.set('Content-Type', 'application/vnd.apple.mpegurl');
        outHeaders.delete('Content-Security-Policy');

        return new Response(newBody, {
          status: response.status,
          statusText: response.statusText,
          headers: outHeaders
        });
      }

      // Pass-through for video/audio segments (.ts, .aac, etc.)
      const outHeaders = new Headers(response.headers);
      Object.entries(CORS_HEADERS).forEach(([k, v]) => outHeaders.set(k, v));
      outHeaders.delete('Content-Security-Policy');

      return new Response(response.body, {
        status: response.status,
        statusText: response.statusText,
        headers: outHeaders
      });

    } catch (err) {
      return new Response(
        JSON.stringify({ error: 'Proxy fetch failed', message: err.message }),
        { status: 502, headers: { 'Content-Type': 'application/json', ...CORS_HEADERS } }
      );
    }
  }
};
