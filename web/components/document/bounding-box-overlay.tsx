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

  // Layout tables get a single labelled outline framing the whole table area
  // (Azure DI's detected visual structure). Synthesized tables get one
  // outline per row instead, mirroring DI Studio's structured-array
  // visualisation — the bbox union of a synth table is misleading because
  // its rows hold scattered scalar fields.
  const layoutTableRegion =
    activeTable && activeTable.source === "Layout"
      ? regionOnPage(activeTable.boundingRegions, pageNumber)
      : null;

  const synthRowRegions =
    activeTable && activeTable.source === "Synthesized"
      ? activeTable.boundingRegions.filter((r) => r.pageNumber === pageNumber)
      : [];

  // Per-cell fallback: when Azure didn't give us row geometry (bank-statement
  // Transactions and similar), iterate every cell on this page so the user
  // still sees what's covered by the active synth table. Header cells emit
  // empty bbox arrays from the synthesizer, so they self-skip via the filter.
  const synthCellRegions =
    activeTable && activeTable.source === "Synthesized" && synthRowRegions.length === 0
      ? activeTable.cells.flatMap((c) =>
          c.boundingRegions.filter((r) => r.pageNumber === pageNumber)
        )
      : [];

  // At most one of these is non-empty — the row set takes precedence when
  // Azure provided it. Single render path keeps the JSX uncluttered.
  const synthRegions =
    synthRowRegions.length > 0 ? synthRowRegions : synthCellRegions;

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
      {activeTable && layoutTableRegion && (
        <TableOutline
          region={layoutTableRegion}
          pageWidthPoints={pageWidthPoints}
          pageHeightPoints={pageHeightPoints}
          label={activeTable.name ?? `Table ${activeTable.index + 1}`}
        />
      )}

      {/* Synthesised-table region outlines on this page. When Azure provided
          per-item geometry (invoice Items, bank-statement Accounts) we draw
          one box per row; otherwise (bank-statement Transactions) we fall
          back to per-cell boxes so the user still sees what's covered.
          Pointer-events:none, no label, lighter weight than the layout
          TableOutline so a stack of N boxes doesn't visually dominate. */}
      {synthRegions.map((region, i) => (
        <SyntheticRegionOutline
          key={i}
          region={region}
          pageWidthPoints={pageWidthPoints}
          pageHeightPoints={pageHeightPoints}
        />
      ))}

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

interface SyntheticRegionOutlineProps {
  region: BoundingRegion;
  pageWidthPoints: number;
  pageHeightPoints: number;
}

/**
 * Subtle outline for a synthesised-table region — used for both per-row
 * geometry (when Azure provided it) and the per-cell fallback (when Azure
 * didn't). Drawn lighter than the layout `TableOutline` and unlabelled so
 * a stack of N outlines reads as context rather than primary chrome.
 */
function SyntheticRegionOutline({
  region,
  pageWidthPoints,
  pageHeightPoints,
}: SyntheticRegionOutlineProps) {
  const bbox = polygonToPercentBBox(region.polygon, pageWidthPoints, pageHeightPoints);
  if (!bbox) return null;

  return (
    <div
      className={cn(
        "absolute pointer-events-none rounded-[2px]",
        "border border-table",
        "bg-[color-mix(in_oklab,var(--color-table)_5%,transparent)]"
      )}
      style={{
        left: `${bbox.x}%`,
        top: `${bbox.y}%`,
        width: `${bbox.w}%`,
        height: `${bbox.h}%`,
      }}
    />
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
