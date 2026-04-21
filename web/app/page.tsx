"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { ErrorBanner } from "@/components/error-banner";
import { ParsingOverlay } from "@/components/parsing-overlay";
import { UploadStage } from "@/components/upload-stage";
import { useAppShell } from "@/lib/app-shell-context";
import type { DocumentResponse } from "@/lib/types";
import styles from "./page.module.css";

/**
 * Landing route: pick a file, show the parsing overlay while the upload
 * round-trips to Azure, then push to `/documents/[id]` on success. Upload
 * failures surface as a persistent inline banner above the dropzone;
 * successful parses still use toasts so the confirmation rides the route
 * transition to the review page.
 */
export default function HomePage() {
  const router = useRouter();
  const { showToast, setActiveDocument } = useAppShell();
  const [parsingFileName, setParsingFileName] = React.useState<string | null>(null);
  const [uploadError, setUploadError] = React.useState<string | null>(null);

  // Clear any leftover document breadcrumb when the user lands here.
  React.useEffect(() => {
    setActiveDocument(null);
  }, [setActiveDocument]);

  const handleUploadStart = React.useCallback((fileName: string) => {
    // Clear any prior error so the banner doesn't sit there while the user
    // watches their new upload progress.
    setUploadError(null);
    setParsingFileName(fileName);
  }, []);

  const handleUploadComplete = React.useCallback(
    (doc: DocumentResponse) => {
      if (doc.status === "Failed") {
        setParsingFileName(null);
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
    [router, showToast]
  );

  const handleUploadError = React.useCallback((message: string) => {
    setParsingFileName(null);
    setUploadError(message);
  }, []);

  if (parsingFileName) {
    return <ParsingOverlay fileName={parsingFileName} />;
  }

  return (
    <div className={styles.root}>
      {uploadError && (
        <div className={styles.bannerSlot}>
          <ErrorBanner
            title="Upload failed"
            message={uploadError}
            onDismiss={() => setUploadError(null)}
          />
        </div>
      )}
      <UploadStage
        onUploadStart={handleUploadStart}
        onUploadComplete={handleUploadComplete}
        onUploadError={handleUploadError}
      />
    </div>
  );
}
