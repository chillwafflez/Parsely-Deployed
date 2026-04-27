import type { DocumentTypeOption } from "./types";

/**
 * Default Azure DI prebuilt model id — mirrored from the backend catalog's
 * `DocumentTypeCatalog.DefaultModelId`. Used by the upload picker as the
 * initial selection so the no-thought path stays Invoice-flavored.
 */
export const DEFAULT_MODEL_ID = "prebuilt-invoice";

/**
 * Resolves a backend `modelId` to a human-readable label using the cached
 * catalog. Falls back to the raw id if the catalog hasn't loaded yet or the
 * id isn't in the list — keeps the UI usable in that interim instead of
 * rendering "undefined".
 */
export function getDocumentTypeName(
  types: DocumentTypeOption[],
  modelId: string
): string {
  return types.find((t) => t.modelId === modelId)?.displayName ?? modelId;
}

/** Convenience lookup; returns `null` if the id isn't in the catalog. */
export function findDocumentType(
  types: DocumentTypeOption[],
  modelId: string
): DocumentTypeOption | null {
  return types.find((t) => t.modelId === modelId) ?? null;
}
