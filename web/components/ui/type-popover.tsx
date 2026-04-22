"use client";

import * as React from "react";
import { createPortal } from "react-dom";
import { cn } from "@/lib/cn";
import { FIELD_TYPES } from "@/lib/constants";
import type { FieldDataType } from "@/lib/types";

interface TypePopoverProps {
  anchorRect: DOMRect;
  current: string;
  onPick: (type: FieldDataType) => void;
  onClose: () => void;
}

const POPOVER_WIDTH = 220;
const POPOVER_GAP = 4;

/**
 * Portal-rendered popover anchored below a button rect. Closes on click
 * outside or Escape.
 */
export function TypePopover({ anchorRect, current, onPick, onClose }: TypePopoverProps) {
  const ref = React.useRef<HTMLDivElement>(null);
  const [mounted, setMounted] = React.useState(false);

  React.useEffect(() => {
    setMounted(true);
  }, []);

  React.useEffect(() => {
    const handleMouseDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        onClose();
      }
    };
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("mousedown", handleMouseDown);
    document.addEventListener("keydown", handleKey);
    return () => {
      document.removeEventListener("mousedown", handleMouseDown);
      document.removeEventListener("keydown", handleKey);
    };
  }, [onClose]);

  if (!mounted) return null;

  const top = anchorRect.bottom + POPOVER_GAP;
  const left = Math.min(anchorRect.left, window.innerWidth - POPOVER_WIDTH - 8);

  return createPortal(
    <div
      ref={ref}
      role="menu"
      style={{ top, left, width: POPOVER_WIDTH }}
      className={cn(
        "fixed z-50 p-1 min-w-[180px]",
        "bg-surface border border-line-strong rounded-md shadow-lg"
      )}
    >
      {FIELD_TYPES.map((t) => {
        const isActive = t.id === current;
        return (
          <button
            key={t.id}
            type="button"
            role="menuitem"
            onClick={() => onPick(t.id)}
            className={cn(
              "flex items-center gap-2 w-full py-1.5 px-2.5",
              "border-0 rounded-[4px] cursor-pointer text-left",
              "font-ui text-[12.5px] text-inherit",
              isActive
                ? "bg-accent-weak text-accent-ink"
                : "bg-transparent hover:bg-surface-2"
            )}
          >
            <span>{t.label}</span>
            <span
              className={cn(
                "font-mono text-[11px] ml-auto",
                isActive ? "text-accent-ink" : "text-ink-3"
              )}
            >
              {t.hint}
            </span>
          </button>
        );
      })}
    </div>,
    document.body
  );
}
