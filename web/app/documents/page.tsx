"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { DocumentList } from "@/components/document-list";
import { ParsingOverlay } from "@/components/parsing-overlay";
import { useAppShell } from "@/lib/app-shell-context";
import { useDocuments } from "@/lib/hooks/use-documents";
import type { DocumentResponse } from "@/lib/types";

/**
 * Documents history route (`/documents`): shows all prior uploads in a
 * sortable table with template-match badges. Also accepts new uploads —
 * shows the parsing overlay inline and navigates to the review page on
 * success, or refreshes the list so a failed record appears immediately.
 */
export default function DocumentsPage() {
  const router = useRouter();
  const { showToast, setActiveDocument } = useAppShell();
  const { documents, loading, error, refresh } = useDocuments();
  const [parsingFileName, setParsingFileName] = React.useState<string | null>(null);
  const [uploadError, setUploadError] = React.useState<string | null>(null);

  // Ensure no stale document is highlighted in the shell while on this page.
  React.useEffect(() => {
    setActiveDocument(null);
  }, [setActiveDocument]);

  const handleUploadStart = React.useCallback((fileName: string) => {
    setUploadError(null);
    setParsingFileName(fileName);
  }, []);

  const handleUploadComplete = React.useCallback(
    (doc: DocumentResponse) => {
      if (doc.status === "Failed") {
        setParsingFileName(null);
        void refresh();
        setUploadError(doc.errorMessage ?? "Parsing failed. Please try again.");
        return;
      }

      if (doc.templateName) {
        const missingRequired = doc.fields.filter((f) => f.isRequired && !f.value).length;
        const base = `Parsed · matched to ${doc.templateName}`;
        showToast(
          missingRequired > 0 ? `${base} · ${missingRequired} required missing` : base,
          missingRequired > 0 ? "err" : "ok"
        );
      } else {
        showToast(`Parsed · ${doc.fields.length} fields extracted`);
      }

      router.push(`/documents/${doc.id}`);
    },
    [router, showToast, refresh]
  );

  const handleUploadError = React.useCallback((message: string) => {
    setParsingFileName(null);
    setUploadError(message);
  }, []);

  const handleDismissUploadError = React.useCallback(() => {
    setUploadError(null);
  }, []);

  if (parsingFileName) {
    return <ParsingOverlay fileName={parsingFileName} />;
  }

  return (
    <DocumentList
      documents={documents}
      loading={loading}
      error={error}
      uploadError={uploadError}
      onDismissUploadError={handleDismissUploadError}
      onUploadStart={handleUploadStart}
      onUploadComplete={handleUploadComplete}
      onUploadError={handleUploadError}
    />
  );
}
