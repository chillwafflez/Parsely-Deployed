import type { ExtractedField } from "@/lib/types";

// Human-readable column headers in display order.
const HEADERS = [
  "Field",
  "Value",
  "Data Type",
  "Required",
  "Confidence",
  "Corrected",
  "User Added",
] as const;

type ExportRow = Record<(typeof HEADERS)[number], string>;

function toExportRow(field: ExtractedField): ExportRow {
  return {
    Field: field.name,
    Value: field.value ?? "",
    "Data Type": field.dataType,
    Required: field.isRequired ? "Yes" : "No",
    Confidence: `${Math.round(field.confidence * 100)}%`,
    Corrected: field.isCorrected ? "Yes" : "No",
    "User Added": field.isUserAdded ? "Yes" : "No",
  };
}

/**
 * Wraps a CSV cell in double-quotes if it contains commas, double-quotes,
 * or newlines, and escapes embedded quotes by doubling them (RFC 4180 §2.7).
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
 * Serialises extracted fields as CSV and triggers a browser download.
 * Column order matches HEADERS; values are RFC 4180-compliant.
 */
export function exportFieldsAsCsv(fields: ExtractedField[], fileName: string): void {
  if (fields.length === 0) return;

  const rows = fields.map(toExportRow);
  const header = HEADERS.map(escapeCsvCell).join(",");
  const body = rows.map((row) => HEADERS.map((h) => escapeCsvCell(row[h])).join(","));

  triggerDownload(
    [header, ...body].join("\r\n"),
    "text/csv;charset=utf-8;",
    `${baseName(fileName)}-fields.csv`
  );
}

/**
 * Serialises extracted fields as formatted JSON and triggers a browser download.
 */
export function exportFieldsAsJson(fields: ExtractedField[], fileName: string): void {
  if (fields.length === 0) return;

  triggerDownload(
    JSON.stringify(fields.map(toExportRow), null, 2),
    "application/json;charset=utf-8;",
    `${baseName(fileName)}-fields.json`
  );
}
