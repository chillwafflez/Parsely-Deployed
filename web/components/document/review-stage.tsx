"use client";

import * as React from "react";
import { DocumentPane } from "./document-pane";
import { Inspector } from "../inspector/inspector";
import { NameFieldModal } from "../modal/name-field-modal";
import { SaveTemplateModal } from "../modal/save-template-modal";
import {
  createField,
  createTemplate,
  deleteField,
  fileUrl as apiFileUrl,
  updateField,
} from "@/lib/api-client";
import { useAppShell } from "@/lib/app-shell-context";
import type {
  DocumentResponse,
  DrawResult,
  ExtractedField,
  FieldDataType,
  FieldUpdate,
  TemplateApplyTo,
} from "@/lib/types";
import styles from "./review-stage.module.css";

interface ReviewStageProps {
  document: DocumentResponse;
  /**
   * Invoked with a state updater whenever the user mutates the document.
   * Kept as an updater (rather than a new-value callback) so optimistic
   * edits can compose on the freshest server state.
   */
  onDocumentChange: (updater: (prev: DocumentResponse) => DocumentResponse) => void;
}

/**
 * Composes the PDF viewer (left) with the Inspector (right). Owns all
 * document-scoped mutations (edit, create via draw, delete, save-as-template)
 * and surfaces toast + templates-refresh via the shell context. The document
 * itself is a controlled prop — the parent loader keeps the shell in sync.
 */
export function ReviewStage({ document, onDocumentChange }: ReviewStageProps) {
  const { showToast, refreshTemplates } = useAppShell();
  const [selectedFieldId, setSelectedFieldId] = React.useState<string | null>(null);
  const [pendingDraw, setPendingDraw] = React.useState<DrawResult | null>(null);
  const [showSaveTemplate, setShowSaveTemplate] = React.useState(false);

  const pdfUrl = React.useMemo(() => apiFileUrl(document.id), [document.id]);

  /** Apply a field mutation optimistically; returns a rollback closure. */
  const applyOptimisticUpdate = React.useCallback(
    (fieldId: string, mutate: (f: ExtractedField) => ExtractedField) => {
      let previous: ExtractedField | null = null;
      onDocumentChange((prev) => {
        const before = prev.fields.find((f) => f.id === fieldId);
        if (before) previous = before;
        return {
          ...prev,
          fields: prev.fields.map((f) => (f.id === fieldId ? mutate(f) : f)),
        };
      });
      return () => {
        if (!previous) return;
        onDocumentChange((prev) => ({
          ...prev,
          fields: prev.fields.map((f) => (f.id === fieldId ? previous! : f)),
        }));
      };
    },
    [onDocumentChange]
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
        onDocumentChange((prev) => ({
          ...prev,
          fields: prev.fields.map((f) => (f.id === fieldId ? saved : f)),
        }));
      } catch (err) {
        rollback();
        showToast(err instanceof Error ? err.message : "Save failed", "err");
      }
    },
    [applyOptimisticUpdate, document.id, onDocumentChange, showToast]
  );

  const handleDeleteField = React.useCallback(
    async (fieldId: string) => {
      let removed: ExtractedField | null = null;
      let removedIndex = -1;

      onDocumentChange((prev) => {
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
          onDocumentChange((prev) => {
            const fields = [...prev.fields];
            fields.splice(index, 0, restore);
            return { ...prev, fields };
          });
        }
        showToast(err instanceof Error ? err.message : "Delete failed", "err");
      }
    },
    [document.id, onDocumentChange, selectedFieldId, showToast]
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
        onDocumentChange((prev) => ({ ...prev, fields: [...prev.fields, created] }));
        setSelectedFieldId(created.id);
        setPendingDraw(null);
        showToast("Field added — AI will learn this region");
      } catch (err) {
        showToast(err instanceof Error ? err.message : "Create failed", "err");
      }
    },
    [document.id, onDocumentChange, pendingDraw, showToast]
  );

  const handleOpenSaveTemplate = React.useCallback(() => {
    setShowSaveTemplate(true);
  }, []);

  const handleCancelSaveTemplate = React.useCallback(() => {
    setShowSaveTemplate(false);
  }, []);

  const handleSubmitSaveTemplate = React.useCallback(
    async (draft: {
      name: string;
      kind: string;
      description: string;
      applyTo: TemplateApplyTo;
    }) => {
      try {
        const template = await createTemplate({
          name: draft.name,
          kind: draft.kind,
          description: draft.description || null,
          applyTo: draft.applyTo,
          sourceDocumentId: document.id,
        });
        onDocumentChange((prev) => ({
          ...prev,
          templateId: template.id,
          templateName: template.name,
        }));
        setShowSaveTemplate(false);
        void refreshTemplates();
        showToast(`Template saved · ${template.name}`);
      } catch (err) {
        showToast(err instanceof Error ? err.message : "Save template failed", "err");
      }
    },
    [document.id, onDocumentChange, refreshTemplates, showToast]
  );

  const suggestedTemplateName = React.useMemo(() => {
    const vendor = document.fields.find(
      (f) => f.name.toLowerCase() === "vendorname" && f.value
    );
    if (vendor?.value) return `${vendor.value.trim()} — Invoice`;
    return document.fileName.replace(/\.[^.]+$/, "") + " — Template";
  }, [document.fields, document.fileName]);

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
        onSaveTemplate={handleOpenSaveTemplate}
        templateName={document.templateName ?? undefined}
      />
      {pendingDraw && (
        <NameFieldModal
          bbox={pendingDraw.bbox}
          onCancel={handleCancelDraw}
          onSubmit={handleSubmitDraw}
        />
      )}
      {showSaveTemplate && (
        <SaveTemplateModal
          fields={document.fields}
          suggestedName={suggestedTemplateName}
          onCancel={handleCancelSaveTemplate}
          onSubmit={handleSubmitSaveTemplate}
        />
      )}
    </div>
  );
}
