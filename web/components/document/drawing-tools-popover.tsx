"use client";

import * as React from "react";
import { Sigma, Square, Table } from "lucide-react";
import { cn } from "@/lib/cn";
import type { DrawMode } from "@/lib/types";

interface DrawingToolsPopoverProps {
  /** Currently-selected mode highlighted in the list. Null = none active. */
  activeMode: DrawMode | null;
  onSelect: (mode: DrawMode) => void;
  onClose: () => void;
}

interface ToolItem {
  id: DrawMode | "table";
  icon: React.ReactNode;
  title: string;
  description: string;
  shortcut: string;
  disabled?: boolean;
}

const ITEMS: ToolItem[] = [
  {
    id: "field",
    icon: <Square size={16} />,
    title: "Draw field",
    description: "Capture a single value — text, number, date.",
    shortcut: "F",
  },
  {
    id: "aggregation",
    icon: <Sigma size={16} />,
    title: "Draw aggregation",
    description: "Compute sum, average, count, min/max over a region of numbers.",
    shortcut: "A",
  },
  {
    id: "table",
    icon: <Table size={16} />,
    title: "Draw table",
    description: "Frame a missed table and define columns by hand.",
    shortcut: "T",
    disabled: true,
  },
];

/**
 * Anchor-sibling popover triggered by the toolbar's draw chevron. Closes on
 * outside click or Escape; arrow keys navigate, Enter activates. Designed to
 * be rendered inside a <c>relative</c>-positioned wrapper that already
 * contains the trigger button.
 */
export function DrawingToolsPopover({
  activeMode,
  onSelect,
  onClose,
}: DrawingToolsPopoverProps) {
  const ref = React.useRef<HTMLDivElement>(null);

  // Close on outside click. mousedown (rather than click) so a click on the
  // trigger button below doesn't immediately re-open after we close.
  React.useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (!ref.current) return;
      if (ref.current.contains(e.target as Node)) return;
      onClose();
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [onClose]);

  // Escape closes; doesn't propagate so a parent Esc-handler doesn't also fire.
  React.useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        onClose();
      }
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [onClose]);

  return (
    <div
      ref={ref}
      role="menu"
      aria-label="Drawing tools"
      className={cn(
        "absolute right-0 top-full mt-1.5 z-50 w-[300px]",
        "bg-surface border border-line rounded-lg shadow-lg",
        "py-1.5"
      )}
    >
      <div className="px-3 py-1.5 text-[10px] font-semibold tracking-[0.06em] uppercase text-ink-3">
        Drawing tools
      </div>
      {ITEMS.map((item) => {
        const isActive = !item.disabled && activeMode === item.id;
        return (
          <button
            key={item.id}
            type="button"
            role="menuitem"
            disabled={item.disabled}
            onClick={() => {
              if (item.disabled) return;
              onSelect(item.id as DrawMode);
            }}
            className={cn(
              "w-full flex items-center gap-2.5 px-3 py-2 text-left",
              "transition-colors",
              item.disabled
                ? "opacity-50 cursor-not-allowed"
                : "hover:bg-surface-2 cursor-pointer",
              isActive && "bg-accent-weak"
            )}
          >
            <span
              className={cn(
                "flex items-center justify-center w-7 h-7 rounded-md shrink-0",
                "bg-surface-2 text-ink-2",
                isActive && "bg-accent text-accent-ink"
              )}
            >
              {item.icon}
            </span>
            <span className="flex-1 min-w-0">
              <span className="block text-[12.5px] font-medium text-ink leading-tight">
                {item.title}
                {item.disabled && (
                  <span className="ml-1.5 text-[10px] font-normal text-ink-3">
                    soon
                  </span>
                )}
              </span>
              <span className="block text-[11px] text-ink-3 mt-0.5 leading-tight">
                {item.description}
              </span>
            </span>
            <span
              className={cn(
                "shrink-0 px-1.5 py-0.5 rounded text-[10px] font-mono font-medium",
                "bg-surface-2 text-ink-3 border border-line"
              )}
            >
              {item.shortcut}
            </span>
          </button>
        );
      })}
    </div>
  );
}
