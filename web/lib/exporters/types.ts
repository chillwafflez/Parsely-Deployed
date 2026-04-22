/**
 * Source-type-agnostic contract shared across exporter implementations.
 * Phase 2 ships "pdf" only; PNG/JPEG land later as new implementations
 * without touching existing code — add a new file under lib/exporters/
 * and register it in lib/exporters/index.ts.
 */

/** Supported source formats. Extend this union when adding a new exporter. */
export type SourceType = "pdf";

export interface SourceMeta {
  /** Public URL (usually /api/documents/:id/file) the exporter will fetch. */
  fileUrl: string;
  type: SourceType;
}

/**
 * One filled slot handed to the exporter. The polygon stays in whatever
 * native units Azure DI returned — inches for PDFs, pixels for images.
 * Each exporter knows how to convert from its own source type.
 */
export interface FilledField {
  value: string;
  pageNumber: number;
  /** Flat [x1,y1,x2,y2,x3,y3,x4,y4] in the source's native units. */
  polygon: number[];
}

export interface Exporter {
  supports: (type: SourceType) => boolean;
  /**
   * Produces a filled document and triggers a browser download.
   * Throws on unrecoverable errors (fetch failure, source parse failure)
   * — callers decide whether to surface as a toast or a banner.
   */
  export: (source: SourceMeta, fields: FilledField[], filename: string) => Promise<void>;
}
