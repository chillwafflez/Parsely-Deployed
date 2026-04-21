"use client";

import * as React from "react";
import { Topbar } from "@/components/topbar";
import { Sidebar } from "@/components/sidebar";
import { UploadStage } from "@/components/upload-stage";
import { ParsingOverlay } from "@/components/parsing-overlay";
import { ReviewStage } from "@/components/review-stage";
import { Toast } from "@/components/toast";
import { useTemplates } from "@/lib/hooks/use-templates";
import type { AppPhase, DocumentResponse, SidebarView } from "@/lib/types";
import styles from "./app.module.css";

export default function HomePage() {
  const [phase, setPhase] = React.useState<AppPhase>("upload");
  const [view, setView] = React.useState<SidebarView>("parse");
  const [document, setDocument] = React.useState<DocumentResponse | null>(null);
  const [toast, setToast] = React.useState<{ message: string; tone: "ok" | "err" } | null>(null);

  const { templates, loading: templatesLoading, refresh: refreshTemplates } = useTemplates();

  const activeTemplateId = document?.templateId ?? null;

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
      return;
    }

    if (doc.templateName) {
      const missingRequired = doc.fields.filter((f) => f.isRequired && !f.value).length;
      const base = `Parsed · matched to ${doc.templateName}`;
      const message =
        missingRequired > 0
          ? `${base} · ${missingRequired} required missing`
          : base;
      showToast(message, missingRequired > 0 ? "err" : "ok");
      return;
    }

    showToast(`Parsed · ${doc.fields.length} fields extracted`);
  };

  const handleUploadError = (message: string) => {
    setPhase("upload");
    showToast(message, "err");
  };

  return (
    <div className={styles.app}>
      <Topbar documentName={document?.fileName} />
      <div className={styles.body}>
        <Sidebar
          view={view}
          onChangeView={setView}
          templates={templates}
          activeTemplateId={activeTemplateId}
          onPickTemplate={() => {
            /* Selecting a template from the sidebar is a Phase 2 feature. */
          }}
          templatesLoading={templatesLoading}
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
            <ReviewStage document={document} onTemplatesChanged={refreshTemplates} />
          )}
        </main>
      </div>
      {toast && <Toast message={toast.message} tone={toast.tone} />}
    </div>
  );
}
