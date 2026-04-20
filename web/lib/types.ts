export type DocumentStatus = "Uploaded" | "Analyzing" | "Completed" | "Failed";

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
  isCorrected: boolean;
  boundingRegions: BoundingRegion[];
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
