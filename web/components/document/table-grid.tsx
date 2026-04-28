"use client";

import * as React from "react";
import { cn } from "@/lib/cn";
import { useInlineEdit } from "@/lib/hooks/use-inline-edit";
import { isTableCellSelection, type Selection } from "@/lib/selection";
import type { ExtractedTable, TableCell } from "@/lib/types";

interface TableGridProps {
  table: ExtractedTable;
  selection: Selection | null;
  onSelectCell: (rowIndex: number, columnIndex: number) => void;
  /** Commits a cell edit. content === "" is treated as an explicit clear (null). */
  onCommitCell: (
    rowIndex: number,
    columnIndex: number,
    content: string | null
  ) => void;
}

/**
 * Renders an ExtractedTable as an HTML <table>. Each cell is independently
 * editable via the shared <see cref="useInlineEdit"/> hook — click selects
 * + enters edit mode, Enter commits, Esc cancels, blur commits.
 *
 * Merged cells: Azure DI emits a single record at the top-left of the merged
 * region with rowSpan/columnSpan. Other positions don't have their own
 * record; the natural HTML rowspan/colspan attributes give us the correct
 * visual without iterating "covered" positions explicitly.
 */
export function TableGrid({
  table,
  selection,
  onSelectCell,
  onCommitCell,
}: TableGridProps) {
  const grid = React.useMemo(() => buildGrid(table), [table]);
  const selectedCell = isTableCellSelection(selection) && selection.tableId === table.id
    ? { row: selection.rowIndex, col: selection.columnIndex }
    : null;

  return (
    <div className="flex-1 overflow-auto bg-surface">
      <table className="border-collapse text-[12.5px] font-ui min-w-full">
        <tbody>
          {Array.from({ length: table.rowCount }, (_, rowIndex) => (
            <tr key={rowIndex}>
              <td
                className={cn(
                  "w-9 px-2 py-1.5 text-right",
                  "font-mono text-[10.5px] text-ink-4",
                  "bg-surface-2 border-b border-r border-line",
                  "select-none"
                )}
                aria-hidden
              >
                {rowIndex + 1}
              </td>

              {Array.from({ length: table.columnCount }, (_, columnIndex) => {
                const cell = grid[rowIndex][columnIndex];
                if (!cell) return null;

                const isHeader = cell.kind === "columnHeader" || cell.kind === "rowHeader";
                const isSelected =
                  selectedCell?.row === rowIndex && selectedCell?.col === columnIndex;

                return (
                  <CellView
                    // Keying by (row, col) lets useInlineEdit's local draft
                    // state stay scoped to a single cell — no leak between
                    // adjacent cells when selection moves.
                    key={`${rowIndex}-${columnIndex}`}
                    cell={cell}
                    isHeader={isHeader}
                    isSelected={isSelected}
                    onSelect={() => onSelectCell(rowIndex, columnIndex)}
                    onCommit={(next) => onCommitCell(rowIndex, columnIndex, next)}
                  />
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

interface CellViewProps {
  cell: TableCell;
  isHeader: boolean;
  isSelected: boolean;
  onSelect: () => void;
  /** Receives null only when the user explicitly clears the cell (empty string). */
  onCommit: (content: string | null) => void;
}

function CellView({ cell, isHeader, isSelected, onSelect, onCommit }: CellViewProps) {
  const value = cell.content ?? "";

  // Empty string commits as null so the backend's "no-op when content
  // unchanged" check works symmetrically — clearing a null cell stays a no-op.
  const handleCommit = React.useCallback(
    (next: string) => {
      onCommit(next === "" ? null : next);
    },
    [onCommit]
  );

  // Cancel-on-Esc is wired through `handleKeyDown` from the hook, so we
  // don't need to surface `cancel` directly here.
  const { editing, draft, setDraft, inputRef, startEditing, commit, handleKeyDown } =
    useInlineEdit({ value, onCommit: handleCommit });

  const handleClick = () => {
    onSelect();
    if (!editing) startEditing();
  };

  return (
    <td
      rowSpan={cell.rowSpan > 1 ? cell.rowSpan : undefined}
      colSpan={cell.columnSpan > 1 ? cell.columnSpan : undefined}
      // Click on the <td> body — but the inline input gets its own
      // stopPropagation so typing in the field doesn't re-enter edit mode
      // or steal focus from itself.
      onClick={handleClick}
      onDoubleClick={(e) => e.stopPropagation()}
      className={cn(
        "border-b border-r border-line align-top cursor-text",
        "min-w-[80px] max-w-[320px]",
        "p-0",
        isHeader && !editing && "bg-surface-2 font-semibold text-ink",
        cell.isCorrected && !editing && "bg-table-weak/40",
        isSelected && !editing && "outline outline-2 outline-table -outline-offset-2 bg-table-weak",
        editing && "outline outline-2 outline-accent -outline-offset-2 bg-surface"
      )}
      title={!editing ? cell.content ?? "" : undefined}
    >
      {editing ? (
        <input
          ref={inputRef}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => {
            // Stop bubble so Enter/Esc inside the input doesn't trigger
            // ancestor handlers (e.g., a containing button's onClick).
            e.stopPropagation();
            handleKeyDown(e);
          }}
          onClick={(e) => e.stopPropagation()}
          aria-label={`Edit cell row ${cell.rowIndex + 1}, column ${cell.columnIndex + 1}`}
          className={cn(
            "w-full h-full px-2.5 py-1.5",
            "bg-transparent border-0 outline-none",
            "font-ui text-[12.5px] text-ink"
          )}
        />
      ) : (
        <div
          className={cn(
            "px-2.5 py-1.5 whitespace-nowrap overflow-hidden text-ellipsis"
          )}
        >
          {cell.content || (
            <span className="text-ink-4 italic">—</span>
          )}
        </div>
      )}
    </td>
  );
}

function buildGrid(table: ExtractedTable): (TableCell | null)[][] {
  const grid: (TableCell | null)[][] = Array.from(
    { length: table.rowCount },
    () => Array<TableCell | null>(table.columnCount).fill(null)
  );
  for (const cell of table.cells) {
    if (
      cell.rowIndex >= 0 &&
      cell.rowIndex < table.rowCount &&
      cell.columnIndex >= 0 &&
      cell.columnIndex < table.columnCount
    ) {
      grid[cell.rowIndex][cell.columnIndex] = cell;
    }
  }
  return grid;
}
