# Workspace

## Overview

pnpm workspace monorepo using TypeScript. Each package manages its own dependencies.

## Stack

- **Monorepo tool**: pnpm workspaces
- **Node.js version**: 24
- **Package manager**: pnpm
- **TypeScript version**: 5.9
- **API framework**: Express 5
- **Database**: PostgreSQL + Drizzle ORM
- **Validation**: Zod (`zod/v4`), `drizzle-zod`
- **API codegen**: Orval (from OpenAPI spec)
- **Build**: esbuild (CJS bundle)

## Key Commands

- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- `pnpm --filter @workspace/api-server run dev` — run API server locally

See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details.

## Artifacts

- **Image Grabber** (`artifacts/image-grabber`, web, mounted at `/`) — React + Vite SPA. Pastes any URL and triggers POST `/api/extract`, then renders a filterable, multi-selectable image gallery with single + bulk ZIP downloads.
- **API Server** (`artifacts/api-server`, mounted at `/api`) — Express 5. Routes:
  - `POST /api/extract` — Playwright (chromium-headless-shell) renders the page, scrolls in passes for lazy-loaded content, then collects every `img/srcset/data-src/picture/video[poster]/background-image/og:image` URL. Falls back to cheerio static HTML if the browser fails. Each URL is HEAD/GET-verified for status + size + content-type with concurrency 8.
  - `GET /api/proxy?url=...&download=1` — streams an image through with the right `Referer` header (sidesteps hotlink protection) and toggles `Content-Disposition: attachment` for downloads.
  - `POST /api/zip` `{urls, filename}` — fetches up to 500 URLs (concurrency 6), packages them into a deflate ZIP, returns the file inline.
- **Mockup sandbox** (`artifacts/mockup-sandbox`) — design canvas, not used at runtime.

## Image Grabber implementation notes

- Playwright Chromium needs system libs installed via Nix: `glib`, `nss`, `nspr`, `atk`, `at-spi2-atk`, `at-spi2-core`, `cups`, `dbus`, `expat`, `libdrm`, `libxkbcommon`, `mesa`, `libgbm`, `udev`, `alsa-lib`, `cairo`, `pango`, `xorg.libX11/libXcomposite/libXdamage/libXext/libXfixes/libXrandr/libxcb/libXtst`, `fontconfig`, `freetype`. The browser binary lives in `.cache/ms-playwright/` (installed via `npx playwright install chromium`).
- The browser is launched once and reused as a singleton across requests (`getBrowser()` in `artifacts/api-server/src/lib/extract.ts`); each request opens a fresh `BrowserContext` to keep cookies/storage isolated.
- Browser-side DOM extraction lives in `artifacts/api-server/src/lib/extract-page-script.ts` and is marked `// @ts-nocheck` because TypeScript only sees the Node lib for the api-server package.
- `playwright` is added to the esbuild `external` list in `artifacts/api-server/build.mjs` so it's resolved from `node_modules` at runtime instead of being bundled.

