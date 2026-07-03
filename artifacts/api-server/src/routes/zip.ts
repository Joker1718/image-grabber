import { Router, type IRouter } from "express";
import JSZip from "jszip";

const router: IRouter = Router();

const USER_AGENT =
  "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/127.0.0.0 Safari/537.36";

function safeFilename(urlString: string, index: number, contentType: string): string {
  let base = `image-${String(index + 1).padStart(3, "0")}`;
  let ext = "";
  try {
    const u = new URL(urlString);
    const last = u.pathname.split("/").filter(Boolean).pop() ?? "";
    const cleaned = (last.split(/[?#]/)[0] ?? "").replace(/[^A-Za-z0-9._-]/g, "_");
    if (cleaned) {
      const dot = cleaned.lastIndexOf(".");
      if (dot >= 0) {
        base = cleaned.slice(0, dot) || base;
        ext = cleaned.slice(dot + 1);
      } else {
        base = cleaned;
      }
    }
  } catch {
    // ignore
  }
  if (!ext) {
    const ct = contentType.toLowerCase();
    if (ct.includes("jpeg") || ct.includes("jpg")) ext = "jpg";
    else if (ct.includes("png")) ext = "png";
    else if (ct.includes("webp")) ext = "webp";
    else if (ct.includes("svg")) ext = "svg";
    else if (ct.includes("gif")) ext = "gif";
    else if (ct.includes("avif")) ext = "avif";
    else ext = "bin";
  }
  return `${base}.${ext}`;
}

router.post("/zip", async (req, res) => {
  const body = req.body as { urls?: unknown; filename?: unknown } | undefined;
  const urlsRaw = Array.isArray(body?.urls) ? body!.urls : null;
  if (!urlsRaw || urlsRaw.length === 0) {
    res.status(400).json({ error: "no_urls", message: "Provide a non-empty `urls` array." });
    return;
  }

  if (urlsRaw.length > 500) {
    res.status(400).json({ error: "too_many_urls", message: "Maximum 500 URLs per request." });
    return;
  }

  const urls: string[] = [];
  for (const u of urlsRaw) {
    if (typeof u !== "string") continue;
    try {
      const parsed = new URL(u);
      if (parsed.protocol !== "http:" && parsed.protocol !== "https:") continue;
      urls.push(parsed.toString());
    } catch {
      // skip invalid
    }
  }

  if (urls.length === 0) {
    res.status(400).json({ error: "no_valid_urls", message: "No valid http(s) URLs provided." });
    return;
  }

  const zip = new JSZip();
  const usedNames = new Set<string>();

  const concurrency = 6;
  let cursor = 0;

  async function worker() {
    while (true) {
      const idx = cursor++;
      if (idx >= urls.length) return;
      const url = urls[idx]!;
      try {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), 15_000);
        const upstream = await fetch(url, {
          headers: {
            "User-Agent": USER_AGENT,
            Accept: "image/avif,image/webp,image/apng,image/*,*/*;q=0.8",
          },
          redirect: "follow",
          signal: controller.signal,
        });
        clearTimeout(timer);
        if (!upstream.ok) continue;
        const buf = Buffer.from(await upstream.arrayBuffer());
        const contentType = upstream.headers.get("content-type") ?? "";
        let name = safeFilename(url, idx, contentType);
        // Avoid collisions
        if (usedNames.has(name)) {
          const dot = name.lastIndexOf(".");
          const base = dot >= 0 ? name.slice(0, dot) : name;
          const ext = dot >= 0 ? name.slice(dot) : "";
          name = `${base}-${idx + 1}${ext}`;
        }
        usedNames.add(name);
        zip.file(name, buf);
      } catch (err) {
        req.log.warn({ err, url }, "Failed to fetch image for ZIP");
      }
    }
  }

  await Promise.all(Array.from({ length: Math.min(concurrency, urls.length) }, () => worker()));

  const zipBuffer = await zip.generateAsync({ type: "nodebuffer", compression: "DEFLATE", compressionOptions: { level: 6 } });
  const downloadName = typeof body?.filename === "string" && body.filename.trim()
    ? body.filename.replace(/[^A-Za-z0-9._-]/g, "_")
    : "images.zip";
  res.setHeader("Content-Type", "application/zip");
  res.setHeader("Content-Disposition", `attachment; filename="${downloadName.endsWith(".zip") ? downloadName : `${downloadName}.zip`}"`);
  res.setHeader("Content-Length", String(zipBuffer.length));
  res.end(zipBuffer);
});

export default router;
