# Famelack Stream Proxy

Free, high-performance HLS (.m3u8) & media stream proxy.
Bypasses CORS limitations, hotlink protection, and regional ISP filtering for live TV & radio streams.

## Features
- 🚀 **Auto-Rewrites .m3u8 Playlists**: Resolves relative chunk paths and routes them through the proxy.
- ⚡ **Zero-Buffer Streaming**: Piped binary streaming for `.ts`, `.aac`, `.mp3`, and `.mp4` chunks.
- 🌐 **CORS Unlocked**: Full `Access-Control-Allow-Origin: *` headers.
- 📱 **Mobile & Android Optimized**: Modern User-Agent spoofing and Range-request support.

## Deploy for Free to Cloudflare Workers (100,000 reqs/day)
```bash
npx wrangler deploy
```

## Deploy on Node.js / VPS / Render
```bash
npm start
```
