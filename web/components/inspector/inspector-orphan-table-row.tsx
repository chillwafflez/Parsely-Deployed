"use client";

import * as React from "react";
import { ChevronRight, Table as TableIcon } from "lucide-react";
import { cn } from "@/lib/cn";

interface InspectorOrphanTableRowProps {
  /** Synth table's name (e.g., "Transactions" / "Transactions [2]"). */
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
 * Card-shaped opener for an orphan synth table — i.e. a synthesized table
 * that has no parented Tabular field row in the regular field groups
 * (typically nested cases like `Accounts[i].Transactions`). Rendered under
 * the "Records" group. Parented synth tables use <InspectorTabularFieldRow/>
 * instead, which adopts the scalar-field row shape.
 */
export function InspectorOrphanTableRow({
  label,
  tableId,
  rowCount,
  active,
  onSelect,
}: InspectorOrphanTableRowProps) {
  const disabled = tableId === null;
  const recordLabel = `${rowCount} record${rowCount === 1 ? "" : "s"}`;

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
        "flex items-center gap-2.5",
        "px-2.5 py-2 rounded-md",
        "border transition-colors",
        "focus-visible:outline-[2px_solid_var(--color-accent)] focus-visible:outline-offset-2",
        disabled
          ? "bg-surface-2 border-line opacity-60 cursor-not-allowed"
          : active
            ? "bg-table-weak border-table-border cursor-pointer"
            : "bg-surface border-line hover:bg-surface-2 hover:border-line-strong cursor-pointer"
      )}
    >
      <div
        aria-hidden
        className={cn(
          "w-7 h-7 rounded-md grid place-items-center text-table-ink shrink-0",
          active ? "bg-surface" : "bg-table-weak"
        )}
      >
        <TableIcon size={14} />
      </div>
      <div className="min-w-0 flex-1">
        <div className="text-[12px] font-medium text-ink truncate">
          {label}
        </div>
        <div className="text-[10.5px] text-ink-3 mt-px">Open table</div>
      </div>
      <span
        className={cn(
          "inline-flex items-center px-2 py-0.5 rounded-full shrink-0",
          "text-[10px] font-medium font-mono",
          "bg-table-weak text-table-ink border border-table-border"
        )}
      >
        {recordLabel}
      </span>
      <ChevronRight
        size={12}
        aria-hidden
        className={cn(
          "text-ink-4 transition-transform shrink-0",
          active && "rotate-90"
        )}
      />
    </div>
  );
}
