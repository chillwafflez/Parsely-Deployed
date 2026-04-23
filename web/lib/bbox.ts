import type {
  BoundingRegion,
  ConfidenceLevel,
  DrawnRect,
  ExtractedField,
} from "./types";
import { CONFIDENCE_THRESHOLDS } from "./constants";

/** Axis-aligned bounding rectangle in page-percent coordinates. */
export interface BBoxPercent {
  x: number;
  y: number;
  w: number;
  h: number;
}

/**
 * Converts an Azure Document Intelligence polygon (flat x,y pairs in inches)
 * to a percentage-of-page rectangle using the PDF page dimensions (in points
 * at scale 1, which is 72 points/inch).
 *
 * Azure DI returns a 4-corner polygon which may be slightly non-rectangular.
 * We take the axis-aligned bounding box for simplicity.
 */
export function polygonToPercentBBox(
  polygon: number[],
  pageWidthPoints: number,
  pageHeightPoints: number
): BBoxPercent | null {
  if (polygon.length < 8 || pageWidthPoints <= 0 || pageHeightPoints <= 0) {
    return null;
  }

  const pageWidthInches = pageWidthPoints / 72;
  const pageHeightInches = pageHeightPoints / 72;

  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;

  for (let i = 0; i < polygon.length; i += 2) {
    const x = polygon[i];
    const y = polygon[i + 1];
    if (x < minX) minX = x;
    if (x > maxX) maxX = x;
    if (y < minY) minY = y;
    if (y > maxY) maxY = y;
  }

  return {
    x: (minX / pageWidthInches) * 100,
    y: (minY / pageHeightInches) * 100,
    w: ((maxX - minX) / pageWidthInches) * 100,
    h: ((maxY - minY) / pageHeightInches) * 100,
  };
}

/** Picks the first bounding region on a specific page, or the first region overall. */
export function primaryRegion(field: ExtractedField, pageNumber?: number): BoundingRegion | null {
  if (field.boundingRegions.length === 0) return null;
  if (pageNumber !== undefined) {
    const onPage = field.boundingRegions.find((r) => r.pageNumber === pageNumber);
    if (onPage) return onPage;
  }
  return field.boundingRegions[0];
}

export function confidenceLevel(confidence: number): ConfidenceLevel {
  if (confidence >= CONFIDENCE_THRESHOLDS.high) return "high";
  if (confidence >= CONFIDENCE_THRESHOLDS.medium) return "med";
  return "low";
}

/**
 * Inverse of polygonToPercentBBox — converts a user-drawn rectangle in
 * page-percent coordinates to an 8-value polygon in inches (the format
 * Azure DI uses). Produces an axis-aligned quadrilateral with corners
 * ordered top-left, top-right, bottom-right, bottom-left.
 */
export function percentBBoxToPolygonInches(
  bbox: DrawnRect,
  pageWidthPoints: number,
  pageHeightPoints: number
): number[] {
  const pageWidthInches = pageWidthPoints / 72;
  const pageHeightInches = pageHeightPoints / 72;

  const xLeft = (bbox.x / 100) * pageWidthInches;
  const xRight = ((bbox.x + bbox.w) / 100) * pageWidthInches;
  const yTop = (bbox.y / 100) * pageHeightInches;
  const yBottom = ((bbox.y + bbox.h) / 100) * pageHeightInches;

  return [xLeft, yTop, xRight, yTop, xRight, yBottom, xLeft, yBottom];
}

/** Axis-aligned rectangle in pdf-lib coordinates (points, bottom-left origin). */
export interface BBoxPdfPoints {
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * Origin of the visible page in pdf-lib content-space. Pass values from
 * `page.getCropBox()`:
 *   leftPoints = cropBox.x
 *   topPoints  = cropBox.y + cropBox.height
 * These account for PDFs whose MediaBox/CropBox aren't anchored at (0, 0).
 */
export interface PdfPageOrigin {
  leftPoints: number;
  topPoints: number;
}

/**
 * Converts an Azure DI polygon (inches, measured from the TOP-LEFT of the
 * visible/cropped page) into a rectangle in pdf-lib content-space (points,
 * bottom-left origin).
 *
 * Two conversions in one step — getting either wrong is the single most
 * common bug when overlaying on a PDF:
 *   1. inches → points: multiply by 72
 *   2. top-left Y → bottom-left Y using the CropBox's top as reference,
 *      NOT page height. When MediaBox/CropBox has a non-zero y origin
 *      (common in A4/non-zero-origin PDFs), using `pageHeight - y*72`
 *      draws the rectangle shifted downward by `cropBox.y` points.
 *
 * Azure returns a 4-corner polygon that may be slightly non-rectangular;
 * we take the axis-aligned bounding box to keep rendering simple.
 */
export function polygonInchesToPdfPoints(
  polygon: number[],
  origin: PdfPageOrigin
): BBoxPdfPoints | null {
  if (polygon.length < 8) return null;

  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;

  for (let i = 0; i < polygon.length; i += 2) {
    const x = polygon[i];
    const y = polygon[i + 1];
    if (x < minX) minX = x;
    if (x > maxX) maxX = x;
    if (y < minY) minY = y;
    if (y > maxY) maxY = y;
  }

  return {
    x: origin.leftPoints + minX * 72,
    y: origin.topPoints - maxY * 72,
    width: (maxX - minX) * 72,
    height: (maxY - minY) * 72,
  };
}
