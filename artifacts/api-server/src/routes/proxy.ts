import { Router, type IRouter } from "express";
import { Readable } from "node:stream";

const router: IRouter = Router();

const USER_AGENT =
  "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/127.0.0.0 Safari/537.36";

function safeFilename(urlString: string, fallback = "image"): string {
  try {
    const u = new URL(urlString);
    const last = u.pathname.split("/").filter(Boolean).pop() ?? "";
    const cleaned = last.split(/[?#]/)[0] ?? "";
    if (cleaned && /\.[a-z0-9]{2,5}$/i.test(cleaned)) {
      return cleaned.replace(/[^A-Za-z0-9._-]/g, "_");
    }
    if (cleaned) {
      return cleaned.replace(/[^A-Za-z0-9._-]/g, "_");
    }
  } catch {
    // ignore
  }
  return fallback;
}

router.get("/proxy", async (req, res) => {
  const target = typeof req.query["url"] === "string" ? req.query["url"] : "";
  const wantsDownload = req.query["download"] === "1" || req.query["download"] === "true";

  if (!target) {
    res.status(400).json({ error: "missing_url", message: "Query parameter `url` is required." });
    return;
  }

  let parsed: URL;
  try {
    parsed = new URL(target);
  } catch {
    res.status(400).json({ error: "invalid_url", message: "The provided url is not valid." });
    return;
  }

  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    res.status(400).json({ error: "invalid_protocol", message: "Only http(s) URLs are supported." });
    return;
  }

  try {
    const upstream = await fetch(parsed.toString(), {
      headers: {
        "User-Agent": USER_AGENT,
        Accept: "image/avif,image/webp,image/apng,image/*,*/*;q=0.8",
        Referer: `${parsed.protocol}//${parsed.host}/`,
      },
      redirect: "follow",
    });

    if (!upstream.ok || !upstream.body) {
      res.status(upstream.status || 502).json({
        error: "upstream_error",
        message: `Upstream returned HTTP ${upstream.status}`,
      });
      return;
    }

    const contentType = upstream.headers.get("content-type") ?? "application/octet-stream";
    const contentLength = upstream.headers.get("content-length");
    res.setHeader("Content-Type", contentType);
    if (contentLength) res.setHeader("Content-Length", contentLength);
    res.setHeader("Cache-Control", "public, max-age=3600");

    if (wantsDownload) {
      const filename = safeFilename(parsed.toString());
      res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    }

    Readable.fromWeb(upstream.body as Parameters<typeof Readable.fromWeb>[0]).pipe(res);
  } catch (err) {
    req.log.error({ err, target }, "Proxy fetch failed");
    res.status(502).json({
      error: "proxy_failed",
      message: err instanceof Error ? err.message : "Failed to proxy image.",
    });
  }
});

export default router;
