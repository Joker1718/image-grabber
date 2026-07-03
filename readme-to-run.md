Here's how to run the image-grabber project on Windows:

### Prerequisites
```bash
node -v    # Need Node.js 18+
pnpm -v    # Need pnpm v9+ (v11 has breaking changes — v9 or v10 recommended)
```

If you don't have pnpm:
```bash
npm install -g pnpm
```

### Steps

**1. Extract the zip** to a folder, then open a terminal in that folder.

**2. Install dependencies**
```bash
pnpm install
```

**3. Run in development mode**

For the **frontend** (image-grabber UI):
```bash
pnpm --filter image-grabber dev
```

For the **API server**:
```bash
pnpm --filter api-server dev
```

To run **both at the same time**, open two terminal windows — one for each command above. The frontend runs on `http://localhost:5173` and the API server on `http://localhost:3000`.

**4. Build for production**
```bash
pnpm run build
```

### Quick summary

| Command | What it does |
|---|---|
| `pnpm install` | Install all dependencies |
| `pnpm --filter image-grabber dev` | Start the frontend dev server (port 5173) |
| `pnpm --filter api-server dev` | Start the API server (port 3000) |
| `pnpm run build` | Build all packages for production |

> **Note:** The frontend needs the API server running to extract images from URLs. Start the API server first, then the frontend.
