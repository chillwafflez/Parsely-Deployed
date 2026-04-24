import { exportTemplate } from "@/lib/api-client";
import type { TemplateExportPayload } from "@/lib/types";

/**
 * Fetches the export file for a template and triggers a browser download.
 * Uses the filename the server suggests via Content-Disposition — the API
 * sanitises the template name server-side so the caller doesn't need to.
 */
export async function downloadTemplateExport(id: string): Promise<void> {
  const { blob, filename } = await exportTemplate(id);
  triggerDownload(blob, filename);
}

/**
 * Reads a user-picked template-export file and parses it as JSON. Throws a
 * human-readable Error for the two failure modes the UI surfaces: the file
 * isn't valid JSON at all, or it is but doesn't look like a template export
 * (missing `version` + `rules`). Deeper validation happens server-side so the
 * error message can cite the specific invalid field.
 */
export async function readTemplateExportFile(
  file: File
): Promise<TemplateExportPayload> {
  const text = await file.text();

  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new Error("File isn't valid JSON.");
  }

  if (!isTemplateExportShape(parsed)) {
    throw new Error(
      "File doesn't look like a Parsely template export (missing version or rules)."
    );
  }

  return parsed;
}

function isTemplateExportShape(value: unknown): value is TemplateExportPayload {
  if (typeof value !== "object" || value === null) return false;
  const record = value as Record<string, unknown>;
  return (
    typeof record.version === "number" &&
    typeof record.name === "string" &&
    Array.isArray(record.rules)
  );
}

function triggerDownload(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  URL.revokeObjectURL(url);
}
