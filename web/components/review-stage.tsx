"use client";

import * as React from "react";
import { DocumentPane } from "./document-pane";
import { Inspector } from "./inspector";
import { Toast } from "./toast";
import { fileUrl as apiFileUrl, updateField } from "@/lib/api-client";
import type { DocumentResponse, ExtractedField, FieldUpdate } from "@/lib/types";
import styles from "./review-stage.module.css";

interface ReviewStageProps {
  document: DocumentResponse;
}

/**
 * Composes the PDF viewer (left) with the Inspector (right). Owns the
 * selected-field state and document-level mutations. Edits are optimistic:
 * applied locally immediately, rolled back per-field if the server rejects
 * the PATCH.
 */
export function ReviewStage({ document: initialDocument }: ReviewStageProps) {
  const [document, setDocument] = React.useState(initialDocument);
  const [selectedFieldId, setSelectedFieldId] = React.useState<string | null>(null);
  const [toast, setToast] = React.useState<{ message: string; tone: "ok" | "err" } | null>(null);

  // Sync local state if the parent swaps in a different document entirely.
  React.useEffect(() => {
    setDocument(initialDocument);
    setSelectedFieldId(null);
  }, [initialDocument]);

  const pdfUrl = React.useMemo(() => apiFileUrl(document.id), [document.id]);

  const showToast = React.useCallback((message: string, tone: "ok" | "err" = "ok") => {
    setToast({ message, tone });
    window.setTimeout(() => setToast(null), 2400);
  }, []);

  const applyOptimistic = React.useCallback(
    (fieldId: string, mutate: (f: ExtractedField) => ExtractedField) => {
      let previous: ExtractedField | null = null;
      setDocument((prev) => {
        const before = prev.fields.find((f) => f.id === fieldId);
        if (before) previous = before;
        return {
          ...prev,
          fields: prev.fields.map((f) => (f.id === fieldId ? mutate(f) : f)),
        };
      });
      return () => {
        if (!previous) return;
        setDocument((prev) => ({
          ...prev,
          fields: prev.fields.map((f) => (f.id === fieldId ? previous! : f)),
        }));
      };
    },
    []
  );

  const handleUpdateField = React.useCallback(
    async (fieldId: string, update: FieldUpdate) => {
      const rollback = applyOptimistic(fieldId, (f) => ({
        ...f,
        ...(update.value !== undefined ? { value: update.value } : {}),
        ...(update.dataType !== undefined ? { dataType: update.dataType } : {}),
        ...(update.isRequired !== undefined ? { isRequired: update.isRequired } : {}),
        isCorrected: true,
      }));

      try {
        const saved = await updateField(document.id, fieldId, update);
        // Reconcile with the server's authoritative copy (timestamps, etc.).
        setDocument((prev) => ({
          ...prev,
          fields: prev.fields.map((f) => (f.id === fieldId ? saved : f)),
        }));
      } catch (err) {
        rollback();
        showToast(err instanceof Error ? err.message : "Save failed", "err");
      }
    },
    [applyOptimistic, document.id, showToast]
  );

  const handleDeleteField = React.useCallback(
    (fieldId: string) => {
      // Day 5 wires a real DELETE endpoint. Until then, no-op with a toast
      // so the UX is obvious rather than broken.
      showToast("Field delete lands in Day 5", "err");
      // Swallow the id so linters don't complain about unused parameters.
      void fieldId;
    },
    [showToast]
  );

  const handleSaveTemplate = React.useCallback(() => {
    showToast("Save-as-template lands in Day 6", "err");
  }, [showToast]);

  return (
    <div className={styles.wrapper}>
      <DocumentPane
        fileUrl={pdfUrl}
        fileName={document.fileName}
        fields={document.fields}
        selectedFieldId={selectedFieldId}
        onSelectField={setSelectedFieldId}
      />
      <Inspector
        fields={document.fields}
        selectedFieldId={selectedFieldId}
        onSelectField={setSelectedFieldId}
        onUpdateField={handleUpdateField}
        onDeleteField={handleDeleteField}
        onSaveTemplate={handleSaveTemplate}
      />
      {toast && <Toast message={toast.message} tone={toast.tone} />}
    </div>
  );
}
