"use client";

import * as React from "react";
import type { DocumentResponse } from "./types";

export type ToastTone = "ok" | "err";

/**
 * Context exposed by `<AppShell>` to any client component rendered inside it.
 * Pages call these to drive the shared chrome (toast root, sidebar template
 * highlight, topbar breadcrumb) without lifting state through the router.
 */
export interface AppShellContextValue {
  showToast: (message: string, tone?: ToastTone) => void;
  refreshTemplates: () => Promise<void>;
  setActiveDocument: (doc: DocumentResponse | null) => void;
}

export const AppShellContext = React.createContext<AppShellContextValue | null>(null);

export function useAppShell(): AppShellContextValue {
  const ctx = React.useContext(AppShellContext);
  if (!ctx) {
    throw new Error("useAppShell must be used within <AppShell>");
  }
  return ctx;
}
