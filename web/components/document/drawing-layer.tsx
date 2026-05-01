"use client";

import * as React from "react";
import { AlertTriangle } from "lucide-react";
import { cn } from "@/lib/cn";
import { percentBBoxToPolygonInches } from "@/lib/bbox";
import type { DrawMode, DrawResult, DrawnRect } from "@/lib/types";

interface DrawingLayerProps {
  pageNumber: number;
  pageWidthPoints: number;
  pageHeightPoints: number;
  /**
   * Active drawing mode. Each mode tints the live-preview rectangle so the
   * user gets a continuous visual confirmation of what they're capturing.
   */
  mode: DrawMode;
  onDrawComplete: (result: DrawResult) => void;
}

const MODE_HINT: Record<DrawMode, string> = {
  field: "Click and drag over the region you want to capture",
  aggregation: "Click and drag over the numbers you want to roll up",
};

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
  mode,
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
      className="absolute inset-0 z-10 cursor-crosshair select-none"
      role="presentation"
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={() => setDrag(null)}
    >
      {preview && (
        <div
          className={cn(
            "absolute pointer-events-none rounded-[2px]",
            "border-[1.5px] border-dashed",
            mode === "aggregation"
              ? "border-agg bg-[color-mix(in_oklab,var(--color-agg)_12%,transparent)]"
              : "border-accent bg-[color-mix(in_oklab,var(--color-accent)_12%,transparent)]"
          )}
          style={{
            left: `${preview.x}%`,
            top: `${preview.y}%`,
            width: `${preview.w}%`,
            height: `${preview.h}%`,
          }}
        />
      )}
      {!drag && (
        <div
          role="status"
          className={cn(
            "absolute top-2.5 left-1/2 -translate-x-1/2",
            "inline-flex items-center gap-1.5",
            "py-[5px] px-2.5 rounded-full pointer-events-none",
            "text-[11.5px] text-white",
            "bg-[color-mix(in_oklab,var(--color-ink)_85%,transparent)]"
          )}
        >
          <AlertTriangle size={12} />
          {MODE_HINT[mode]}
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
