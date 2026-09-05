# 🚀 Famelack Stream Proxy

Free, high-performance HLS (.m3u8) & media stream proxy.
Bypasses CORS limitations, hotlink protection, and regional ISP filtering for live TV & radio streams.

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https%3A%2F%2Fgithub.com%2F3krbkbkrbrbg%2Ffamelack-stream-proxy)
[![Deploy to Render](https://render.com/images/deploy-to-render-button.svg)](https://render.com/deploy?repo=https://github.com/3krbkbkrbrbg/famelack-stream-proxy)

---

## Features
- 🚀 **Auto-Rewrites .m3u8 Playlists**: Resolves relative chunk paths and routes them through the proxy.
- ⚡ **Zero-Buffer Streaming**: Piped binary streaming for `.ts`, `.aac`, `.mp3`, and `.mp4` chunks.
- 🌐 **CORS Unlocked**: Full `Access-Control-Allow-Origin: *` headers.
- 📱 **Mobile & Android Optimized**: Modern User-Agent spoofing and Range-request support.

---

## 1-Click Free Deployment

### Option 1: Vercel (Recommended — Free 100GB/mo)
1. Click the **Deploy with Vercel** button above or import this repo into [Vercel](https://vercel.com).
2. Once deployed, copy your production domain (e.g. `https://my-proxy.vercel.app`).
3. In the Famelack Android App → Player → **Anti-Filter Proxy Settings**, paste:
   `https://my-proxy.vercel.app/?url=`

### Option 2: Cloudflare Workers
1. Go to [Cloudflare Dashboard](https://dash.cloudflare.com) → Workers & Pages → Create Application.
2. Paste the code from `worker.js`.
3. Set your worker domain in the app (or custom domain).

### Option 3: Local Node.js / Docker / VPS
```bash
git clone https://github.com/3krbkbkrbrbg/famelack-stream-proxy.git
cd famelack-stream-proxy
npm start
```
Default port: `8080`.
