// @ts-nocheck
/* eslint-disable */
/**
 * This module exports a function that is serialized and run inside the
 * Playwright browser context. It must NOT be imported for use in Node —
 * `window`/`document` only exist in the browser. TypeScript checking is
 * disabled here because the file references DOM globals.
 */

export interface RawImage {
  url: string;
  source: string;
  alt: string;
  renderedWidth: number;
  renderedHeight: number;
  naturalWidth: number;
  naturalHeight: number;
}

export function collectImagesInPage(baseUrl: string): RawImage[] {
  const out: RawImage[] = [];

  function abs(u: string | null | undefined): string {
    if (!u) return "";
    try {
      if (u.startsWith("data:")) return u;
      return new URL(u, baseUrl).toString();
    } catch {
      return "";
    }
  }

  function pushIf(
    url: string,
    source: string,
    alt: string,
    rw: number,
    rh: number,
    nw: number,
    nh: number,
  ) {
    if (!url) return;
    out.push({
      url,
      source,
      alt: alt || "",
      renderedWidth: rw || 0,
      renderedHeight: rh || 0,
      naturalWidth: nw || 0,
      naturalHeight: nh || 0,
    });
  }

  const imgs = document.querySelectorAll("img");
  imgs.forEach((img) => {
    const alt = img.alt ?? "";
    const rect = img.getBoundingClientRect();
    const rw = Math.round(rect.width);
    const rh = Math.round(rect.height);
    const nw = img.naturalWidth || 0;
    const nh = img.naturalHeight || 0;

    const currentSrc = abs(img.currentSrc || img.src || "");
    if (currentSrc) pushIf(currentSrc, "img", alt, rw, rh, nw, nh);

    const srcset = img.getAttribute("srcset");
    if (srcset) {
      srcset.split(",").forEach((part) => {
        const u = abs(part.trim().split(/\s+/)[0] || "");
        if (u) pushIf(u, "srcset", alt, rw, rh, nw, nh);
      });
    }

    const lazyAttrs = ["data-src", "data-lazy-src", "data-original", "data-srcset", "data-lazy"];
    lazyAttrs.forEach((attr) => {
      const v = img.getAttribute(attr);
      if (!v) return;
      if (attr.includes("srcset")) {
        v.split(",").forEach((part) => {
          const u = abs(part.trim().split(/\s+/)[0] || "");
          if (u) pushIf(u, "data-src", alt, rw, rh, nw, nh);
        });
      } else {
        const u = abs(v);
        if (u) pushIf(u, "data-src", alt, rw, rh, nw, nh);
      }
    });
  });

  const pictureSources = document.querySelectorAll("picture source");
  pictureSources.forEach((source) => {
    const srcset = source.getAttribute("srcset");
    if (!srcset) return;
    srcset.split(",").forEach((part) => {
      const u = abs(part.trim().split(/\s+/)[0] || "");
      if (u) pushIf(u, "picture", "", 0, 0, 0, 0);
    });
  });

  const videos = document.querySelectorAll("video[poster]");
  videos.forEach((v) => {
    const u = abs(v.getAttribute("poster"));
    if (u) pushIf(u, "video-poster", "", 0, 0, 0, 0);
  });

  const all = document.querySelectorAll("*");
  const bgRe = /url\(\s*(['"]?)([^'")]+)\1\s*\)/g;
  all.forEach((el) => {
    const cs = window.getComputedStyle(el);
    const bg = cs.backgroundImage;
    if (!bg || bg === "none") return;
    let m: RegExpExecArray | null;
    bgRe.lastIndex = 0;
    while ((m = bgRe.exec(bg)) !== null) {
      const u = abs(m[2] ?? "");
      if (!u) continue;
      const rect = el.getBoundingClientRect();
      pushIf(u, "background", "", Math.round(rect.width), Math.round(rect.height), 0, 0);
    }
  });

  const metas = document.querySelectorAll(
    'meta[property="og:image"], meta[property="og:image:url"], meta[property="og:image:secure_url"], meta[name="twitter:image"], meta[name="twitter:image:src"]',
  );
  metas.forEach((m) => {
    const u = abs(m.getAttribute("content"));
    if (u) pushIf(u, "meta", "", 0, 0, 0, 0);
  });

  const linkImg = document.querySelectorAll('link[rel="image_src"]');
  linkImg.forEach((l) => {
    const u = abs(l.getAttribute("href"));
    if (u) pushIf(u, "meta", "", 0, 0, 0, 0);
  });

  return out;
}

export async function scrollPageForLazyLoad(): Promise<number> {
  const distance = 600;
  const maxPasses = 40;
  let passes = 0;
  let lastHeight = 0;
  let stableLoops = 0;
  for (let i = 0; i < maxPasses; i++) {
    window.scrollBy(0, distance);
    passes++;
    await new Promise((r) => setTimeout(r, 200));
    const h = document.documentElement.scrollHeight;
    if (h === lastHeight) {
      stableLoops++;
      if (stableLoops >= 3 && window.scrollY + window.innerHeight >= h - 4) {
        break;
      }
    } else {
      stableLoops = 0;
      lastHeight = h;
    }
  }
  window.scrollTo(0, 0);
  await new Promise((r) => setTimeout(r, 250));
  return passes;
}
