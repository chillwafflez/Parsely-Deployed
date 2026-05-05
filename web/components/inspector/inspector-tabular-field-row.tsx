"use client";

import * as React from "react";
import { Lock, Pin, Trash2 } from "lucide-react";
import { cn } from "@/lib/cn";
import { confidenceLevel } from "@/lib/bbox";
import type { ExtractedField, FieldUpdate } from "@/lib/types";

interface InspectorTabularFieldRowProps {
  field: ExtractedField;
  /** Resolved synth table id; null when no matching table exists (defensive
   *  — the synthesizer only emits a Tabular field when the underlying
   *  List<Dictionary> has at least one item, so this should never trip in
   *  practice). */
  tableId: string | null;
  rowCount: number;
  /** Whether this row's table is the one currently opened in the bottom
   *  drawer. Independent of scalar field selection. */
  active: boolean;
  onSelect: (tableId: string) => void;
  onUpdate: (id: string, update: FieldUpdate) => void;
  onDelete: (id: string) => void;
}

/**
 * Synth Tabular field row. Visually mirrors <InspectorField/> so a row like
 * `TaxDetails` reads naturally next to scalar siblings (`DueDate`,
 * `InvoiceDate`, …). Differs in two ways:
 *   - Type pill is non-editable (a span, not a button) — cell data lives in
 *     the drawer, not behind a popover.
 *   - The whole row is the click target; activating it opens the drawer
 *     instead of inline-editing a value.
 *
 * Used only for parented synth tables. Orphan synth tables (under "Records")
 * still render as <InspectorOrphanTableRow/> cards.
 */
export function InspectorTabularFieldRow({
  field,
  tableId,
  rowCount,
  active,
  onSelect,
  onUpdate,
  onDelete,
}: InspectorTabularFieldRowProps) {
  const disabled = tableId === null;
  const recordLabel = `${rowCount} record${rowCount === 1 ? "" : "s"}`;

  const level = confidenceLevel(field.confidence);
  const dotTone =
    level === "high" ? "bg-ok" : level === "med" ? "bg-warn" : "bg-err";
  const confidencePct = `${Math.round(field.confidence * 100)}% confidence`;

  const handleOpen = () => {
    if (!disabled) onSelect(tableId!);
  };

  const handleKey = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (disabled) return;
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      handleOpen();
    }
  };

  return (
    <div
      role="button"
      tabIndex={disabled ? -1 : 0}
      aria-pressed={active}
      aria-disabled={disabled || undefined}
      data-confidence={level}
      onClick={handleOpen}
      onKeyDown={handleKey}
      className={cn(
        "group/field rounded-md px-2.5 py-2",
        "border transition-colors",
        "focus-visible:outline-[2px_solid_var(--color-accent)] focus-visible:outline-offset-2",
        disabled
          ? "border-transparent opacity-60 cursor-not-allowed"
          : active
            ? "bg-table-weak border-table-border cursor-pointer"
            : "border-transparent hover:bg-surface-2 cursor-pointer"
      )}
    >
      <div className="flex items-center gap-1.5">
        <span
          aria-hidden
          title={confidencePct}
          className={cn("w-1.5 h-1.5 rounded-full shrink-0", dotTone)}
        />
        <span
          className="text-[11.5px] text-ink-2 font-medium truncate"
          title={field.name}
        >
          {field.name}
        </span>
        {field.isRequired && (
          <span
            className="font-mono text-[9.5px] font-semibold tracking-[0.08em] text-err"
            title="Required field"
          >
            REQ
          </span>
        )}
        {/* Mirrors <InspectorField/>'s data-type pill, but rendered as a
            span — the type is fixed to "table"; cell data is edited in the
            drawer rather than reassigned via the popover. */}
        <span
          title="Edit cells in the table drawer"
          className={cn(
            "ml-auto font-mono text-[9.5px] px-1.5 py-px rounded",
            "bg-surface-2 border border-line text-ink-3"
          )}
        >
          table
        </span>
        <div
          className={cn(
            "flex items-center gap-px",
            "opacity-0 group-hover/field:opacity-100",
            "group-focus-within/field:opacity-100",
            "transition-opacity"
          )}
          onClick={(e) => e.stopPropagation()}
        >
          <button
            type="button"
            title={field.isRequired ? "Make optional" : "Mark required"}
            className={cn(
              "w-[18px] h-[18px] grid place-items-center rounded",
              "text-ink-3 hover:text-ink hover:bg-surface"
            )}
            onClick={() =>
              onUpdate(field.id, { isRequired: !field.isRequired })
            }
          >
            {field.isRequired ? <Lock size={11} /> : <Pin size={11} />}
          </button>
          <button
            type="button"
            title="Remove field"
            className={cn(
              "w-[18px] h-[18px] grid place-items-center rounded",
              "text-ink-3 hover:text-err hover:bg-err-weak"
            )}
            onClick={() => onDelete(field.id)}
          >
            <Trash2 size={11} />
          </button>
        </div>
      </div>

      {/* Replaces the value-edit row of <InspectorField/>. Static muted
          summary — cells live in the drawer. */}
      <div className="mt-1 font-mono text-[12px] leading-tight px-1 py-0.5 -mx-1 italic text-ink-4">
        {recordLabel}
      </div>
    </div>
  );
}
