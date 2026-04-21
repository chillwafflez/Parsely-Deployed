"use client";

import * as React from "react";
import { listTemplates } from "../api-client";
import type { TemplateSummary } from "../types";

interface UseTemplates {
  templates: TemplateSummary[];
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
}

/**
 * Fetches the template library from the API on mount. `refresh` triggers a
 * manual reload (e.g., after creating a new template).
 */
export function useTemplates(): UseTemplates {
  const [templates, setTemplates] = React.useState<TemplateSummary[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  const refresh = React.useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const list = await listTemplates();
      setTemplates(list);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load templates");
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    void refresh();
  }, [refresh]);

  return { templates, loading, error, refresh };
}
