import type { BoundingRegion, ConfidenceLevel, ExtractedField } from "./types";
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
