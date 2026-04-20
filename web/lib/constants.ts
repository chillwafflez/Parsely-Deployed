import type { FieldDataType, Template } from "./types";

export const FIELD_TYPES: { id: FieldDataType; label: string; hint: string }[] = [
  { id: "string", label: "String", hint: "Any text" },
  { id: "number", label: "Number", hint: "Integer or decimal" },
  { id: "currency", label: "Currency", hint: "Monetary amount ($)" },
  { id: "date", label: "Date", hint: "ISO 8601" },
  { id: "percent", label: "Percent", hint: "0–100" },
  { id: "boolean", label: "Boolean", hint: "True/false" },
  { id: "email", label: "Email", hint: "RFC 5322" },
  { id: "phone", label: "Phone", hint: "E.164" },
  { id: "address", label: "Address", hint: "Multi-line postal" },
  { id: "enum", label: "Enum", hint: "One of a set" },
];

/**
 * Confidence thresholds for the 3-level color system used on bounding boxes
 * and field flags.
 */
export const CONFIDENCE_THRESHOLDS = {
  high: 0.9,
  medium: 0.7,
} as const;

export function confidenceLevel(confidence: number): "high" | "med" | "low" {
  if (confidence >= CONFIDENCE_THRESHOLDS.high) return "high";
  if (confidence >= CONFIDENCE_THRESHOLDS.medium) return "med";
  return "low";
}

/**
 * Placeholder template library. In Day 6 these move to the API.
 * Matches the design's TEMPLATES shape for seamless replacement.
 */
export const PLACEHOLDER_TEMPLATES: Template[] = [
  { id: "tpl_invoice_generic", name: "Generic — Invoice", kind: "Invoice", runs: 0, lastUsed: "—", status: "draft" },
];
