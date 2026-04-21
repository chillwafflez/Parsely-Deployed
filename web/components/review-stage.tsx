"use client";

import * as React from "react";
import { DocumentPane } from "./document-pane";
import { Inspector } from "./inspector";
import { NameFieldModal } from "./name-field-modal";
import { Toast } from "./toast";
import {
  createField,
  deleteField,
  fileUrl as apiFileUrl,
  updateField,
} from "@/lib/api-client";
import type {
  DocumentResponse,
  DrawResult,
  ExtractedField,
  FieldDataType,
  FieldUpdate,
} from "@/lib/types";
import styles from "./review-stage.module.css";

interface ReviewStageProps {
  document: DocumentResponse;
}

/**
 * Composes the PDF viewer (left) with the Inspector (right). Owns document
 * mutations: edit (PATCH), create via drawn region (POST), delete (DELETE).
 * Edits + deletes are optimistic with per-operation rollback; create is
 * pessimistic because the user is already waiting on the modal submission.
 */
export function ReviewStage({ document: initialDocument }: ReviewStageProps) {
  const [document, setDocument] = React.useState(initialDocument);
  const [selectedFieldId, setSelectedFieldId] = React.useState<string | null>(null);
  const [pendingDraw, setPendingDraw] = React.useState<DrawResult | null>(null);
  const [toast, setToast] = React.useState<{ message: string; tone: "ok" | "err" } | null>(null);

  React.useEffect(() => {
    setDocument(initialDocument);
    setSelectedFieldId(null);
    setPendingDraw(null);
  }, [initialDocument]);

  const pdfUrl = React.useMemo(() => apiFileUrl(document.id), [document.id]);

  const showToast = React.useCallback((message: string, tone: "ok" | "err" = "ok") => {
    setToast({ message, tone });
    window.setTimeout(() => setToast(null), 2400);
  }, []);

  /** Apply a field mutation optimistically; returns a rollback closure. */
  const applyOptimisticUpdate = React.useCallback(
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
      const rollback = applyOptimisticUpdate(fieldId, (f) => ({
        ...f,
        ...(update.value !== undefined ? { value: update.value } : {}),
        ...(update.dataType !== undefined ? { dataType: update.dataType } : {}),
        ...(update.isRequired !== undefined ? { isRequired: update.isRequired } : {}),
        isCorrected: true,
      }));

      try {
        const saved = await updateField(document.id, fieldId, update);
        setDocument((prev) => ({
          ...prev,
          fields: prev.fields.map((f) => (f.id === fieldId ? saved : f)),
        }));
      } catch (err) {
        rollback();
        showToast(err instanceof Error ? err.message : "Save failed", "err");
      }
    },
    [applyOptimisticUpdate, document.id, showToast]
  );

  const handleDeleteField = React.useCallback(
    async (fieldId: string) => {
      let removed: ExtractedField | null = null;
      let removedIndex = -1;

      setDocument((prev) => {
        removedIndex = prev.fields.findIndex((f) => f.id === fieldId);
        if (removedIndex >= 0) removed = prev.fields[removedIndex];
        return { ...prev, fields: prev.fields.filter((f) => f.id !== fieldId) };
      });

      if (selectedFieldId === fieldId) setSelectedFieldId(null);

      try {
        await deleteField(document.id, fieldId);
        showToast("Field removed");
      } catch (err) {
        if (removed && removedIndex >= 0) {
          const restore = removed;
          const index = removedIndex;
          setDocument((prev) => {
            const fields = [...prev.fields];
            fields.splice(index, 0, restore);
            return { ...prev, fields };
          });
        }
        showToast(err instanceof Error ? err.message : "Delete failed", "err");
      }
    },
    [document.id, selectedFieldId, showToast]
  );

  const handleDrawComplete = React.useCallback((result: DrawResult) => {
    setPendingDraw(result);
  }, []);

  const handleCancelDraw = React.useCallback(() => {
    setPendingDraw(null);
  }, []);

  const handleSubmitDraw = React.useCallback(
    async (draft: { name: string; dataType: FieldDataType; isRequired: boolean }) => {
      if (!pendingDraw) return;
      try {
        const created = await createField(document.id, {
          name: draft.name,
          dataType: draft.dataType,
          isRequired: draft.isRequired,
          pageNumber: pendingDraw.pageNumber,
          polygon: pendingDraw.polygon,
        });
        setDocument((prev) => ({ ...prev, fields: [...prev.fields, created] }));
        setSelectedFieldId(created.id);
        setPendingDraw(null);
        showToast(`Field added — AI will learn this region`);
      } catch (err) {
        showToast(err instanceof Error ? err.message : "Create failed", "err");
      }
    },
    [document.id, pendingDraw, showToast]
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
        onDrawComplete={handleDrawComplete}
      />
      <Inspector
        fields={document.fields}
        selectedFieldId={selectedFieldId}
        onSelectField={setSelectedFieldId}
        onUpdateField={handleUpdateField}
        onDeleteField={handleDeleteField}
        onSaveTemplate={handleSaveTemplate}
      />
      {pendingDraw && (
        <NameFieldModal
          bbox={pendingDraw.bbox}
          onCancel={handleCancelDraw}
          onSubmit={handleSubmitDraw}
        />
      )}
      {toast && <Toast message={toast.message} tone={toast.tone} />}
    </div>
  );
}
