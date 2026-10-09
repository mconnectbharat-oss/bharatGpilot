# BharatGPilot Browser Extension

A standalone React 18 + TypeScript + Tailwind CSS Chromium side-panel frontend.

## Build

Requires Node.js 20+ and npm.

```bash
cd browser-extension
npm install
npm run build
```

Vite writes the unpacked extension to `browser-extension/dist`; the `public/manifest.json` and `public/background.js` assets are copied into that output automatically. To load it in Chrome, open `chrome://extensions`, enable Developer mode, choose **Load unpacked**, and select the `dist` folder after building.

## API

The frontend calls `/api/pilot/stream` at the configured API origin. The default is `https://bharatgpilot.com`. Configure `VITE_BGP_API_BASE` at build time if the deployed API origin differs. The API must permit the extension origin in its CORS policy and return a stream format understood by the client.

## Session and credits

The frontend looks for `bgp_token` in `chrome.storage.local`. This project does not yet include an extension sign-in screen or token exchange flow; a session token must be provisioned by a supported authentication flow. No API provider secret is embedded in the extension.

The credit count is a clearly marked local demo balance, not a real account balance. A documented authenticated credits endpoint is needed before it can display live account usage.

## Artifacts and page actions

Generated HTML previews run in a sandboxed iframe with scripts enabled but without same-origin access. Translate and TL;DR buttons prepare prompts that ask the user to paste page text; they do not silently read webpage contents.

## Limitations

This is an initial frontend scaffold, not a verified production release. Build and browser testing must pass before distribution. The API must support CORS for the extension origin, and stream framing should be confirmed against the deployed backend.
