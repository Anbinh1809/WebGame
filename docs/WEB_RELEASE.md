# Web release guide

## What this checkout can publish now

The free Web 1K edition is a static React/Vite game. It has no backend, payment flow, cloud-save system, analytics SDK, or runtime asset hotlinking. Build artifacts in `dist/` can therefore be served from a static host over HTTPS.

```powershell
npm.cmd ci
npm.cmd run verify
```

Use a normal HTTP(S) server to test the output. Do not open `dist/index.html` through `file://`, because browser module loading and WebGL behavior differ from a deployed site.

## GitHub Pages

This repository now contains two workflows:

- `Verify web release` runs typecheck, ESLint, Vitest and the production build on pull requests and `main`.
- `Deploy web demo to GitHub Pages` builds the static Web 1K edition after those checks, uploads it to Pages and preserves direct links to `/play` with a generated `404.html` fallback.

To activate it, the owner must open the repository **Settings → Pages**, set **Source** to **GitHub Actions**, then push `main`. The workflow deploys to the repository subpath, so both the landing page and `/play` work at the Pages URL.

For a custom domain, set the deployment build variable `VITE_PUBLIC_BASE=/` instead of the repository path in `deploy-pages.yml`, configure the domain at the host, and add the host-provided DNS record. Do not set a canonical domain or sitemap until that domain is controlled.

## Other static hosts

Cloudflare Pages and Netlify understand the committed `public/_redirects` rules, which route `/play` back to the SPA entry point. They also understand `public/_headers`, which supplies a strict static-site security policy and cache rules. A host that does not support those files must be configured with equivalent rules:

- serve `index.html` for `/play` and `/play/*`;
- serve assets with the correct MIME types;
- force HTTPS;
- use the security headers in `public/_headers` (or host equivalents).

Never expose `desktop-packs/`, `.asset-cache/`, `.env.desktop`, or a future entitlement endpoint as part of the free web deploy. The Web 1K release uses only `dist/`.

## Pre-release owner checklist

1. Select the public host and domain; activate the matching workflow or host project.
2. Publish real contact, privacy, terms and refund pages before collecting payments or personal data. The current Web demo has no checkout and must not claim otherwise.
3. Verify the deployed URL on a desktop browser and a 390x844 mobile viewport: load `/`, load `/play` directly, make a world edit, save/export/import, open/close drawers with Escape, and test a WebGL-disabled fallback.
4. Record the deployed revision, date, host, domain, asset-manifest verification result and manual accessibility check in the release note.
5. Keep 2K/4K/8K desktop packs and any paid entitlement service out of the Web 1K host until distribution, legal and payment decisions are approved.
