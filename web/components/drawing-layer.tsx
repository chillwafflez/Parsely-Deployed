"use client";

import * as React from "react";
import { AlertTriangle } from "lucide-react";
import { percentBBoxToPolygonInches } from "@/lib/bbox";
import type { DrawResult, DrawnRect } from "@/lib/types";
import styles from "./drawing-layer.module.css";

interface DrawingLayerProps {
  pageNumber: number;
  pageWidthPoints: number;
  pageHeightPoints: number;
  onDrawComplete: (result: DrawResult) => void;
}

interface DragState {
  startX: number;
  startY: number;
  currentX: number;
  currentY: number;
}

/** Minimum size in page percent for a drag to count as an intentional draw. */
const MIN_WIDTH_PERCENT = 1.5;
const MIN_HEIGHT_PERCENT = 1.0;

/**
 * Full-page-sized absolute overlay that captures mouse events when draw mode
 * is active. Renders a live dashed preview during the drag and fires
 * onDrawComplete with the final rectangle (in percent) + polygon (in inches).
 */
export function DrawingLayer({
  pageNumber,
  pageWidthPoints,
  pageHeightPoints,
  onDrawComplete,
}: DrawingLayerProps) {
  const ref = React.useRef<HTMLDivElement>(null);
  const [drag, setDrag] = React.useState<DragState | null>(null);

  const pointToPercent = React.useCallback((clientX: number, clientY: number) => {
    const rect = ref.current?.getBoundingClientRect();
    if (!rect) return { x: 0, y: 0 };
    const x = clamp(((clientX - rect.left) / rect.width) * 100);
    const y = clamp(((clientY - rect.top) / rect.height) * 100);
    return { x, y };
  }, []);

  const handleMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    // Left-click only
    if (e.button !== 0) return;
    const { x, y } = pointToPercent(e.clientX, e.clientY);
    setDrag({ startX: x, startY: y, currentX: x, currentY: y });
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!drag) return;
    const { x, y } = pointToPercent(e.clientX, e.clientY);
    setDrag({ ...drag, currentX: x, currentY: y });
  };

  const handleMouseUp = () => {
    if (!drag) return;

    const bbox = toRect(drag);
    setDrag(null);

    if (bbox.w < MIN_WIDTH_PERCENT || bbox.h < MIN_HEIGHT_PERCENT) {
      return; // treat as accidental click
    }

    const polygon = percentBBoxToPolygonInches(bbox, pageWidthPoints, pageHeightPoints);
    onDrawComplete({ pageNumber, bbox, polygon });
  };

  const preview = drag ? toRect(drag) : null;

  return (
    <div
      ref={ref}
      className={styles.layer}
      role="presentation"
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={() => setDrag(null)}
    >
      {preview && (
        <div
          className={styles.preview}
          style={{
            left: `${preview.x}%`,
            top: `${preview.y}%`,
            width: `${preview.w}%`,
            height: `${preview.h}%`,
          }}
        />
      )}
      {!drag && (
        <div className={styles.hint} role="status">
          <AlertTriangle size={12} />
          Click and drag over the region you want to capture
        </div>
      )}
    </div>
  );
}

function toRect(drag: DragState): DrawnRect {
  return {
    x: Math.min(drag.startX, drag.currentX),
    y: Math.min(drag.startY, drag.currentY),
    w: Math.abs(drag.currentX - drag.startX),
    h: Math.abs(drag.currentY - drag.startY),
  };
}

function clamp(value: number): number {
  if (value < 0) return 0;
  if (value > 100) return 100;
  return value;
}
