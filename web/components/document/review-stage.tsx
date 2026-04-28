"use client";

import * as React from "react";
import { DocumentPane } from "./document-pane";
import { TableDrawer } from "./table-drawer";
import { Inspector } from "../inspector/inspector";
import { NameFieldModal } from "../modal/name-field-modal";
import { SaveTemplateModal } from "../modal/save-template-modal";
import {
  createField,
  createTemplate,
  deleteField,
  fileUrl as apiFileUrl,
  updateField,
  updateTableCell,
} from "@/lib/api-client";
import {
  exportTableAsCsv,
  exportTableAsJson,
} from "@/lib/exporters/table-exporter";
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
  TableCell,
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

  /**
   * Optimistic table-cell update. Same shape as the field flow: capture the
   * previous cell, mutate locally, PATCH, replace with the server's
   * canonical row on success or restore the captured value on error.
   * Concurrency-safe within a single browser tab — the cell is addressed by
   * (rowIndex, columnIndex), so two edits to different cells never collide.
   */
  const handleUpdateCell = React.useCallback(
    async (
      tableId: string,
      rowIndex: number,
      columnIndex: number,
      content: string | null
    ) => {
      let previous: TableCell | null = null;

      const writeCell = (
        prev: DocumentResponse,
        replace: (cell: TableCell) => TableCell
      ): DocumentResponse => ({
        ...prev,
        tables: prev.tables.map((t) =>
          t.id !== tableId
            ? t
            : {
                ...t,
                cells: t.cells.map((c) =>
                  c.rowIndex === rowIndex && c.columnIndex === columnIndex
                    ? replace(c)
                    : c
                ),
              }
        ),
      });

      onDocumentChange((prev) => {
        const table = prev.tables.find((t) => t.id === tableId);
        previous =
          table?.cells.find(
            (c) => c.rowIndex === rowIndex && c.columnIndex === columnIndex
          ) ?? null;
        return writeCell(prev, (cell) => ({ ...cell, content, isCorrected: true }));
      });

      try {
        const saved = await updateTableCell(document.id, tableId, {
          rowIndex,
          columnIndex,
          content,
        });
        onDocumentChange((prev) => writeCell(prev, () => saved));
      } catch (err) {
        if (previous) {
          const restore = previous;
          onDocumentChange((prev) => writeCell(prev, () => restore));
        }
        showToast(err instanceof Error ? err.message : "Save failed", "err");
      }
    },
    [document.id, onDocumentChange, showToast]
  );

  /**
   * Helper that resolves a tableId → table and forwards to the exporter.
   * Centralised here so the Inspector quick-export and the drawer toolbar
   * share the same lookup + filename logic.
   */
  const exportTable = React.useCallback(
    (tableId: string, format: "csv" | "json") => {
      const table = document.tables.find((t) => t.id === tableId);
      if (!table) return;
      if (format === "csv") {
        exportTableAsCsv(table, document.fileName);
      } else {
        exportTableAsJson(table, document.fileName);
      }
    },
    [document.fileName, document.tables]
  );

  const handleExportTableCsv = React.useCallback(
    (tableId: string) => exportTable(tableId, "csv"),
    [exportTable]
  );

  const handleExportTableJson = React.useCallback(
    (tableId: string) => exportTable(tableId, "json"),
    [exportTable]
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

  // Outer wrapper is column so the bottom drawer can dock under the
  // (DocumentPane + Inspector) row without overlapping either.
  return (
    <div className="flex flex-col flex-1 min-w-0 min-h-0 bg-bg">
      <div className="flex flex-1 min-h-0 min-w-0">
        <DocumentPane
          fileUrl={pdfUrl}
          fileName={document.fileName}
          fields={document.fields}
          tables={document.tables}
          selection={selection}
          activeTableId={activeTableId}
          onSelect={setSelection}
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
          onExportTable={handleExportTableCsv}
          onUpdateField={handleUpdateField}
          onDeleteField={handleDeleteField}
          onSaveTemplate={handleOpenSaveTemplate}
          templateName={document.templateName ?? undefined}
        />
      </div>
      {activeTableId && (
        <TableDrawer
          tables={document.tables}
          activeTableId={activeTableId}
          onSelectTable={handleSelectTable}
          onClose={() => setActiveTableId(null)}
          selection={selection}
          onSelect={setSelection}
          onUpdateCell={handleUpdateCell}
          onExportCsv={handleExportTableCsv}
          onExportJson={handleExportTableJson}
        />
      )}
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
