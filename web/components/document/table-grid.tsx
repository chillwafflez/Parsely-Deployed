"use client";

import * as React from "react";
import { cn } from "@/lib/cn";
import { isTableCellSelection, type Selection } from "@/lib/selection";
import type { ExtractedTable, TableCell } from "@/lib/types";

interface TableGridProps {
  table: ExtractedTable;
  selection: Selection | null;
  onSelectCell: (rowIndex: number, columnIndex: number) => void;
}

/**
 * Read-only rendering of an ExtractedTable as an HTML <table>. Cell editing
 * lands in Phase E — this phase only handles display + click-to-select +
 * highlighting the selected cell.
 *
 * Merged cells: Azure DI emits a single record at the top-left of the merged
 * region with rowSpan/columnSpan. Other positions in the span don't have
 * their own record; the natural HTML rowspan/colspan attributes give us the
 * correct visual without iterating "covered" positions explicitly.
 */
export function TableGrid({ table, selection, onSelectCell }: TableGridProps) {
  const grid = React.useMemo(() => buildGrid(table), [table]);
  const selectedCell = isTableCellSelection(selection) && selection.tableId === table.id
    ? { row: selection.rowIndex, col: selection.columnIndex }
    : null;

  return (
    <div className="flex-1 overflow-auto bg-surface">
      <table
        // table-fixed prevents content-driven column reflow as the user
        // resizes the drawer or scrolls; cells handle overflow themselves.
        className="border-collapse text-[12.5px] font-ui min-w-full"
      >
        <tbody>
          {Array.from({ length: table.rowCount }, (_, rowIndex) => (
            <tr key={rowIndex}>
              {/* Row-number gutter — monospace, distinct from data cells. */}
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
                // null = position is covered by an upstream merged cell. Skip
                // emitting a <td> so the rowspan/colspan from the origin cell
                // visually handles the span.
                if (!cell) return null;

                const isHeader = cell.kind === "columnHeader" || cell.kind === "rowHeader";
                const isSelected =
                  selectedCell?.row === rowIndex && selectedCell?.col === columnIndex;

                return (
                  <CellView
                    key={columnIndex}
                    cell={cell}
                    isHeader={isHeader}
                    isSelected={isSelected}
                    onClick={() => onSelectCell(rowIndex, columnIndex)}
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
  onClick: () => void;
}

function CellView({ cell, isHeader, isSelected, onClick }: CellViewProps) {
  return (
    <td
      rowSpan={cell.rowSpan > 1 ? cell.rowSpan : undefined}
      colSpan={cell.columnSpan > 1 ? cell.columnSpan : undefined}
      onClick={onClick}
      className={cn(
        "px-2.5 py-1.5 border-b border-r border-line align-top cursor-pointer",
        "min-w-[80px] max-w-[320px]",
        // Truncate inside the cell — wide invoice descriptions otherwise
        // explode the column width and break the table layout.
        "whitespace-nowrap overflow-hidden text-ellipsis",
        isHeader && "bg-surface-2 font-semibold text-ink",
        cell.isCorrected && "bg-table-weak/40",
        isSelected && "outline outline-2 outline-table -outline-offset-2 bg-table-weak"
      )}
      title={cell.content ?? ""}
    >
      {cell.content || (
        <span className="text-ink-4 italic">—</span>
      )}
    </td>
  );
}

/**
 * Builds a `RowCount × ColumnCount` grid where each entry is either the
 * `TableCell` whose top-left address matches that position, or `null` for
 * positions covered by an upstream merged cell.
 */
function buildGrid(table: ExtractedTable): (TableCell | null)[][] {
  const grid: (TableCell | null)[][] = Array.from(
    { length: table.rowCount },
    () => Array<TableCell | null>(table.columnCount).fill(null)
  );
  for (const cell of table.cells) {
    // Defensive bounds check: a misbehaving extraction shouldn't blow up
    // the whole grid. Out-of-range cells are silently skipped.
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
