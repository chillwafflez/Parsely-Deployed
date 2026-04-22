import { pdfExporter } from "./pdf-exporter";
import type { Exporter, FilledField, SourceMeta } from "./types";

export type { FilledField, SourceMeta, SourceType } from "./types";

/**
 * Registry of available exporters. Order matters only when multiple
 * exporters claim the same SourceType (the first matching wins); today
 * every type has exactly one implementation.
 */
const exporters: Exporter[] = [pdfExporter];

/**
 * Produces a filled document from a source + filled fields and triggers
 * a browser download. Format is chosen by <c>source.type</c>.
 */
export async function exportFilled(
  source: SourceMeta,
  fields: FilledField[],
  filename: string
): Promise<void> {
  const exporter = exporters.find((e) => e.supports(source.type));
  if (!exporter) {
    throw new Error(`No exporter registered for source type: ${source.type}`);
  }
  await exporter.export(source, fields, filename);
}
