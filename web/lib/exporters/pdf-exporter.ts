import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import { polygonInchesToPdfPoints } from "@/lib/bbox";
import { createBackgroundSampler } from "./sample-background";
import type { Exporter, FilledField, SourceMeta } from "./types";

/** Inner padding from the slot edges when drawing text (points). */
const TEXT_PADDING = 2;

/** pdf-lib won't auto-wrap long values — shrink before truncating. */
const MIN_FONT_SIZE = 6;
const MAX_FONT_SIZE = 12;

export const pdfExporter: Exporter = {
  supports: (type) => type === "pdf",
  export: exportPdf,
};

async function exportPdf(
  source: SourceMeta,
  fields: FilledField[],
  filename: string
): Promise<void> {
  const sourceBytes = await fetch(source.fileUrl).then((res) => {
    if (!res.ok) throw new Error(`Source fetch failed (${res.status})`);
    return res.arrayBuffer();
  });

  const pdfDoc = await PDFDocument.load(sourceBytes);
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);

  // pdf.js rasterizes each affected page once; the sampler reads pixel
  // strips around each bbox so masks blend with the surrounding page
  // instead of hard white. Disposed in `finally` to release the worker
  // even if pdf-lib throws mid-export.
  const sampler = await createBackgroundSampler(source.fileUrl);
  try {
    for (const field of fields) {
      const pageIndex = field.pageNumber - 1;
      if (pageIndex < 0 || pageIndex >= pdfDoc.getPageCount()) continue;

      const page = pdfDoc.getPage(pageIndex);
      // Use the CropBox (what Azure DI actually sees — the visible, clipped
      // page) as the reference frame. MediaBox/CropBox with a non-zero
      // lower-left origin would otherwise shift every mask by (cropBox.y)
      // points downward.
      const cropBox = page.getCropBox();
      const rect = polygonInchesToPdfPoints(field.polygon, {
        leftPoints: cropBox.x,
        topPoints: cropBox.y + cropBox.height,
      });
      if (!rect) continue;

      const bg = await sampler.sample(field.pageNumber, field.polygon);
      page.drawRectangle({
        x: rect.x,
        y: rect.y,
        width: rect.width,
        height: rect.height,
        color: rgb(bg.r / 255, bg.g / 255, bg.b / 255),
      });

      const value = field.value.trim();
      if (value.length === 0) continue;

      const { text, fontSize } = fitText(
        value,
        rect.width - TEXT_PADDING * 2,
        font
      );

      page.drawText(text, {
        x: rect.x + TEXT_PADDING,
        // Vertically center-ish the baseline inside the slot. pdf-lib's text
        // anchor is the baseline, so we nudge up by fontSize * 0.2 to sit
        // visually centered rather than flush-bottom.
        y: rect.y + (rect.height - fontSize) / 2 + fontSize * 0.2,
        size: fontSize,
        font,
        color: rgb(0, 0, 0),
      });
    }
  } finally {
    await sampler.dispose();
  }

  const outputBytes = await pdfDoc.save();
  triggerDownload(outputBytes, filename);
}

/**
 * Shrinks the font (down to MIN_FONT_SIZE) until the value fits, then
 * truncates with an ellipsis if it still doesn't. Returns the final text +
 * chosen font size.
 */
function fitText(
  value: string,
  maxWidthPoints: number,
  font: { widthOfTextAtSize: (t: string, s: number) => number }
): { text: string; fontSize: number } {
  for (let size = MAX_FONT_SIZE; size >= MIN_FONT_SIZE; size -= 1) {
    if (font.widthOfTextAtSize(value, size) <= maxWidthPoints) {
      return { text: value, fontSize: size };
    }
  }

  const fontSize = MIN_FONT_SIZE;
  let truncated = value;
  while (
    truncated.length > 1 &&
    font.widthOfTextAtSize(truncated + "…", fontSize) > maxWidthPoints
  ) {
    truncated = truncated.slice(0, -1);
  }
  return { text: truncated + "…", fontSize };
}

function triggerDownload(bytes: Uint8Array, filename: string): void {
  const blob = new Blob([bytes as BlobPart], { type: "application/pdf" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  URL.revokeObjectURL(url);
}
