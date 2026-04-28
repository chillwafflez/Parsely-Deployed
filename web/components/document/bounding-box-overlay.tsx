"use client";

import { cn } from "@/lib/cn";
import { confidenceLevel, polygonToPercentBBox, primaryRegion } from "@/lib/bbox";
import {
  isTableCellSelection,
  selectedFieldId as selectedFieldIdOf,
  type Selection,
} from "@/lib/selection";
import type { BoundingRegion, ExtractedField, ExtractedTable, TableCell } from "@/lib/types";
import styles from "./bounding-box-overlay.module.css";

interface BoundingBoxOverlayProps {
  pageNumber: number;
  pageWidthPoints: number;
  pageHeightPoints: number;
  fields: ExtractedField[];
  /** All tables on the document; the overlay filters to ones on this page. */
  tables: ExtractedTable[];
  /** Current document-wide selection (field | tableCell | null). */
  selection: Selection | null;
  /** Drives the active-table outline; visual only — clicks come from the drawer. */
  activeTableId: string | null;
  onSelect: (selection: Selection | null) => void;
}

/**
 * Overlay positioned absolutely over a PDF page. Renders:
 *   1. One clickable bounding box per field whose primary region is on this page,
 *      color-coded by confidence (existing behavior, CSS Modules retained).
 *   2. (Phase D) A passive amber outline of the active table's region on this
 *      page when the drawer is open.
 *   3. (Phase D) A stronger amber outline of the selected table cell on this
 *      page. Both table visuals are pointer-events-none so they never steal
 *      clicks from the underlying field buttons.
 */
export function BoundingBoxOverlay({
  pageNumber,
  pageWidthPoints,
  pageHeightPoints,
  fields,
  tables,
  selection,
  activeTableId,
  onSelect,
}: BoundingBoxOverlayProps) {
  const selectedFieldId = selectedFieldIdOf(selection);
  const activeTable = activeTableId
    ? tables.find((t) => t.id === activeTableId) ?? null
    : null;
  const tableRegion = activeTable
    ? regionOnPage(activeTable.boundingRegions, pageNumber)
    : null;

  // Cell highlight is independent of activeTableId — selection.tableId is the
  // truth. (It will usually match activeTableId, but we don't depend on that.)
  const selectedCellInfo = isTableCellSelection(selection)
    ? selectedCellOnPage(tables, selection, pageNumber)
    : null;

  return (
    <div
      className={styles.overlay}
      onClick={() => onSelect(null)}
      aria-hidden="true"
    >
      {fields.map((field) => {
        const region = primaryRegion(field, pageNumber);
        if (!region || region.pageNumber !== pageNumber) return null;

        const bbox = polygonToPercentBBox(region.polygon, pageWidthPoints, pageHeightPoints);
        if (!bbox) return null;

        const level = confidenceLevel(field.confidence);
        const isSelected = field.id === selectedFieldId;
        const confidenceLabel = `${(field.confidence * 100).toFixed(0)}%`;

        return (
          <button
            type="button"
            key={field.id}
            className={cn(styles.bbox, isSelected && styles.selected)}
            data-confidence={level}
            style={{
              left: `${bbox.x}%`,
              top: `${bbox.y}%`,
              width: `${bbox.w}%`,
              height: `${bbox.h}%`,
            }}
            onClick={(e) => {
              e.stopPropagation();
              onSelect({ kind: "field", fieldId: field.id });
            }}
            aria-label={`${field.name} · ${confidenceLabel} confidence`}
          >
            <span className={styles.tag}>
              {field.name} · {confidenceLabel}
            </span>
            {field.confidence < 0.7 && (
              <span className={styles.warn} aria-hidden="true">
                !
              </span>
            )}
          </button>
        );
      })}

      {/* Active-table outline — passive amber rect framing the table region.
          pointer-events:none so it never blocks field clicks underneath. */}
      {activeTable && tableRegion && (
        <TableOutline
          region={tableRegion}
          pageWidthPoints={pageWidthPoints}
          pageHeightPoints={pageHeightPoints}
          label={`Table ${activeTable.index + 1}`}
        />
      )}

      {/* Selected-cell highlight — stronger amber outline. Sibling of the
          table outline so the cell sits visually above the table frame. */}
      {selectedCellInfo && (
        <CellHighlight
          region={selectedCellInfo.region}
          pageWidthPoints={pageWidthPoints}
          pageHeightPoints={pageHeightPoints}
          rowIndex={selectedCellInfo.cell.rowIndex}
          columnIndex={selectedCellInfo.cell.columnIndex}
        />
      )}
    </div>
  );
}

interface TableOutlineProps {
  region: BoundingRegion;
  pageWidthPoints: number;
  pageHeightPoints: number;
  label: string;
}

function TableOutline({ region, pageWidthPoints, pageHeightPoints, label }: TableOutlineProps) {
  const bbox = polygonToPercentBBox(region.polygon, pageWidthPoints, pageHeightPoints);
  if (!bbox) return null;

  return (
    <div
      className={cn(
        "absolute pointer-events-none rounded-[2px]",
        "border-[1.5px] border-table",
        "bg-[color-mix(in_oklab,var(--color-table)_8%,transparent)]"
      )}
      style={{
        left: `${bbox.x}%`,
        top: `${bbox.y}%`,
        width: `${bbox.w}%`,
        height: `${bbox.h}%`,
      }}
    >
      <span
        className={cn(
          "absolute -top-[16px] -left-px",
          "px-1.5 py-px text-[8.5px] font-mono font-semibold tracking-[0.04em]",
          "bg-table text-white rounded-t-[2px] whitespace-nowrap"
        )}
      >
        {label}
      </span>
    </div>
  );
}

interface CellHighlightProps {
  region: BoundingRegion;
  pageWidthPoints: number;
  pageHeightPoints: number;
  rowIndex: number;
  columnIndex: number;
}

function CellHighlight({
  region,
  pageWidthPoints,
  pageHeightPoints,
  rowIndex,
  columnIndex,
}: CellHighlightProps) {
  const bbox = polygonToPercentBBox(region.polygon, pageWidthPoints, pageHeightPoints);
  if (!bbox) return null;

  return (
    <div
      className={cn(
        "absolute pointer-events-none rounded-[2px]",
        "border-2 border-table-ink",
        "bg-[color-mix(in_oklab,var(--color-table)_22%,transparent)]",
        "shadow-[0_0_0_3px_color-mix(in_oklab,var(--color-table)_22%,transparent)]"
      )}
      style={{
        left: `${bbox.x}%`,
        top: `${bbox.y}%`,
        width: `${bbox.w}%`,
        height: `${bbox.h}%`,
      }}
      aria-label={`Cell row ${rowIndex + 1}, column ${columnIndex + 1}`}
    />
  );
}

function regionOnPage(
  regions: BoundingRegion[],
  pageNumber: number
): BoundingRegion | null {
  return regions.find((r) => r.pageNumber === pageNumber) ?? null;
}

function selectedCellOnPage(
  tables: ExtractedTable[],
  selection: Extract<Selection, { kind: "tableCell" }>,
  pageNumber: number
): { cell: TableCell; region: BoundingRegion } | null {
  const table = tables.find((t) => t.id === selection.tableId);
  if (!table) return null;
  const cell = table.cells.find(
    (c) => c.rowIndex === selection.rowIndex && c.columnIndex === selection.columnIndex
  );
  if (!cell) return null;
  const region = regionOnPage(cell.boundingRegions, pageNumber);
  if (!region) return null;
  return { cell, region };
}
