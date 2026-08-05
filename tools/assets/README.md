# Asset tooling boundary

`polyhaven-pack.mjs` is an **offline curation/build tool**, never a game-runtime loader. It talks to the official Poly Haven API only while a maintainer explicitly builds a pack, uses a named User-Agent, validates the upstream MD5, converts JPG maps to local WebP, and writes SHA-256/byte evidence to `tools/assets/reports/`.

```powershell
# Curated Web Demo pack. Output is public/assets/polyhaven/web-1k/.
npm.cmd run assets:polyhaven
npm.cmd run assets:verify

# Desktop source/output remains Git-ignored and is never included in the Web Demo.
npm.cmd run assets:polyhaven:desktop-2k
npm.cmd run assets:polyhaven:desktop-4k
npm.cmd run assets:verify -- --pack desktop-2k
```

The source cache lives under `.asset-cache/`; desktop output lives under `desktop-packs/`. Both are ignored by Git. A desktop wrapper/CDN must expose a generated pack at `/assets/polyhaven/<pack>/manifest.json` (or set `VITE_AETHERIA_DESKTOP_PACK_ROOT`) before the desktop build can select it.

Before changing the curated list, follow `docs/ASSET_PIPELINE.md`, update `src/assets/manifest.ts`, run the manifest and hash checks, then perform a visual/performance review. Do not use this folder to hotlink Poly Haven at runtime, bypass entitlement, or add unreviewed binary assets.
