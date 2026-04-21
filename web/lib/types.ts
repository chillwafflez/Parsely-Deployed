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
  fields: ExtractedField[];
}

export interface DocumentSummary {
  id: string;
  fileName: string;
  status: DocumentStatus;
  createdAt: string;
  fieldCount: number;
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

/** A saved template in the sidebar library. Real templates arrive in Day 6. */
export interface Template {
  id: string;
  name: string;
  kind: string;
  runs: number;
  lastUsed: string;
  status: "active" | "draft";
}

export type AppPhase = "upload" | "parsing" | "review";
export type SidebarView = "parse" | "queue" | "templates" | "settings";
