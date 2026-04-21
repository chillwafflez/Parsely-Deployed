"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { UploadStage } from "@/components/upload-stage";
import { ParsingOverlay } from "@/components/parsing-overlay";
import { useAppShell } from "@/lib/app-shell-context";
import type { DocumentResponse } from "@/lib/types";

/**
 * Landing route: pick a file, show the parsing overlay while the upload
 * round-trips to Azure, then push to `/documents/[id]` on success. The
 * toast is owned by the AppShell so the "matched to X" message survives
 * the navigation and appears on the review page.
 */
export default function HomePage() {
  const router = useRouter();
  const { showToast, setActiveDocument } = useAppShell();
  const [parsingFileName, setParsingFileName] = React.useState<string | null>(null);

  // Clear any leftover document breadcrumb when the user lands here.
  React.useEffect(() => {
    setActiveDocument(null);
  }, [setActiveDocument]);

  const handleUploadStart = React.useCallback((fileName: string) => {
    setParsingFileName(fileName);
  }, []);

  const handleUploadComplete = React.useCallback(
    (doc: DocumentResponse) => {
      if (doc.status === "Failed") {
        setParsingFileName(null);
        showToast(doc.errorMessage ?? "Parsing failed", "err");
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
    [router, showToast]
  );

  const handleUploadError = React.useCallback(
    (message: string) => {
      setParsingFileName(null);
      showToast(message, "err");
    },
    [showToast]
  );

  if (parsingFileName) {
    return <ParsingOverlay fileName={parsingFileName} />;
  }

  return (
    <UploadStage
      onUploadStart={handleUploadStart}
      onUploadComplete={handleUploadComplete}
      onUploadError={handleUploadError}
    />
  );
}
