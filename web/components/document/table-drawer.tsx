"use client";

import * as React from "react";
import { Table as TableIcon, X } from "lucide-react";
import { cn } from "@/lib/cn";
import { isTableCellSelection, type Selection } from "@/lib/selection";
import type { ExtractedTable } from "@/lib/types";
import { TableGrid } from "./table-grid";
import { TableResizeHandle } from "./table-resize-handle";

interface TableDrawerProps {
  /** Full set of tables on the document; drives the tab strip. */
  tables: ExtractedTable[];
  activeTableId: string;
  onSelectTable: (id: string) => void;
  /** Closes the drawer entirely (parent should null out activeTableId). */
  onClose: () => void;
  selection: Selection | null;
  onSelect: (selection: Selection | null) => void;
}

const STORAGE_KEY = "table-drawer-height-percent";
const DEFAULT_HEIGHT = 38;
const MIN_HEIGHT = 15;
const MAX_HEIGHT = 70;
const DRAWER_DOM_ID = "table-drawer";

export function TableDrawer({
  tables,
  activeTableId,
  onSelectTable,
  onClose,
  selection,
  onSelect,
}: TableDrawerProps) {
  const [heightPct, setHeightPct] = React.useState<number>(DEFAULT_HEIGHT);

  // Restore the persisted height on mount; tolerate parse errors and
  // out-of-range values silently — they fall back to the default.
  React.useEffect(() => {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (!stored) return;
    const parsed = Number.parseFloat(stored);
    if (Number.isFinite(parsed) && parsed >= MIN_HEIGHT && parsed <= MAX_HEIGHT) {
      setHeightPct(parsed);
    }
  }, []);

  // Debounce-free persist: the splitter handler clamps before calling, so
  // every value that lands here is already valid.
  React.useEffect(() => {
    window.localStorage.setItem(STORAGE_KEY, String(heightPct));
  }, [heightPct]);

  const activeTable = tables.find((t) => t.id === activeTableId);
  if (!activeTable) return null;

  const handleSelectCell = (rowIndex: number, columnIndex: number) => {
    onSelect({
      kind: "tableCell",
      tableId: activeTableId,
      rowIndex,
      columnIndex,
    });
  };

  const selectedCellLabel = isTableCellSelection(selection) && selection.tableId === activeTableId
    ? `R${selection.rowIndex + 1} · C${selection.columnIndex + 1} selected`
    : `${activeTable.rowCount} rows · ${activeTable.columnCount} columns`;

  return (
    <div
      id={DRAWER_DOM_ID}
      role="region"
      aria-label="Extracted tables"
      style={{ height: `${heightPct}%` }}
      className={cn(
        "shrink-0 flex flex-col min-h-0",
        "bg-surface border-t border-line"
      )}
    >
      <TableResizeHandle
        value={heightPct}
        onChange={setHeightPct}
        controlsId={DRAWER_DOM_ID}
        paneLabel="tables drawer"
        min={MIN_HEIGHT}
        max={MAX_HEIGHT}
      />

      <div
        className={cn(
          "flex items-end gap-0 px-3.5",
          "border-b border-line bg-surface-2"
        )}
      >
        <div role="tablist" aria-label="Detected tables" className="flex items-end gap-0">
          {tables.map((table) => (
            <DrawerTab
              key={table.id}
              table={table}
              active={table.id === activeTableId}
              onSelect={() => onSelectTable(table.id)}
            />
          ))}
        </div>

        <div className="flex-1" />

        <div className="flex items-center gap-2 py-2">
          <span className="text-[11.5px] text-ink-3">{selectedCellLabel}</span>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close tables drawer"
            className={cn(
              "w-7 h-7 grid place-items-center rounded-md text-ink-3",
              "hover:bg-surface hover:text-ink",
              "focus-visible:outline-[2px_solid_var(--color-accent)] focus-visible:outline-offset-2"
            )}
          >
            <X size={13} />
          </button>
        </div>
      </div>

      <TableGrid
        table={activeTable}
        selection={selection}
        onSelectCell={handleSelectCell}
      />

      <div
        className={cn(
          "flex items-center gap-2.5 px-3.5 py-1.5",
          "border-t border-line bg-surface-2",
          "text-[11.5px] text-ink-3"
        )}
      >
        <span
          className={cn(
            "inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full",
            "bg-table-weak text-table-ink border border-table-border",
            "text-[10.5px] font-medium"
          )}
        >
          <span aria-hidden className="w-1.5 h-1.5 rounded-full bg-table" />
          Auto-detected
        </span>
        <span aria-hidden>·</span>
        <span className="font-mono">
          {activeTable.cells.length} cells
        </span>
      </div>
    </div>
  );
}

interface DrawerTabProps {
  table: ExtractedTable;
  active: boolean;
  onSelect: () => void;
}

function DrawerTab({ table, active, onSelect }: DrawerTabProps) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      onClick={onSelect}
      className={cn(
        "h-9 px-3.5 inline-flex items-center gap-1.5",
        "text-[12.5px] border-b-2 -mb-px",
        "focus-visible:outline-[2px_solid_var(--color-accent)] focus-visible:outline-offset-[-2px]",
        active
          ? "bg-surface text-ink font-semibold border-table"
          : "bg-transparent text-ink-3 font-medium border-transparent hover:text-ink"
      )}
    >
      <TableIcon size={11} className="text-table" aria-hidden />
      <span>Table {table.index + 1}</span>
      <span className="font-mono text-[10.5px] text-ink-4 ml-0.5">
        {table.rowCount}×{table.columnCount}
      </span>
    </button>
  );
}
