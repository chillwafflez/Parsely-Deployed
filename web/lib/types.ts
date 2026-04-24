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
  | "enum";

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
  kind: string;
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
  kind: string;
  description: string | null;
  applyTo: TemplateApplyTo;
  vendorHint: string | null;
  createdAt: string;
  sourceDocumentId: string | null;
  runs: number;
  rules: TemplateFieldRule[];
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
  kind: string;
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
  kind: string;
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
