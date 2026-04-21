"use client";

import { cn } from "@/lib/cn";
import { confidenceLevel, polygonToPercentBBox, primaryRegion } from "@/lib/bbox";
import type { ExtractedField } from "@/lib/types";
import styles from "./bounding-box-overlay.module.css";

interface BoundingBoxOverlayProps {
  pageNumber: number;
  pageWidthPoints: number;
  pageHeightPoints: number;
  fields: ExtractedField[];
  selectedFieldId: string | null;
  onSelectField: (id: string | null) => void;
}

/**
 * Overlay positioned absolutely over a PDF page. Renders one bounding box
 * per field whose primary region is on this page, color-coded by confidence.
 */
export function BoundingBoxOverlay({
  pageNumber,
  pageWidthPoints,
  pageHeightPoints,
  fields,
  selectedFieldId,
  onSelectField,
}: BoundingBoxOverlayProps) {
  return (
    <div
      className={styles.overlay}
      onClick={() => onSelectField(null)}
      aria-hidden="true"
    >
      {fields.map((field) => {
        const region = primaryRegion(field, pageNumber);
        if (!region || region.pageNumber !== pageNumber) return null;

        const bbox = polygonToPercentBBox(region.polygon, pageWidthPoints, pageHeightPoints);
        if (!bbox) return null;

        const level = confidenceLevel(field.confidence);
        const isSelected = field.id === selectedFieldId;
        const confidenceLabel = `${(field.confidence * 100).toFixed(0)}%`;

        return (
          <button
            type="button"
            key={field.id}
            className={cn(styles.bbox, isSelected && styles.selected)}
            data-confidence={level}
            style={{
              left: `${bbox.x}%`,
              top: `${bbox.y}%`,
              width: `${bbox.w}%`,
              height: `${bbox.h}%`,
            }}
            onClick={(e) => {
              e.stopPropagation();
              onSelectField(field.id);
            }}
            aria-label={`${field.name} · ${confidenceLabel} confidence`}
          >
            <span className={styles.tag}>
              {field.name} · {confidenceLabel}
            </span>
            {field.confidence < 0.7 && (
              <span className={styles.warn} aria-hidden="true">
                !
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
