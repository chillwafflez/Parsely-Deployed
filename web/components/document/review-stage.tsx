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
import { getDocumentTypeName } from "@/lib/document-types";
import {
  isFieldSelection,
  selectedFieldId as selectedFieldIdOf,
  type Selection,
} from "@/lib/selection";
import type {
  DocumentResponse,
  DrawResult,
  ExtractedField,
  FieldDataType,
  FieldUpdate,
  RuleOverride,
  TemplateApplyTo,
} from "@/lib/types";

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
  const { showToast, refreshTemplates, documentTypes } = useAppShell();
  // Single source of truth for "what's highlighted on the document". Phase D
  // will widen the producers (drawer cell-clicks dispatch the tableCell variant);
  // the discriminated union prevents a stale field highlight from leaking
  // through when a cell becomes the active selection.
  const [selection, setSelection] = React.useState<Selection | null>(null);
  /**
   * Which table is "active" in the inspector list (Phase C) and, in Phase D,
   * which tab the bottom drawer opens to. Independent of `selection` so the
   * drawer can stay open while the user inspects an unrelated field.
   */
  const [activeTableId, setActiveTableId] = React.useState<string | null>(null);
  const [pendingDraw, setPendingDraw] = React.useState<DrawResult | null>(null);
  const [showSaveTemplate, setShowSaveTemplate] = React.useState(false);

  const selectedFieldId = selectedFieldIdOf(selection);

  const handleSelectField = React.useCallback((id: string | null) => {
    setSelection(id ? { kind: "field", fieldId: id } : null);
  }, []);

  const handleSelectTable = React.useCallback((id: string) => {
    setActiveTableId((prev) => {
      if (prev === id) return null;
      // Switching tables clears any field highlight so the user's attention
      // shifts cleanly — same intent as field-to-field clicks replacing the
      // previous selection rather than stacking.
      setSelection(null);
      return id;
    });
  }, []);

  // Catalog-resolved type label used by the Inspector + SaveTemplateModal.
  const typeLabel = React.useMemo(
    () => getDocumentTypeName(documentTypes, document.modelId),
    [documentTypes, document.modelId]
  );

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

      if (isFieldSelection(selection) && selection.fieldId === fieldId) {
        setSelection(null);
      }

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
    [document.id, onDocumentChange, selection, showToast]
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
        setSelection({ kind: "field", fieldId: created.id });
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
      description: string;
      applyTo: TemplateApplyTo;
      ruleOverrides?: Record<string, RuleOverride>;
    }) => {
      try {
        const template = await createTemplate({
          name: draft.name,
          description: draft.description || null,
          applyTo: draft.applyTo,
          sourceDocumentId: document.id,
          ruleOverrides: draft.ruleOverrides,
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
    const stem = vendor?.value
      ? vendor.value.trim()
      : document.fileName.replace(/\.[^.]+$/, "");
    return `${stem} — ${typeLabel}`;
  }, [document.fields, document.fileName, typeLabel]);

  return (
    <div className="flex flex-1 min-w-0 min-h-0 bg-bg">
      <DocumentPane
        fileUrl={pdfUrl}
        fileName={document.fileName}
        fields={document.fields}
        selectedFieldId={selectedFieldId}
        onSelectField={handleSelectField}
        onDrawComplete={handleDrawComplete}
      />
      <Inspector
        fields={document.fields}
        tables={document.tables}
        fileName={document.fileName}
        modelId={document.modelId}
        typeLabel={typeLabel}
        selectedFieldId={selectedFieldId}
        onSelectField={handleSelectField}
        activeTableId={activeTableId}
        onSelectTable={handleSelectTable}
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
          modelId={document.modelId}
          documentTypes={documentTypes}
          onCancel={handleCancelSaveTemplate}
          onSubmit={handleSubmitSaveTemplate}
        />
      )}
    </div>
  );
}
