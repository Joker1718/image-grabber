Let me check what the build outputs look like so I can give you accurate instructions.
Here's how to build and run the **production** version:

### 1. Build everything
```bash
pnpm run build
```
This produces:
- **API server** → `artifacts/api-server/dist/index.mjs` (bundled Node.js server)
- **Frontend** → `artifacts/image-grabber/dist/public/` (static HTML/CSS/JS files)

### 2. Launch the API server
```bash
node artifacts/api-server/dist/index.mjs
```
It starts on `http://localhost:3000` by default. You can change the port:
```bash
set PORT=8080 && node artifacts/api-server/dist/index.mjs
```

### 3. Serve the frontend
The frontend builds to **static files** — you can serve them two ways:

**Option A — Vite preview server** (quickest):
```bash
pnpm --filter image-grabber serve
```
Opens on `http://localhost:5173`

**Option B — Any static file server** (e.g. `serve`, Nginx, IIS):
```bash
npx serve artifacts/image-grabber/dist/public
```

### 4. Use it
1. Open the frontend URL in your browser (e.g. `http://localhost:5173`)
2. Paste a webpage URL into the input
3. Click extract — the frontend calls the API server at `localhost:3000` to scrape images

> **Important:** The API server must be running for image extraction to work. The frontend is just a UI — the actual scraping (Playwright + Cheerio) happens on the API server side.