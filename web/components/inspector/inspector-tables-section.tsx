"use client";

import * as React from "react";
import { Table as TableIcon } from "lucide-react";
import { cn } from "@/lib/cn";
import type { ExtractedTable } from "@/lib/types";

interface InspectorTablesSectionProps {
  tables: ExtractedTable[];
  /** Phase D: opens the bottom drawer to this table. Phase C: just visual. */
  activeTableId: string | null;
  /** Toggle: clicking the active row sets it back to null (drawer-close in Phase D). */
  onSelectTable: (id: string) => void;
}

export function InspectorTablesSection({
  tables,
  activeTableId,
  onSelectTable,
}: InspectorTablesSectionProps) {
  return (
    <section className="border-t border-line">
      <header
        className={cn(
          "flex items-center gap-2",
          "px-3.5 pt-3 pb-1.5",
          "text-[10.5px] font-semibold uppercase tracking-[0.06em]",
          "text-ink-3"
        )}
      >
        <span
          aria-hidden
          className="w-1.5 h-1.5 rounded-full bg-table"
        />
        <span>Tables</span>
        <span className="font-mono font-medium text-ink-4 text-[11px]">
          {tables.length}
        </span>
      </header>

      <div className="px-3 pb-3 flex flex-col gap-1.5">
        {tables.map((table) => (
          <InspectorTableRow
            key={table.id}
            table={table}
            active={table.id === activeTableId}
            onSelect={onSelectTable}
          />
        ))}
      </div>
    </section>
  );
}

interface InspectorTableRowProps {
  table: ExtractedTable;
  active: boolean;
  onSelect: (id: string) => void;
}

function InspectorTableRow({ table, active, onSelect }: InspectorTableRowProps) {
  // Tables don't carry user-friendly names from Azure DI — the source of
  // record is just detection order. "Table N" is good enough for V1; renaming
  // can land alongside the table-rules feature in a later iteration.
  const label = `Table ${table.index + 1}`;
  const meta = `pg ${table.pageNumber} · ${table.rowCount}×${table.columnCount}`;

  // role=button + Enter/Space keyboard handler, mirroring the sidebar template
  // card pattern: keeps the row keyboard-reachable without nesting interactive
  // elements (Phase D will add a kebab/download button inside this row).
  const handleKey = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      onSelect(table.id);
    }
  };

  return (
    <div
      role="button"
      tabIndex={0}
      aria-pressed={active}
      onClick={() => onSelect(table.id)}
      onKeyDown={handleKey}
      className={cn(
        "grid grid-cols-[auto_1fr] gap-2.5 items-center",
        "px-2.5 py-2 rounded-md cursor-pointer",
        "border transition-colors",
        "focus-visible:outline-[2px_solid_var(--color-accent)] focus-visible:outline-offset-2",
        active
          ? "bg-table-weak border-table-border"
          : "bg-surface-2 border-line hover:bg-surface"
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
        <div className="text-[11px] text-ink-3 mt-px font-mono">{meta}</div>
      </div>
    </div>
  );
}
