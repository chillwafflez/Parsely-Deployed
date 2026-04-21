"use client";

import * as React from "react";
import { notFound } from "next/navigation";
import { getDocument } from "@/lib/api-client";
import { useAppShell } from "@/lib/app-shell-context";
import { ReviewStage } from "./review-stage";
import {
  DocumentErrorPanel,
  DocumentLoadingPanel,
} from "./document-placeholder";
import type { DocumentResponse } from "@/lib/types";

type LoaderState =
  | { kind: "loading" }
  | { kind: "ready"; document: DocumentResponse }
  | { kind: "not-found" }
  | { kind: "error"; message: string };

interface DocumentLoaderProps {
  documentId: string;
}

/**
 * Owns the canonical document state for `/documents/[id]`: fetches the record
 * on mount, drives the loading/error/not-found placeholders, and hands a
 * controlled `document` + `onDocumentChange` pair to `ReviewStage`. Keeping
 * the state here (rather than inside `ReviewStage`) lets the shell header
 * and sidebar stay in sync with any field edit or template save.
 */
export function DocumentLoader({ documentId }: DocumentLoaderProps) {
  const { setActiveDocument } = useAppShell();
  const [state, setState] = React.useState<LoaderState>({ kind: "loading" });

  React.useEffect(() => {
    let cancelled = false;
    setState({ kind: "loading" });

    (async () => {
      try {
        const doc = await getDocument(documentId);
        if (cancelled) return;
        setState({ kind: "ready", document: doc });
      } catch (err) {
        if (cancelled) return;
        const message = err instanceof Error ? err.message : "Failed to load document";
        if (/\b404\b/.test(message)) {
          setState({ kind: "not-found" });
        } else {
          setState({ kind: "error", message });
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [documentId]);

  // Sync the shell (topbar breadcrumb, sidebar active template) whenever the
  // loader's state changes. Split from the unmount cleanup below so that an
  // edit doesn't flash `null` through the topbar between cleanup and re-run.
  React.useEffect(() => {
    setActiveDocument(state.kind === "ready" ? state.document : null);
  }, [state, setActiveDocument]);

  // Clear on unmount so navigating away from /documents/[id] resets the shell.
  React.useEffect(() => {
    return () => {
      setActiveDocument(null);
    };
  }, [setActiveDocument]);

  const handleDocumentChange = React.useCallback(
    (updater: (prev: DocumentResponse) => DocumentResponse) => {
      setState((curr) => {
        if (curr.kind !== "ready") return curr;
        return { kind: "ready", document: updater(curr.document) };
      });
    },
    []
  );

  if (state.kind === "not-found") notFound();
  if (state.kind === "error") return <DocumentErrorPanel message={state.message} />;
  if (state.kind === "loading") return <DocumentLoadingPanel />;

  return (
    <ReviewStage
      key={state.document.id}
      document={state.document}
      onDocumentChange={handleDocumentChange}
    />
  );
}
