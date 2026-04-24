"use client";

import * as React from "react";
import { DocumentList } from "@/components/document/document-list";
import { useAppShell } from "@/lib/app-shell-context";
import { useDocuments } from "@/lib/hooks/use-documents";

/**
 * Documents history route (`/documents`): pure browse view of all prior
 * uploads. Uploads themselves happen on `/` — the header CTA and the
 * empty-state link send the user there.
 */
export default function DocumentsPage() {
  const { setActiveDocument } = useAppShell();
  const { documents, loading, error } = useDocuments();

  // Ensure no stale document is highlighted in the shell while on this page.
  React.useEffect(() => {
    setActiveDocument(null);
  }, [setActiveDocument]);

  return <DocumentList documents={documents} loading={loading} error={error} />;
}
