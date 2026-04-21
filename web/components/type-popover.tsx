"use client";

import * as React from "react";
import { createPortal } from "react-dom";
import { cn } from "@/lib/cn";
import { FIELD_TYPES } from "@/lib/constants";
import type { FieldDataType } from "@/lib/types";
import styles from "./type-popover.module.css";

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
      className={styles.popover}
      role="menu"
      style={{ top, left, width: POPOVER_WIDTH }}
    >
      {FIELD_TYPES.map((t) => (
        <button
          key={t.id}
          type="button"
          role="menuitem"
          className={cn(styles.item, t.id === current && styles.itemActive)}
          onClick={() => onPick(t.id)}
        >
          <span>{t.label}</span>
          <span className={styles.hint}>{t.hint}</span>
        </button>
      ))}
    </div>,
    document.body
  );
}
