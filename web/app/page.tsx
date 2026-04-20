"use client";

import * as React from "react";
import { Topbar } from "@/components/topbar";
import { Sidebar } from "@/components/sidebar";
import { UploadStage } from "@/components/upload-stage";
import { ParsingOverlay } from "@/components/parsing-overlay";
import { ReviewStagePlaceholder } from "@/components/review-stage-placeholder";
import { Toast } from "@/components/toast";
import { PLACEHOLDER_TEMPLATES } from "@/lib/constants";
import type { AppPhase, DocumentResponse, SidebarView } from "@/lib/types";
import styles from "./app.module.css";

export default function HomePage() {
  const [phase, setPhase] = React.useState<AppPhase>("upload");
  const [view, setView] = React.useState<SidebarView>("parse");
  const [document, setDocument] = React.useState<DocumentResponse | null>(null);
  const [activeTemplateId, setActiveTemplateId] = React.useState<string | null>(null);
  const [toast, setToast] = React.useState<{ message: string; tone: "ok" | "err" } | null>(null);

  const showToast = React.useCallback((message: string, tone: "ok" | "err" = "ok") => {
    setToast({ message, tone });
    window.setTimeout(() => setToast(null), 2400);
  }, []);

  const handleUploadStart = () => {
    setPhase("parsing");
  };

  const handleUploadComplete = (doc: DocumentResponse) => {
    setDocument(doc);
    setPhase("review");
    if (doc.status === "Failed") {
      showToast(doc.errorMessage ?? "Parsing failed", "err");
    } else {
      showToast(`Parsed · ${doc.fields.length} fields extracted`);
    }
  };

  const handleUploadError = (message: string) => {
    setPhase("upload");
    showToast(message, "err");
  };

  const handleNewUpload = () => {
    setDocument(null);
    setPhase("upload");
  };

  return (
    <div className={styles.app}>
      <Topbar documentName={document?.fileName} />
      <div className={styles.body}>
        <Sidebar
          view={view}
          onChangeView={setView}
          templates={PLACEHOLDER_TEMPLATES}
          activeTemplateId={activeTemplateId}
          onPickTemplate={setActiveTemplateId}
          parseCount={phase === "review" ? 1 : 0}
          queueCount={0}
        />
        <main className={styles.workspace}>
          {phase === "upload" && (
            <UploadStage
              onUploadStart={handleUploadStart}
              onUploadComplete={handleUploadComplete}
              onUploadError={handleUploadError}
            />
          )}
          {phase === "parsing" && (
            <ParsingOverlay fileName={document?.fileName ?? "document"} />
          )}
          {phase === "review" && document && (
            <ReviewStagePlaceholder document={document} onNewUpload={handleNewUpload} />
          )}
        </main>
      </div>
      {toast && <Toast message={toast.message} tone={toast.tone} />}
    </div>
  );
}
