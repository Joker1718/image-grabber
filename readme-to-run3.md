You mean a single command/script to start the whole thing? Let me create a startup script for you.
I see the issue — the frontend calls `/api/*` as relative paths, so for production it's cleanest to serve **both** from one process. Let me create a simple startup script.
Now I'll create a production start script that serves the API + frontend from a single command:
Actually, that's overcomplicated. Let me do it properly — modify the API server to serve the frontend static files too, so **one command** runs everything.
Now let me update the Express app to serve the frontend static files in production:
Now create a Windows `.bat` file too:
Now re-zip with the new files:
Done! The zip is updated with the new startup files. Here's your **one-command setup**:

### First time (build + run):
```bash
start.bat
```
This builds everything, then launches the server on **`http://localhost:3000`** — frontend and API together.

### After building once, just run:
```bash
node start.mjs
```

### Change the port:
```bash
node start.mjs --port 8080
```

### What happens under the hood:
The API server's Express app now **also serves the frontend static files**, so one `node` command handles both the UI (`/`) and the API (`/api/*`) on a single port. No separate frontend server needed.