import type { FieldDataType } from "./types";

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

