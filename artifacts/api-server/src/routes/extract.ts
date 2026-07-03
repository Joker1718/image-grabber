import { Router, type IRouter } from "express";
import { ExtractImagesBody } from "@workspace/api-zod";
import { extractImages } from "../lib/extract.js";

const router: IRouter = Router();

function normalizeUrl(input: string): string | null {
  let value = input.trim();
  if (!value) return null;
  if (!/^https?:\/\//i.test(value)) {
    value = `https://${value}`;
  }
  try {
    const parsed = new URL(value);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return null;
    return parsed.toString();
  } catch {
    return null;
  }
}

router.post("/extract", async (req, res) => {
  const parsed = ExtractImagesBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "invalid_request", message: parsed.error.message });
    return;
  }

  const url = normalizeUrl(parsed.data.url);
  if (!url) {
    res.status(400).json({
      error: "invalid_url",
      message: "The provided value is not a valid http(s) URL.",
    });
    return;
  }

  try {
    const result = await extractImages(url);
    res.json(result);
  } catch (err) {
    req.log.error({ err, url }, "Image extraction failed");
    const message = err instanceof Error ? err.message : "Unknown error during extraction.";
    res.status(500).json({ error: "extraction_failed", message });
  }
});

export default router;
