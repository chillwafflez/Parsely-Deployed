"use client";

import * as React from "react";
import { Topbar } from "./topbar";
import { Sidebar } from "./sidebar";
import { Toast } from "./toast";
import { AppShellContext, type ToastTone } from "@/lib/app-shell-context";
import { useTemplates } from "@/lib/hooks/use-templates";
import type { DocumentResponse } from "@/lib/types";
import styles from "./app-shell.module.css";

const TOAST_MS = 2400;

interface ToastState {
  message: string;
  tone: ToastTone;
  /** Monotonic id so repeat messages still re-announce and auto-dismiss cleanly. */
  id: number;
}

/**
 * Persistent workspace chrome (topbar + sidebar + toast root) shared across
 * every route. Owns the templates list, active-document highlight, and the
 * single toast instance — pages drive all three via `useAppShell()`.
 */
export function AppShell({ children }: { children: React.ReactNode }) {
  const [activeDocument, setActiveDocument] =
    React.useState<DocumentResponse | null>(null);
  const [toast, setToast] = React.useState<ToastState | null>(null);

  const toastTimerRef = React.useRef<number | null>(null);
  const toastSeqRef = React.useRef(0);

  const {
    templates,
    loading: templatesLoading,
    refresh: refreshTemplates,
  } = useTemplates();

  const showToast = React.useCallback((message: string, tone: ToastTone = "ok") => {
    const id = ++toastSeqRef.current;
    setToast({ message, tone, id });
    if (toastTimerRef.current !== null) {
      window.clearTimeout(toastTimerRef.current);
    }
    toastTimerRef.current = window.setTimeout(() => {
      setToast((curr) => (curr && curr.id === id ? null : curr));
      toastTimerRef.current = null;
    }, TOAST_MS);
  }, []);

  React.useEffect(() => {
    return () => {
      if (toastTimerRef.current !== null) {
        window.clearTimeout(toastTimerRef.current);
      }
    };
  }, []);

  // `setActiveDocument` from useState is already referentially stable per React's
  // guarantees, so it can be threaded into the context directly.
  const contextValue = React.useMemo(
    () => ({ showToast, refreshTemplates, setActiveDocument }),
    [showToast, refreshTemplates]
  );

  return (
    <AppShellContext.Provider value={contextValue}>
      <div className={styles.app}>
        <Topbar
          documentName={activeDocument?.fileName}
          templateName={activeDocument?.templateName ?? null}
        />
        <div className={styles.body}>
          <Sidebar
            templates={templates}
            activeTemplateId={activeDocument?.templateId ?? null}
            onPickTemplate={() => {
              /* Sidebar template selection is a Phase 2 feature. */
            }}
            templatesLoading={templatesLoading}
            parseCount={activeDocument ? 1 : 0}
            queueCount={0}
          />
          <main className={styles.workspace}>{children}</main>
        </div>
        {toast && (
          <Toast key={toast.id} message={toast.message} tone={toast.tone} />
        )}
      </div>
    </AppShellContext.Provider>
  );
}
