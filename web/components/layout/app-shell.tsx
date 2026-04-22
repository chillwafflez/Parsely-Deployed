"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Topbar } from "./topbar";
import { Sidebar } from "./sidebar";
import { Toast } from "../ui/toast";
import { AppShellContext, type ToastTone } from "@/lib/app-shell-context";
import { useTemplates } from "@/lib/hooks/use-templates";
import type { DocumentResponse } from "@/lib/types";

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
  const router = useRouter();
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

  const handlePickTemplate = React.useCallback(
    (id: string) => {
      router.push(`/templates/${id}/new`);
    },
    [router]
  );

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
      <div className="grid grid-rows-[56px_1fr] h-screen">
        <Topbar
          documentName={activeDocument?.fileName}
          templateName={activeDocument?.templateName ?? null}
        />
        <div className="grid grid-cols-[272px_1fr] min-h-0">
          <Sidebar
            templates={templates}
            activeTemplateId={activeDocument?.templateId ?? null}
            onPickTemplate={handlePickTemplate}
            templatesLoading={templatesLoading}
            parseCount={activeDocument ? 1 : 0}
            queueCount={0}
          />
          <main className="flex min-h-0 bg-bg">{children}</main>
        </div>
        {toast && (
          <Toast key={toast.id} message={toast.message} tone={toast.tone} />
        )}
      </div>
    </AppShellContext.Provider>
  );
}
