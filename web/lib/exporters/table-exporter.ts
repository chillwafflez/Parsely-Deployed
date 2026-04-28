import type { ExtractedTable } from "@/lib/types";

/**
 * Wraps a CSV cell in double-quotes if it contains commas, double-quotes,
 * or newlines, and escapes embedded quotes by doubling them (RFC 4180 §2.7).
 * Mirrors the helper in field-exporter.ts — kept local rather than shared so
 * a future divergence (e.g., quoting policy per export type) doesn't ripple.
 */
function escapeCsvCell(value: string): string {
  if (/[",\n\r]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

/** Strips the file extension from a document filename. */
function baseName(fileName: string): string {
  return fileName.replace(/\.[^.]+$/, "");
}

function triggerDownload(content: string, mimeType: string, filename: string): void {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  URL.revokeObjectURL(url);
}

/**
 * Materialises a table's cells into a dense `rowCount × columnCount` matrix
 * of strings. Merged cells are expanded — the cell's content is repeated
 * across every spanned (row, column) position. This is the right shape for
 * CSV/Excel because consumers can sort/filter every cell independently
 * without losing context from the merge.
 *
 * Out-of-range cells are silently skipped (defensive against malformed data).
 */
function materialize(table: ExtractedTable): string[][] {
  const matrix: string[][] = Array.from(
    { length: table.rowCount },
    () => Array<string>(table.columnCount).fill("")
  );

  for (const cell of table.cells) {
    const text = cell.content ?? "";
    for (let dr = 0; dr < cell.rowSpan; dr++) {
      const r = cell.rowIndex + dr;
      if (r < 0 || r >= table.rowCount) continue;
      for (let dc = 0; dc < cell.columnSpan; dc++) {
        const c = cell.columnIndex + dc;
        if (c < 0 || c >= table.columnCount) continue;
        matrix[r][c] = text;
      }
    }
  }

  return matrix;
}

/**
 * Serialises an extracted table as CSV and triggers a browser download.
 * No special "header row" handling — Azure DI's columnHeader cells are just
 * the first row(s) of data; CSV consumers treat the first row as headers
 * by convention, which lines up correctly for typical invoice tables.
 *
 * Filename: `{baseName}-table-{n}.csv` where n is 1-indexed for friendlier
 * file lists (Table 1, Table 2, … matches what the UI shows).
 */
export function exportTableAsCsv(table: ExtractedTable, fileName: string): void {
  if (table.cells.length === 0) return;

  const matrix = materialize(table);
  const csv = matrix
    .map((row) => row.map(escapeCsvCell).join(","))
    .join("\r\n");

  triggerDownload(
    csv,
    "text/csv;charset=utf-8;",
    `${baseName(fileName)}-table-${table.index + 1}.csv`
  );
}

/**
 * Serialises an extracted table as formatted JSON and triggers a browser
 * download. Friendlier shape than the raw API response: a flat 2D array of
 * strings (merged cells expanded, same as CSV) plus dimensions for any
 * downstream tooling that needs to validate row/column counts.
 */
export function exportTableAsJson(table: ExtractedTable, fileName: string): void {
  if (table.cells.length === 0) return;

  const payload = {
    index: table.index,
    pageNumber: table.pageNumber,
    rowCount: table.rowCount,
    columnCount: table.columnCount,
    rows: materialize(table),
  };

  triggerDownload(
    JSON.stringify(payload, null, 2),
    "application/json;charset=utf-8;",
    `${baseName(fileName)}-table-${table.index + 1}.json`
  );
}
