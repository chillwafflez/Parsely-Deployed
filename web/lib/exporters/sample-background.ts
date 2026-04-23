"use client";

import { pdfjs } from "react-pdf";

/** 8-bit RGB triple in the [0, 255] range. */
export interface RgbColor {
  r: number;
  g: number;
  b: number;
}

export interface BackgroundSampler {
  /**
   * Picks a representative background color just outside the given polygon
   * on the named page. Returns white if anything goes wrong (fetch fails,
   * canvas is tainted, strips are entirely outside the page, etc.) so the
   * caller can treat this as non-throwing.
   */
  sample(pageNumber: number, polygonInches: number[]): Promise<RgbColor>;
  /** Releases the pdf.js document + any rendered canvases. */
  dispose(): Promise<void>;
}

/** Fallback when sampling fails — matches the previous hardcoded mask color. */
const FALLBACK_WHITE: RgbColor = { r: 255, g: 255, b: 255 };

/**
 * Render scale passed to `getViewport`. Higher = more sampling resolution
 * but slower rasterization. 2x is plenty for color sampling (we don't
 * care about sub-pixel detail) and keeps memory in check for multi-page
 * exports.
 */
const SAMPLE_SCALE = 2;

/**
 * Thickness of the sampling strip along each edge of the bbox, in canvas
 * pixels. 3px at 2x scale ≈ 1.5 PDF points — close enough to the bbox to
 * pick up the right background, far enough to avoid glyph anti-aliasing
 * halos.
 */
const STRIP_PX = 3;

/**
 * Creates a sampler that loads the given PDF once with pdf.js, renders
 * pages lazily on first sample, and caches rendered canvases for the
 * lifetime of the sampler. Call `dispose()` when done.
 *
 * Coordinate note: Azure DI PDF polygons are inches measured from the
 * top-left of the visible (cropped) page — exactly what pdf.js renders
 * to its canvas — so the inches → canvas-pixels conversion is a direct
 * multiply by `72 * SAMPLE_SCALE` with no origin offset needed here.
 */
export async function createBackgroundSampler(
  pdfUrl: string
): Promise<BackgroundSampler> {
  const loadingTask = pdfjs.getDocument(pdfUrl);
  const doc = await loadingTask.promise;

  // Per-page render cache. Keyed by 1-indexed page number to match Azure's
  // and pdf-lib's convention.
  const pageCache = new Map<number, RenderedPage>();

  async function renderPage(pageNumber: number): Promise<RenderedPage> {
    const cached = pageCache.get(pageNumber);
    if (cached) return cached;

    const page = await doc.getPage(pageNumber);
    const viewport = page.getViewport({ scale: SAMPLE_SCALE });

    const canvas = document.createElement("canvas");
    canvas.width = Math.floor(viewport.width);
    canvas.height = Math.floor(viewport.height);

    // willReadFrequently hints the browser to back the canvas with a CPU
    // buffer — avoids a GPU→CPU readback cost on every getImageData call.
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    if (!ctx) throw new Error("2D canvas context unavailable");

    await page.render({
      canvasContext: ctx,
      viewport,
      background: "rgb(255, 255, 255)",
    }).promise;

    // We've materialized the page to pixels — release pdf.js's internal
    // parse state for this page. Cuts memory on multi-page exports.
    page.cleanup();

    const entry: RenderedPage = { ctx, canvas };
    pageCache.set(pageNumber, entry);
    return entry;
  }

  async function sample(
    pageNumber: number,
    polygonInches: number[]
  ): Promise<RgbColor> {
    if (polygonInches.length < 8) return FALLBACK_WHITE;

    try {
      const { ctx, canvas } = await renderPage(pageNumber);
      const bounds = polygonToCanvasPixels(polygonInches);

      const channels: number[] = [];
      // Four strips: top, bottom, left, right. Left/right exclude the
      // top/bottom strip regions so corner pixels aren't double-counted.
      readStrip(
        ctx,
        canvas,
        bounds.left,
        bounds.top - STRIP_PX,
        bounds.right - bounds.left,
        STRIP_PX,
        channels
      );
      readStrip(
        ctx,
        canvas,
        bounds.left,
        bounds.bottom,
        bounds.right - bounds.left,
        STRIP_PX,
        channels
      );
      readStrip(
        ctx,
        canvas,
        bounds.left - STRIP_PX,
        bounds.top,
        STRIP_PX,
        bounds.bottom - bounds.top,
        channels
      );
      readStrip(
        ctx,
        canvas,
        bounds.right,
        bounds.top,
        STRIP_PX,
        bounds.bottom - bounds.top,
        channels
      );

      if (channels.length === 0) return FALLBACK_WHITE;
      return medianRgb(channels);
    } catch (err) {
      console.warn(
        "[pdf-export] background sampling failed; falling back to white",
        err
      );
      return FALLBACK_WHITE;
    }
  }

  return {
    sample,
    async dispose() {
      pageCache.clear();
      await doc.destroy();
    },
  };
}

interface RenderedPage {
  ctx: CanvasRenderingContext2D;
  canvas: HTMLCanvasElement;
}

interface CanvasBounds {
  left: number;
  top: number;
  right: number;
  bottom: number;
}

/** Axis-aligned bbox of an Azure polygon, projected into canvas pixel space. */
function polygonToCanvasPixels(polygonInches: number[]): CanvasBounds {
  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;
  for (let i = 0; i < polygonInches.length; i += 2) {
    const x = polygonInches[i];
    const y = polygonInches[i + 1];
    if (x < minX) minX = x;
    if (x > maxX) maxX = x;
    if (y < minY) minY = y;
    if (y > maxY) maxY = y;
  }
  const pxPerInch = 72 * SAMPLE_SCALE;
  return {
    left: Math.floor(minX * pxPerInch),
    top: Math.floor(minY * pxPerInch),
    right: Math.ceil(maxX * pxPerInch),
    bottom: Math.ceil(maxY * pxPerInch),
  };
}

/**
 * Pushes RGB triples from the canvas region into `out`. Clamps the region
 * to canvas bounds so we never call getImageData with an out-of-range rect
 * (which throws in some browsers). Silently drops the strip if no overlap.
 */
function readStrip(
  ctx: CanvasRenderingContext2D,
  canvas: HTMLCanvasElement,
  x: number,
  y: number,
  width: number,
  height: number,
  out: number[]
): void {
  const x0 = Math.max(0, x);
  const y0 = Math.max(0, y);
  const x1 = Math.min(canvas.width, x + width);
  const y1 = Math.min(canvas.height, y + height);
  if (x1 <= x0 || y1 <= y0) return;

  const data = ctx.getImageData(x0, y0, x1 - x0, y1 - y0).data;
  for (let i = 0; i < data.length; i += 4) {
    out.push(data[i], data[i + 1], data[i + 2]);
  }
}

/**
 * Per-channel median. Robust against the occasional outlier pixel sampled
 * from an adjacent glyph or line divider — mean would drag toward those.
 */
function medianRgb(channels: number[]): RgbColor {
  const n = channels.length / 3;
  const rs = new Array<number>(n);
  const gs = new Array<number>(n);
  const bs = new Array<number>(n);
  for (let i = 0; i < n; i += 1) {
    rs[i] = channels[i * 3];
    gs[i] = channels[i * 3 + 1];
    bs[i] = channels[i * 3 + 2];
  }
  rs.sort(numericCompare);
  gs.sort(numericCompare);
  bs.sort(numericCompare);
  const mid = Math.floor(n / 2);
  return { r: rs[mid], g: gs[mid], b: bs[mid] };
}

function numericCompare(a: number, b: number): number {
  return a - b;
}
