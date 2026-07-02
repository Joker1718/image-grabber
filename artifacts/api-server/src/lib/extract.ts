import { createHash } from "node:crypto";
import { chromium, type Browser } from "playwright";
import * as cheerio from "cheerio";
import { logger } from "./logger.js";
import { collectImagesInPage, scrollPageForLazyLoad, type RawImage } from "./extract-page-script.js";

export type ImageSource =
  | "img"
  | "srcset"
  | "data-src"
  | "background"
  | "video-poster"
  | "meta"
  | "picture";

export type ImageStatus = "loaded" | "broken" | "unknown";

export interface ImageItem {
  id: string;
  url: string;
  source: ImageSource;
  alt: string;
  renderedWidth: number;
  renderedHeight: number;
  naturalWidth: number;
  naturalHeight: number;
  sizeBytes: number;
  contentType: string;
  extension: string;
  status: ImageStatus;
  httpStatus: number;
}

export interface ExtractResult {
  requestedUrl: string;
  finalUrl: string;
  pageTitle: string;
  durationMs: number;
  totalImages: number;
  loadedCount: number;
  brokenCount: number;
  scrollPasses: number;
  renderer: string;
  warnings: string[];
  images: ImageItem[];
}

interface RawImageRecord {
  url: string;
  source: ImageSource;
  alt: string;
  renderedWidth: number;
  renderedHeight: number;
  naturalWidth: number;
  naturalHeight: number;
}

const IMAGE_EXTENSIONS = ["jpg", "jpeg", "png", "webp", "svg", "gif", "avif", "bmp", "ico", "tiff"];
const USER_AGENT =
  "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/127.0.0.0 Safari/537.36";

let browserPromise: Promise<Browser> | null = null;

async function getBrowser(): Promise<Browser> {
  if (!browserPromise) {
    browserPromise = chromium
      .launch({
        headless: true,
        args: [
          "--no-sandbox",
          "--disable-setuid-sandbox",
          "--disable-dev-shm-usage",
          "--disable-gpu",
        ],
      })
      .catch((err) => {
        browserPromise = null;
        throw err;
      });
  }
  return browserPromise;
}

export async function shutdownBrowser(): Promise<void> {
  if (browserPromise) {
    try {
      const browser = await browserPromise;
      await browser.close();
    } catch {
      // ignore
    }
    browserPromise = null;
  }
}

function hashId(input: string): string {
  return createHash("sha1").update(input).digest("hex").slice(0, 12);
}

function guessExtension(url: string, contentType: string): string {
  const ct = contentType.toLowerCase();
  if (ct.includes("jpeg") || ct.includes("jpg")) return "jpg";
  if (ct.includes("png")) return "png";
  if (ct.includes("webp")) return "webp";
  if (ct.includes("svg")) return "svg";
  if (ct.includes("gif")) return "gif";
  if (ct.includes("avif")) return "avif";
  if (ct.includes("bmp")) return "bmp";
  if (ct.includes("icon")) return "ico";
  if (ct.includes("tiff")) return "tiff";

  try {
    const u = new URL(url);
    const path = u.pathname.toLowerCase();
    const dot = path.lastIndexOf(".");
    if (dot >= 0) {
      const ext = path.slice(dot + 1).split(/[?#]/)[0]?.toLowerCase() ?? "";
      if (IMAGE_EXTENSIONS.includes(ext)) {
        return ext === "jpeg" ? "jpg" : ext;
      }
    }
  } catch {
    // ignore
  }
  return "";
}

function looksLikeImageUrl(url: string): boolean {
  if (!url) return false;
  const lower = url.split(/[?#]/)[0]?.toLowerCase() ?? "";
  if (!lower) return false;
  if (lower.startsWith("data:")) return lower.startsWith("data:image/");
  return IMAGE_EXTENSIONS.some((ext) => lower.endsWith(`.${ext}`)) ||
    lower.includes("/image/") ||
    lower.includes("/img/") ||
    lower.includes("cdn") ||
    lower.includes("media");
}

function absolutize(url: string, base: string): string | null {
  try {
    if (!url) return null;
    const trimmed = url.trim();
    if (!trimmed) return null;
    if (trimmed.startsWith("data:")) return trimmed;
    if (trimmed.startsWith("javascript:")) return null;
    return new URL(trimmed, base).toString();
  } catch {
    return null;
  }
}

function dedupeRawImages(records: RawImageRecord[]): RawImageRecord[] {
  const map = new Map<string, RawImageRecord>();
  const sourceRank: Record<ImageSource, number> = {
    img: 6,
    picture: 5,
    srcset: 4,
    "data-src": 3,
    background: 2,
    "video-poster": 1,
    meta: 0,
  };
  for (const rec of records) {
    const existing = map.get(rec.url);
    if (!existing) {
      map.set(rec.url, rec);
      continue;
    }
    const merged: RawImageRecord = { ...existing };
    if (sourceRank[rec.source] > sourceRank[existing.source]) {
      merged.source = rec.source;
    }
    merged.alt = existing.alt || rec.alt;
    merged.renderedWidth = Math.max(existing.renderedWidth, rec.renderedWidth);
    merged.renderedHeight = Math.max(existing.renderedHeight, rec.renderedHeight);
    merged.naturalWidth = Math.max(existing.naturalWidth, rec.naturalWidth);
    merged.naturalHeight = Math.max(existing.naturalHeight, rec.naturalHeight);
    map.set(rec.url, merged);
  }
  return [...map.values()];
}

async function verifyImage(
  url: string,
  referer: string,
  signal: AbortSignal,
): Promise<{ status: ImageStatus; httpStatus: number; sizeBytes: number; contentType: string }> {
  if (url.startsWith("data:")) {
    const m = url.match(/^data:([^;,]+)/);
    return {
      status: "loaded",
      httpStatus: 200,
      sizeBytes: url.length,
      contentType: m?.[1] ?? "image/*",
    };
  }
  try {
    const headers: Record<string, string> = {
      "User-Agent": USER_AGENT,
      Accept: "image/avif,image/webp,image/apng,image/*,*/*;q=0.8",
      Referer: referer,
    };
    let res = await fetch(url, { method: "HEAD", headers, signal, redirect: "follow" });
    let contentType = res.headers.get("content-type") ?? "";
    let contentLength = Number(res.headers.get("content-length") ?? "0");

    // Some servers don't support HEAD or don't return useful headers — try GET (range) as fallback.
    if (!res.ok || !contentType) {
      const rangeHeaders = { ...headers, Range: "bytes=0-1023" };
      const getRes = await fetch(url, { method: "GET", headers: rangeHeaders, signal, redirect: "follow" });
      const buf = await getRes.arrayBuffer();
      contentType = getRes.headers.get("content-type") ?? contentType;
      contentLength = Number(getRes.headers.get("content-length") ?? `${buf.byteLength}`) || buf.byteLength;
      res = getRes;
    }

    return {
      status: res.ok ? "loaded" : "broken",
      httpStatus: res.status,
      sizeBytes: Number.isFinite(contentLength) ? contentLength : 0,
      contentType,
    };
  } catch {
    return { status: "unknown", httpStatus: 0, sizeBytes: 0, contentType: "" };
  }
}

async function verifyAll(
  records: RawImageRecord[],
  referer: string,
): Promise<ImageItem[]> {
  const results: ImageItem[] = new Array(records.length);
  const concurrency = 8;
  let cursor = 0;
  const controller = new AbortController();
  // Per-request timeout — abort the whole batch if a request takes too long.
  const overallTimer = setTimeout(() => controller.abort(), 60_000);

  async function worker() {
    while (true) {
      const idx = cursor++;
      if (idx >= records.length) return;
      const rec = records[idx]!;
      const reqController = new AbortController();
      const reqTimer = setTimeout(() => reqController.abort(), 8_000);
      const signal = AbortSignal.any([controller.signal, reqController.signal]);
      try {
        const verification = await verifyImage(rec.url, referer, signal);
        const ext = guessExtension(rec.url, verification.contentType);
        results[idx] = {
          id: hashId(rec.url),
          url: rec.url,
          source: rec.source,
          alt: rec.alt,
          renderedWidth: rec.renderedWidth,
          renderedHeight: rec.renderedHeight,
          naturalWidth: rec.naturalWidth,
          naturalHeight: rec.naturalHeight,
          sizeBytes: verification.sizeBytes,
          contentType: verification.contentType,
          extension: ext,
          status: verification.status,
          httpStatus: verification.httpStatus,
        };
      } finally {
        clearTimeout(reqTimer);
      }
    }
  }

  const workers = Array.from({ length: Math.min(concurrency, records.length) }, () => worker());
  await Promise.all(workers);
  clearTimeout(overallTimer);
  return results;
}

interface BrowserExtraction {
  records: RawImageRecord[];
  finalUrl: string;
  pageTitle: string;
  scrollPasses: number;
  warnings: string[];
}

async function extractWithBrowser(targetUrl: string): Promise<BrowserExtraction> {
  const browser = await getBrowser();
  const context = await browser.newContext({
    userAgent: USER_AGENT,
    viewport: { width: 1366, height: 900 },
    deviceScaleFactor: 1,
    ignoreHTTPSErrors: true,
  });
  const page = await context.newPage();
  const warnings: string[] = [];

  try {
    const response = await page.goto(targetUrl, {
      waitUntil: "domcontentloaded",
      timeout: 30_000,
    });
    if (!response) {
      warnings.push("No HTTP response received from the target URL.");
    } else if (!response.ok()) {
      warnings.push(`Page returned HTTP ${response.status()} ${response.statusText()}.`);
    }

    // Best-effort wait for network to settle.
    try {
      await page.waitForLoadState("networkidle", { timeout: 8_000 });
    } catch {
      warnings.push("Network did not reach idle within 8s — the page may still be loading.");
    }

    // Trigger lazy loading by scrolling through the page in passes.
    const scrollPasses = await page.evaluate(scrollPageForLazyLoad);

    try {
      await page.waitForLoadState("networkidle", { timeout: 5_000 });
    } catch {
      // ignore
    }

    const finalUrl = page.url();
    const pageTitle = (await page.title()) || finalUrl;

    const raw: RawImage[] = await page.evaluate(collectImagesInPage, targetUrl);

    const records: RawImageRecord[] = raw
      .map((r) => ({
        url: r.url,
        source: r.source as ImageSource,
        alt: r.alt,
        renderedWidth: r.renderedWidth,
        renderedHeight: r.renderedHeight,
        naturalWidth: r.naturalWidth,
        naturalHeight: r.naturalHeight,
      }))
      .filter((r) => r.url && !r.url.startsWith("javascript:"));

    return {
      records: dedupeRawImages(records),
      finalUrl,
      pageTitle,
      scrollPasses,
      warnings,
    };
  } finally {
    await context.close().catch(() => {});
  }
}

async function extractWithStaticHtml(targetUrl: string): Promise<BrowserExtraction> {
  const warnings: string[] = [
    "Browser rendering unavailable — falling back to static HTML scraping. JS-rendered or lazy-loaded images may be missed.",
  ];
  const res = await fetch(targetUrl, {
    headers: {
      "User-Agent": USER_AGENT,
      Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    },
    redirect: "follow",
  });
  if (!res.ok) {
    warnings.push(`Initial fetch returned HTTP ${res.status}.`);
  }
  const html = await res.text();
  const finalUrl = res.url || targetUrl;
  const $ = cheerio.load(html);
  const pageTitle = $("title").first().text().trim() || finalUrl;
  const records: RawImageRecord[] = [];

  $("img").each((_, el) => {
    const $el = $(el);
    const alt = $el.attr("alt") ?? "";
    const src = absolutize($el.attr("src") ?? "", finalUrl);
    if (src) records.push({ url: src, source: "img", alt, renderedWidth: 0, renderedHeight: 0, naturalWidth: 0, naturalHeight: 0 });
    const srcset = $el.attr("srcset");
    if (srcset) {
      srcset.split(",").forEach((part) => {
        const u = absolutize(part.trim().split(/\s+/)[0] ?? "", finalUrl);
        if (u) records.push({ url: u, source: "srcset", alt, renderedWidth: 0, renderedHeight: 0, naturalWidth: 0, naturalHeight: 0 });
      });
    }
    ["data-src", "data-lazy-src", "data-original"].forEach((attr) => {
      const v = $el.attr(attr);
      const u = v ? absolutize(v, finalUrl) : null;
      if (u) records.push({ url: u, source: "data-src", alt, renderedWidth: 0, renderedHeight: 0, naturalWidth: 0, naturalHeight: 0 });
    });
  });

  $("picture source").each((_, el) => {
    const srcset = $(el).attr("srcset");
    if (!srcset) return;
    srcset.split(",").forEach((part) => {
      const u = absolutize(part.trim().split(/\s+/)[0] ?? "", finalUrl);
      if (u) records.push({ url: u, source: "picture", alt: "", renderedWidth: 0, renderedHeight: 0, naturalWidth: 0, naturalHeight: 0 });
    });
  });

  $("video[poster]").each((_, el) => {
    const u = absolutize($(el).attr("poster") ?? "", finalUrl);
    if (u) records.push({ url: u, source: "video-poster", alt: "", renderedWidth: 0, renderedHeight: 0, naturalWidth: 0, naturalHeight: 0 });
  });

  $("[style]").each((_, el) => {
    const style = $(el).attr("style") ?? "";
    const re = /background(?:-image)?\s*:\s*[^;]*url\(\s*(['"]?)([^'")]+)\1\s*\)/g;
    let m: RegExpExecArray | null;
    while ((m = re.exec(style)) !== null) {
      const u = absolutize(m[2] ?? "", finalUrl);
      if (u) records.push({ url: u, source: "background", alt: "", renderedWidth: 0, renderedHeight: 0, naturalWidth: 0, naturalHeight: 0 });
    }
  });

  $('meta[property="og:image"], meta[property="og:image:url"], meta[property="og:image:secure_url"], meta[name="twitter:image"], meta[name="twitter:image:src"]').each((_, el) => {
    const u = absolutize($(el).attr("content") ?? "", finalUrl);
    if (u) records.push({ url: u, source: "meta", alt: "", renderedWidth: 0, renderedHeight: 0, naturalWidth: 0, naturalHeight: 0 });
  });

  // Inline <style> blocks
  $("style").each((_, el) => {
    const css = $(el).html() ?? "";
    const re = /url\(\s*(['"]?)([^'")]+)\1\s*\)/g;
    let m: RegExpExecArray | null;
    while ((m = re.exec(css)) !== null) {
      const raw = m[2] ?? "";
      if (!looksLikeImageUrl(raw)) continue;
      const u = absolutize(raw, finalUrl);
      if (u) records.push({ url: u, source: "background", alt: "", renderedWidth: 0, renderedHeight: 0, naturalWidth: 0, naturalHeight: 0 });
    }
  });

  return {
    records: dedupeRawImages(records),
    finalUrl,
    pageTitle,
    scrollPasses: 0,
    warnings,
  };
}

export async function extractImages(targetUrl: string): Promise<ExtractResult> {
  const start = Date.now();
  let renderer = "playwright-chromium";
  let extraction: BrowserExtraction;

  try {
    extraction = await extractWithBrowser(targetUrl);
  } catch (err) {
    logger.warn({ err }, "Browser extraction failed, falling back to static HTML");
    renderer = "static-html";
    extraction = await extractWithStaticHtml(targetUrl);
  }

  const images = await verifyAll(extraction.records, extraction.finalUrl);

  const loadedCount = images.filter((i) => i.status === "loaded").length;
  const brokenCount = images.filter((i) => i.status === "broken").length;

  return {
    requestedUrl: targetUrl,
    finalUrl: extraction.finalUrl,
    pageTitle: extraction.pageTitle,
    durationMs: Date.now() - start,
    totalImages: images.length,
    loadedCount,
    brokenCount,
    scrollPasses: extraction.scrollPasses,
    renderer,
    warnings: extraction.warnings,
    images,
  };
}
