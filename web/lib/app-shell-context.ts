"use client";

import * as React from "react";
import type { DocumentResponse, TemplateSummary } from "./types";

export type ToastTone = "ok" | "err";

/**
 * Context exposed by `<AppShell>` to any client component rendered inside it.
 * Pages call these to drive the shared chrome (toast root, sidebar template
 * highlight, topbar breadcrumb) without lifting state through the router.
 *
 * Templates are surfaced here so callers (e.g., the upload-stage template
 * picker) read the same already-fetched list the sidebar uses, rather than
 * triggering a duplicate fetch.
 */
export interface AppShellContextValue {
  showToast: (message: string, tone?: ToastTone) => void;
  refreshTemplates: () => Promise<void>;
  setActiveDocument: (doc: DocumentResponse | null) => void;
  templates: TemplateSummary[];
  templatesLoading: boolean;
}

export const AppShellContext = React.createContext<AppShellContextValue | null>(null);

export function useAppShell(): AppShellContextValue {
  const ctx = React.useContext(AppShellContext);
  if (!ctx) {
    throw new Error("useAppShell must be used within <AppShell>");
  }
  return ctx;
}
