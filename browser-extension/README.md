# BharatGPilot Browser Extension

A standalone React 18 + TypeScript + Tailwind CSS Chromium side-panel frontend.

## Build

Requires Node.js 20+ and npm.

```bash
cd browser-extension
npm install
npm run build
```

The extension build is written to `browser-extension/dist`. To load it in Chrome, open `chrome://extensions`, enable Developer mode, choose **Load unpacked**, and select the `dist` folder after building. Copy `manifest.json` and `background.js` into `dist` as part of packaging if your build process does not copy them; Vite does not copy these root files automatically by default.

## API

By default the frontend calls `https://bharatgpilot.com/api/pilot/stream` and `/api/pilot/chat`. Configure `VITE_BGP_API_BASE` at build time if the deployed API origin differs. The API must permit the extension origin in its CORS policy.

## Security notes

- No API provider secret is embedded in the extension.
- A session token is read from extension storage, not page localStorage.
- Generated HTML previews run in a sandboxed iframe with scripts enabled but without same-origin access.
- The credit count is explicitly marked as a local demo balance until a documented authenticated credits endpoint is available.
- The UI does not claim translation, page summarization, or account credit sync succeeded unless the supporting API is available.
