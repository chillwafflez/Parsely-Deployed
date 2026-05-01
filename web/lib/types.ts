export type DocumentStatus = "Uploaded" | "Analyzing" | "Completed" | "Failed";

export type FieldDataType =
  | "string"
  | "number"
  | "currency"
  | "date"
  | "percent"
  | "boolean"
  | "email"
  | "phone"
  | "address"
  | "enum"
  /** Phase G: synthetic placeholder for `List<Dictionary>` fields (Items,
   *  Accounts, …). The Inspector renders this as a clickable opener for
   *  the corresponding synth table rather than an inline-editable value. */
  | "Tabular";

export type ConfidenceLevel = "high" | "med" | "low";

export type FlagKind = "ok" | "warn" | "err";

export interface FieldFlag {
  kind: FlagKind;
  text: string;
}

export interface BoundingBox {
  /** Percentages of the page, 0–100. */
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface BoundingRegion {
  pageNumber: number;
  polygon: number[];
}

export interface ExtractedField {
  id: string;
  name: string;
  value: string | null;
  dataType: string;
  confidence: number;
  isRequired: boolean;
  isCorrected: boolean;
  isUserAdded: boolean;
  boundingRegions: BoundingRegion[];
  /**
   * Set when the field was produced by the aggregation feature (Sum / Avg /
   * Count / Min / Max over a drawn region). Null on every other field.
   * Presence — not <c>dataType</c> — is the authoritative signal so users
   * can override the displayed type without losing the aggregation marker.
   */
  aggregationConfig: AggregationFieldConfig | null;
}

export type AggregationOperation = "Sum" | "Average" | "Count" | "Min" | "Max";

export interface AggregationFieldConfig {
  operation: AggregationOperation;
  /** Numeric tokens that contributed to the value at evaluation time. */
  sourceTokenCount: number;
  /** ISO-8601 UTC timestamp of the last computation. */
  evaluatedAt: string;
}

/** One numeric token detected inside an aggregation region. */
export interface AggregationToken {
  /** Original word content as Azure DI extracted it (e.g. "$1,234.56"). */
  text: string;
  /** Parsed numeric value (e.g. 1234.56). */
  value: number;
  /** Per-word OCR confidence in [0, 1]. */
  confidence: number;
  /** Word polygon in inches — same shape as field boundingRegions[].polygon. */
  polygon: number[];
}

export interface AggregationPreviewRequest {
  pageNumber: number;
  /** Flat [x1,y1,x2,y2,…] in inches. */
  polygon: number[];
}

export interface AggregationPreviewResponse {
  tokens: AggregationToken[];
}

/** POST body for committing a new aggregation field. */
export interface CreateAggregationPayload {
  name: string;
  operation: AggregationOperation;
  isRequired: boolean;
  pageNumber: number;
  polygon: number[];
}

/** PATCH body for updating a field. Only provided properties are applied. */
export interface FieldUpdate {
  value?: string;
  dataType?: string;
  isRequired?: boolean;
}

/** Payload for POSTing a new user-drawn field. */
export interface FieldCreate {
  name: string;
  dataType: string;
  isRequired: boolean;
  pageNumber: number;
  /** Flat [x1,y1,x2,y2,x3,y3,x4,y4] in inches, matching Azure DI's format. */
  polygon: number[];
}

/** A rectangle drawn by the user, in percentages of the page. */
export interface DrawnRect {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** Result bubbled up from the drawing layer when a user finishes dragging. */
export interface DrawResult {
  pageNumber: number;
  bbox: DrawnRect;
  polygon: number[];
}

/**
 * Active drawing mode in the toolbar. <c>field</c> is the existing
 * draw-to-add-field flow; <c>aggregation</c> is the draw-region-then-rollup
 * flow. <c>table</c> is reserved for the future #3.1(a) feature and is not
 * selectable in v1.
 */
export type DrawMode = "field" | "aggregation";

/**
 * Drawing result tagged with the mode it was captured under. ReviewStage
 * branches on <c>mode</c> to open the right post-draw modal.
 */
export type DrawCompletion = DrawResult & { mode: DrawMode };

export interface DocumentResponse {
  id: string;
  fileName: string;
  modelId: string;
  status: DocumentStatus;
  createdAt: string;
  completedAt: string | null;
  errorMessage: string | null;
  templateId: string | null;
  templateName: string | null;
  fields: ExtractedField[];
  tables: ExtractedTable[];
}

/**
 * Azure Document Intelligence's table-cell role. The wire shape stores it as
 * a string (the SDK uses an extensible-enum struct on the .NET side); we
 * mirror that so future custom-model roles flow through without a type bump.
 */
export type TableCellKind =
  | "content"
  | "columnHeader"
  | "rowHeader"
  | "stubHead"
  | "description";

export interface TableCell {
  rowIndex: number;
  columnIndex: number;
  /** Defaults to 1 — the backend normalizes Azure's null spans on extract. */
  rowSpan: number;
  columnSpan: number;
  kind: TableCellKind | string;
  content: string | null;
  /** Flips true on the user's first PATCH; never reverts. */
  isCorrected: boolean;
  boundingRegions: BoundingRegion[];
}

/**
 * Where the table came from. Phase G surfaces the two sources in different
 * parts of the Inspector: `Layout` tables render in the "Tables" section
 * (visual structure detected on the page); `Synthesized` tables come from
 * `List<Dictionary>` structured fields and are bound to a parent Tabular
 * field row (or the "Records" sub-header for nested orphans).
 */
export type TableSource = "Layout" | "Synthesized";

export interface ExtractedTable {
  id: string;
  /** 0-based detection order — preserves Azure DI's sequence across reloads. */
  index: number;
  /** First page the table appears on; multi-page tables fan out via boundingRegions. */
  pageNumber: number;
  rowCount: number;
  columnCount: number;
  source: TableSource;
  /** Always set for Synthesized tables (matches the originating field name,
   *  with `[N]` suffix for nested-leaf collisions). Null for Layout tables —
   *  the UI labels them "Table N" by detection order. */
  name: string | null;
  boundingRegions: BoundingRegion[];
  cells: TableCell[];
}

/** PATCH body for a single table cell. (rowIndex, columnIndex) addresses
 *  merged cells via their top-left position — Azure DI's convention. */
export interface TableCellUpdate {
  rowIndex: number;
  columnIndex: number;
  content: string | null;
}

export interface DocumentSummary {
  id: string;
  fileName: string;
  status: DocumentStatus;
  createdAt: string;
  fieldCount: number;
  templateName: string | null;
}

/** Client-side enriched field — derived from API's `ExtractedField` with UI state. */
export interface FieldViewModel {
  id: string;
  label: string;
  value: string;
  type: FieldDataType;
  required: boolean;
  confidence: number;
  bbox: BoundingBox | null;
  group: string;
  flag: FieldFlag | null;
}

/** Sidebar summary view of a saved template. */
export interface TemplateSummary {
  id: string;
  name: string;
  /** Azure DI prebuilt model id, e.g. `prebuilt-invoice`, `prebuilt-tax.us.w2`. */
  modelId: string;
  description: string | null;
  applyTo: TemplateApplyTo;
  vendorHint: string | null;
  createdAt: string;
  ruleCount: number;
  runs: number;
}

/** Full template with snapshot of field rules. */
export interface Template {
  id: string;
  name: string;
  modelId: string;
  description: string | null;
  applyTo: TemplateApplyTo;
  vendorHint: string | null;
  createdAt: string;
  sourceDocumentId: string | null;
  runs: number;
  rules: TemplateFieldRule[];
}

/**
 * Catalog entry exposed by `GET /api/document-types`. Drives the upload-stage
 * picker and resolves a modelId back to a display label across the UI.
 */
export interface DocumentTypeOption {
  modelId: string;
  displayName: string;
  sampleAssetUrl: string | null;
}

export interface TemplateFieldRule {
  id: string;
  name: string;
  dataType: string;
  isRequired: boolean;
  /** Free-text description shown to the voice-fill LLM (≤200 chars). */
  hint: string | null;
  /** Alternative phrasings the user might say for this field. */
  aliases: string[];
  boundingRegions: BoundingRegion[];
}

export type TemplateApplyTo = "vendor" | "similar" | "all";

/**
 * Controls how templates are applied during upload.
 * - `auto`: match by VendorName → VendorHint (current default behavior).
 * - `manual`: apply the template specified by `templateId` unconditionally.
 * - `none`: skip template logic entirely.
 */
export type TemplateApplyMode = "auto" | "manual" | "none";

/**
 * Optional voice-fill metadata captured per rule at template-save time.
 * Keyed by the rule's field name (case-insensitive on the server).
 */
export interface RuleOverride {
  hint: string | null;
  aliases: string[];
}

/** POST body for creating a template from a source document. */
export interface CreateTemplatePayload {
  name: string;
  description: string | null;
  applyTo: TemplateApplyTo;
  sourceDocumentId: string;
  ruleOverrides?: Record<string, RuleOverride>;
}

/**
 * PUT body for the template edit page. Server replaces the rule collection
 * with the payload: each incoming id must belong to the template, and any
 * persisted rule whose id isn't present in `rules` is deleted.
 */
export interface UpdateTemplateRequest {
  name: string;
  description: string | null;
  vendorHint: string | null;
  rules: UpdateTemplateRuleRequest[];
}

export interface UpdateTemplateRuleRequest {
  id: string;
  name: string;
  dataType: string;
  isRequired: boolean;
  hint: string | null;
  aliases: string[];
}

/**
 * Portable, server-generated shape produced by `GET /api/templates/:id/export`
 * and accepted by `POST /api/templates/import`. Intentionally omits all
 * server-generated ids and any source-document reference so the payload is
 * safe to share between users and databases.
 *
 * V2 (current) replaces V1's `kind` field with `modelId`. V1 files are
 * rejected on import — re-export from the source.
 */
export interface TemplateExportPayload {
  version: number;
  name: string;
  modelId: string;
  description: string | null;
  applyTo: TemplateApplyTo;
  vendorHint: string | null;
  rules: TemplateExportRule[];
}

export interface TemplateExportRule {
  name: string;
  dataType: string;
  isRequired: boolean;
  hint: string | null;
  aliases: string[];
  boundingRegions: BoundingRegion[];
}

/** Response of GET /api/voice/token — short-lived JWT for the browser Speech SDK. */
export interface SpeechToken {
  token: string;
  region: string;
  /** ISO-8601 UTC timestamp after which the token must be re-fetched. */
  expiresAt: string;
}

/** One structured field assignment the LLM produced from a transcript. */
export interface FieldPatch {
  /** Canonical field name, matches a TemplateFieldRule.name exactly. */
  field: string;
  value: string;
  dataType: string;
  /** Non-null when post-LLM coercion couldn't parse the value for its type. */
  warning: string | null;
}

/** POST body for /api/voice/fill. */
export interface VoiceFillRequest {
  templateId: string;
  transcript: string;
  /** Optional current-values map so the LLM can disambiguate against context. */
  currentValues?: Record<string, string | null>;
}

export interface VoiceFillResponse {
  patches: FieldPatch[];
  unmatchedPhrases: string[];
  /** Echoed back for the client's transient "I heard: …" surface. */
  transcript: string;
}
