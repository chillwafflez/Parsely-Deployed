"use client";

import * as React from "react";
import { ChevronRight, Table as TableIcon } from "lucide-react";
import { cn } from "@/lib/cn";

interface InspectorTabularRowProps {
  /** Display label — for parented rows this is the originating field name
   *  (e.g., "Items"); for orphan rows under "Records" it's the synth table's
   *  name (e.g., "Transactions" / "Transactions [2]"). */
  label: string;
  /** Resolved synth table id; null when no matching table exists (defensive
   *  — should not happen in practice since EmitFields only emits a Tabular
   *  field when the underlying List<Dictionary> has at least one item). */
  tableId: string | null;
  rowCount: number;
  active: boolean;
  onSelect: (tableId: string) => void;
}

/**
 * Phase G — clickable opener for a synthesized table. Replaces inline
 * editing for `List<Dictionary>` fields: the actual data lives in the synth
 * table cells, edits happen in the bottom drawer's grid. Visually consistent
 * with <see cref="InspectorTableRow"/> in the Tables section, but rendered
 * inside the field section (parented to a Tabular field) or under the
 * "Records" sub-header (orphan, e.g. nested Transactions).
 */
export function InspectorTabularRow({
  label,
  tableId,
  rowCount,
  active,
  onSelect,
}: InspectorTabularRowProps) {
  const disabled = tableId === null;
  const recordLabel = `${rowCount} record${rowCount === 1 ? "" : "s"}`;

  // role=button + Enter/Space matches the sibling InspectorTableRow pattern,
  // so keyboard users get the same affordance as in the Tables section.
  const handleKey = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (disabled) return;
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      onSelect(tableId!);
    }
  };

  return (
    <div
      role="button"
      tabIndex={disabled ? -1 : 0}
      aria-pressed={active}
      aria-disabled={disabled || undefined}
      onClick={disabled ? undefined : () => onSelect(tableId!)}
      onKeyDown={handleKey}
      className={cn(
        "group grid grid-cols-[auto_1fr_auto_auto] gap-2.5 items-center",
        "mx-3 my-1 px-2.5 py-2 rounded-md",
        "border transition-colors",
        "focus-visible:outline-[2px_solid_var(--color-accent)] focus-visible:outline-offset-2",
        disabled
          ? "bg-surface-2 border-line opacity-60 cursor-not-allowed"
          : active
            ? "bg-table-weak border-table-border cursor-pointer"
            : "bg-surface-2 border-line hover:bg-surface cursor-pointer"
      )}
    >
      <div
        aria-hidden
        className={cn(
          "w-[26px] h-[26px] rounded-[5px]",
          "grid place-items-center text-table-ink",
          "border",
          active ? "bg-surface border-table-border" : "bg-surface border-line"
        )}
      >
        <TableIcon size={13} />
      </div>
      <div className="min-w-0">
        <div className="text-[12.5px] font-medium text-ink truncate">
          {label}
        </div>
        <div className="text-[11px] text-ink-3 mt-px">Open table</div>
      </div>
      <span
        className={cn(
          "inline-flex items-center px-2 py-0.5 rounded-full",
          "text-[10.5px] font-mono font-medium",
          "bg-table-weak text-table-ink border border-table-border"
        )}
      >
        {recordLabel}
      </span>
      <ChevronRight
        size={14}
        aria-hidden
        className={cn(
          "text-ink-3 transition-transform",
          active && "rotate-90"
        )}
      />
    </div>
  );
}
