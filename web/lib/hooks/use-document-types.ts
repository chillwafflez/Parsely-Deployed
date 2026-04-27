"use client";

import * as React from "react";
import { listDocumentTypes } from "../api-client";
import type { DocumentTypeOption } from "../types";

interface UseDocumentTypes {
  documentTypes: DocumentTypeOption[];
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
}

/**
 * Fetches the document-type catalog from the API once on mount. The catalog
 * is small (<10 entries) and effectively static, so we don't bother with
 * SWR-style revalidation — `refresh` is exposed for parity with `useTemplates`
 * but won't be wired to anything in V1.
 */
export function useDocumentTypes(): UseDocumentTypes {
  const [documentTypes, setDocumentTypes] = React.useState<DocumentTypeOption[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  const refresh = React.useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const list = await listDocumentTypes();
      setDocumentTypes(list);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load document types");
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    void refresh();
  }, [refresh]);

  return { documentTypes, loading, error, refresh };
}
