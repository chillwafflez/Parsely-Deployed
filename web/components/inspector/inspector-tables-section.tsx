"use client";

import * as React from "react";
import { Download, Table as TableIcon } from "lucide-react";
import { cn } from "@/lib/cn";
import type { ExtractedTable } from "@/lib/types";

interface InspectorTablesSectionProps {
  /** Full table set; the section filters to source==="Layout" internally so
   *  the parent doesn't need to know about Phase G's two-channel split. */
  tables: ExtractedTable[];
  /** Phase D: opens the bottom drawer to this table. */
  activeTableId: string | null;
  /** Toggle: clicking the active row sets it back to null (closes the drawer). */
  onSelectTable: (id: string) => void;
  /** CSV quick-export — no drawer round-trip. JSON export lives in the drawer. */
  onExportTable: (id: string) => void;
}

export function InspectorTablesSection({
  tables,
  activeTableId,
  onSelectTable,
  onExportTable,
}: InspectorTablesSectionProps) {
  // Visual tables only — synthesized tables surface as Tabular field rows
  // (top-level) or under the "Records" sub-header (nested orphans).
  const layoutTables = React.useMemo(
    () => tables.filter((t) => t.source === "Layout"),
    [tables]
  );

  if (layoutTables.length === 0) return null;

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
          {layoutTables.length}
        </span>
      </header>

      <div className="px-3 pb-3 flex flex-col gap-1.5">
        {layoutTables.map((table) => (
          <InspectorTableRow
            key={table.id}
            table={table}
            active={table.id === activeTableId}
            onSelect={onSelectTable}
            onExport={onExportTable}
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
  onExport: (id: string) => void;
}

function InspectorTableRow({ table, active, onSelect, onExport }: InspectorTableRowProps) {
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
        "group grid grid-cols-[auto_1fr_auto] gap-2.5 items-center",
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
      {/* Hover-revealed CSV quick-export. Always visible on focus-within so
          keyboard users get parity with mouse hover. stopPropagation keeps
          the click off the row's open-drawer handler. */}
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          onExport(table.id);
        }}
        title="Export this table as CSV"
        aria-label={`Export ${label} as CSV`}
        className={cn(
          "w-7 h-7 grid place-items-center rounded-md text-ink-3",
          "opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 transition-opacity",
          "hover:bg-surface hover:text-ink",
          "focus-visible:opacity-100 focus-visible:outline-[2px_solid_var(--color-accent)] focus-visible:outline-offset-1"
        )}
      >
        <Download size={12} />
      </button>
    </div>
  );
}
