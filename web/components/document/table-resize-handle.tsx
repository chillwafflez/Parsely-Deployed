"use client";

import * as React from "react";
import { cn } from "@/lib/cn";

/**
 * WAI-ARIA Window Splitter implementation for the bottom drawer's top edge.
 * The drawer is the "primary pane" — its size is what `aria-valuenow`
 * represents, expressed as a percentage of the host container's height.
 *
 * Keyboard contract (per the APG):
 *   ArrowUp   → grow drawer (move splitter up)
 *   ArrowDown → shrink drawer (move splitter down)
 *   Home      → snap to min (collapse)
 *   End       → snap to max
 *   Enter     → toggle collapse: at min → restore previous, else → snap to min
 *
 * Pointer drag uses refs + setPointerCapture so the move handler doesn't
 * detach when the user crosses out of the handle's hit area mid-drag.
 */
interface TableResizeHandleProps {
  /** Drawer height as a percentage of the container (15–70). */
  value: number;
  onChange: (next: number) => void;
  /** id of the drawer element this controls — required for aria-controls. */
  controlsId: string;
  /** Used by aria-label (and screen-reader announcements via aria-valuetext). */
  paneLabel: string;
  min?: number;
  max?: number;
  /** Pixels per ArrowUp/Down — translated to % via the container. */
  step?: number;
}

const DEFAULT_MIN = 15;
const DEFAULT_MAX = 70;
const DEFAULT_STEP = 4;

export function TableResizeHandle({
  value,
  onChange,
  controlsId,
  paneLabel,
  min = DEFAULT_MIN,
  max = DEFAULT_MAX,
  step = DEFAULT_STEP,
}: TableResizeHandleProps) {
  // Remembered "expanded" height for Enter-toggle restore. Seeded with the
  // current value so the first Enter at a non-min size collapses cleanly,
  // and the second Enter restores to that same height.
  const restoreRef = React.useRef<number>(Math.max(value, min + step));

  const containerHeightRef = React.useRef<number>(0);
  const dragStateRef = React.useRef<{
    startY: number;
    startValue: number;
  } | null>(null);

  const clamp = React.useCallback(
    (n: number) => Math.min(max, Math.max(min, n)),
    [min, max]
  );

  const set = React.useCallback(
    (next: number) => {
      const clamped = clamp(next);
      // Track the last "above min" height so Enter-collapse → Enter-restore
      // round-trips to the user's intended size.
      if (clamped > min) restoreRef.current = clamped;
      onChange(clamped);
    },
    [clamp, min, onChange]
  );

  const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    switch (e.key) {
      case "ArrowUp":
        e.preventDefault();
        set(value + step);
        break;
      case "ArrowDown":
        e.preventDefault();
        set(value - step);
        break;
      case "Home":
        e.preventDefault();
        set(min);
        break;
      case "End":
        e.preventDefault();
        set(max);
        break;
      case "Enter":
        e.preventDefault();
        // Tolerance handles the case where the value isn't exactly equal to
        // min after clamping (e.g., when the container size changes).
        if (value <= min + 0.5) {
          set(restoreRef.current);
        } else {
          set(min);
        }
        break;
    }
  };

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    // Ignore non-primary clicks (right-click, etc.) — don't enter drag mode.
    if (e.button !== 0) return;

    // Walk up to the closest positioned ancestor — the drawer's parent — to
    // measure the container height. The drawer + everything above lives in a
    // single flex container; that's our 100% reference for percent math.
    const handle = e.currentTarget;
    const container = handle.offsetParent as HTMLElement | null;
    if (!container) return;

    containerHeightRef.current = container.getBoundingClientRect().height;
    if (containerHeightRef.current <= 0) return;

    dragStateRef.current = { startY: e.clientY, startValue: value };
    handle.setPointerCapture(e.pointerId);
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const drag = dragStateRef.current;
    const container = containerHeightRef.current;
    if (!drag || container <= 0) return;

    // Drawer grows as the pointer moves up — invert the delta.
    const deltaPx = drag.startY - e.clientY;
    const deltaPct = (deltaPx / container) * 100;
    set(drag.startValue + deltaPct);
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!dragStateRef.current) return;
    e.currentTarget.releasePointerCapture(e.pointerId);
    dragStateRef.current = null;
  };

  return (
    <div
      role="separator"
      tabIndex={0}
      aria-orientation="horizontal"
      aria-controls={controlsId}
      aria-label={`Resize ${paneLabel}`}
      aria-valuenow={Math.round(value)}
      aria-valuemin={min}
      aria-valuemax={max}
      aria-valuetext={`${Math.round(value)} percent`}
      onKeyDown={handleKeyDown}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
      className={cn(
        "relative flex items-center justify-center",
        // 6px tall hit area — tall enough to grab without precision, thin
        // enough to read as a divider rather than a UI band.
        "h-1.5 cursor-ns-resize select-none",
        "bg-line-strong/0 hover:bg-line-strong/100 transition-colors",
        "focus-visible:outline-[2px_solid_var(--color-accent)] focus-visible:outline-offset-[-2px]"
      )}
    >
      {/* Visible grip — three short bars, common bottom-sheet affordance. */}
      <div
        aria-hidden
        className="w-10 h-[3px] rounded-full bg-line-strong"
      />
    </div>
  );
}
