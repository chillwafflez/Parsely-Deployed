"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Upload } from "lucide-react";
import { cn } from "@/lib/cn";
import {
  deleteTemplate,
  duplicateTemplate,
  importTemplate,
} from "@/lib/api-client";
import { useAppShell } from "@/lib/app-shell-context";
import { useTemplates } from "@/lib/hooks/use-templates";
import {
  downloadTemplateExport,
  readTemplateExportFile,
} from "@/lib/exporters/template-exporter";
import { ErrorBanner } from "@/components/ui/error-banner";
import { DeleteTemplateModal } from "@/components/modal/delete-template-modal";
import { TemplatesTable } from "@/components/templates/templates-table";
import {
  TemplatesEmptyState,
  TemplatesErrorPanel,
  TemplatesLoadingSkeleton,
} from "@/components/templates/templates-placeholder";
import type { RowAction } from "@/components/templates/template-row-actions";
import type { TemplateSummary } from "@/lib/types";

/**
 * Templates management route (`/templates`). Lists every saved template with
 * Edit / Duplicate / Export / Delete affordances + an Import button in the
 * header. Row click opens the fill flow; the kebab menu exposes the
 * management actions without hijacking the row.
 */
export default function TemplatesPage() {
  const router = useRouter();
  const { showToast, refreshTemplates, setActiveDocument } = useAppShell();
  const { templates, loading, error, refresh } = useTemplates();

  const [pendingDelete, setPendingDelete] = React.useState<TemplateSummary | null>(null);
  const [duplicatingId, setDuplicatingId] = React.useState<string | null>(null);
  const [exportingId, setExportingId] = React.useState<string | null>(null);
  const [importing, setImporting] = React.useState(false);
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  // Nothing on this page belongs to a specific document; clear the shell's
  // active-document highlight so the topbar breadcrumb and sidebar state
  // don't carry over from wherever the user navigated in from.
  React.useEffect(() => {
    setActiveDocument(null);
  }, [setActiveDocument]);

  const handleRowAction = React.useCallback(
    async (action: RowAction, template: TemplateSummary) => {
      if (action === "edit") {
        router.push(`/templates/${template.id}/edit`);
        return;
      }

      if (action === "delete") {
        setPendingDelete(template);
        return;
      }

      if (action === "export") {
        if (exportingId) return;
        setExportingId(template.id);
        try {
          await downloadTemplateExport(template.id);
          showToast(`Exported · ${template.name}`);
        } catch (err) {
          showToast(
            err instanceof Error ? err.message : "Failed to export template",
            "err"
          );
        } finally {
          setExportingId(null);
        }
        return;
      }

      // duplicate
      if (duplicatingId) return;
      setDuplicatingId(template.id);
      try {
        const copy = await duplicateTemplate(template.id);
        // Refresh the sidebar + local list so the copy appears immediately,
        // then land the user on the copy's edit page (natural follow-up — the
        // common flow is duplicate-then-rename).
        await Promise.all([refreshTemplates(), refresh()]);
        showToast(`Duplicated · ${copy.name}`);
        router.push(`/templates/${copy.id}/edit`);
      } catch (err) {
        showToast(
          err instanceof Error ? err.message : "Failed to duplicate template",
          "err"
        );
      } finally {
        setDuplicatingId(null);
      }
    },
    [duplicatingId, exportingId, refresh, refreshTemplates, router, showToast]
  );

  const handleImportClick = React.useCallback(() => {
    if (importing) return;
    fileInputRef.current?.click();
  }, [importing]);

  const handleImportFile = React.useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      // Reset the input value immediately so picking the same file twice in
      // a row still fires the change handler.
      if (fileInputRef.current) fileInputRef.current.value = "";
      if (!file) return;

      setImporting(true);
      try {
        const payload = await readTemplateExportFile(file);
        const imported = await importTemplate(payload);
        await Promise.all([refreshTemplates(), refresh()]);
        showToast(`Imported · ${imported.name}`);
        // Land on the edit page — imported templates typically need a quick
        // review (hints, aliases, vendor hint) before they're used.
        router.push(`/templates/${imported.id}/edit`);
      } catch (err) {
        showToast(
          err instanceof Error ? err.message : "Failed to import template",
          "err"
        );
      } finally {
        setImporting(false);
      }
    },
    [refresh, refreshTemplates, router, showToast]
  );

  const handleConfirmDelete = React.useCallback(async () => {
    if (!pendingDelete) return;
    const target = pendingDelete;
    try {
      await deleteTemplate(target.id);
      setPendingDelete(null);
      await Promise.all([refreshTemplates(), refresh()]);
      showToast(`Template removed · ${target.name}`);
    } catch (err) {
      showToast(
        err instanceof Error ? err.message : "Failed to delete template",
        "err"
      );
      // Re-throw so the modal can keep itself open for retry.
      throw err;
    }
  }, [pendingDelete, refresh, refreshTemplates, showToast]);

  return (
    <div className="flex flex-1 flex-col min-h-0 bg-bg">
      <header
        className={cn(
          "flex items-center gap-3 shrink-0",
          "py-3 px-6 bg-surface border-b border-line"
        )}
      >
        <div className="flex flex-col">
          <h1 className="m-0 text-[15px] font-semibold text-ink tracking-[-0.01em]">
            Templates
          </h1>
          {!loading && (
            <span className="text-[12px] text-ink-3">
              {templates.length === 0
                ? "None yet"
                : `${templates.length} saved`}
            </span>
          )}
        </div>
        <div className="ml-auto">
          <button
            type="button"
            onClick={handleImportClick}
            disabled={importing}
            title="Import a template exported from another Parsely instance"
            className={cn(
              "inline-flex items-center gap-1.5",
              "h-7 px-2.5 rounded-md border",
              "text-[12.5px] font-medium cursor-pointer",
              "bg-surface text-ink-2 border-line",
              "hover:enabled:bg-surface-2 hover:enabled:border-line-strong hover:enabled:text-ink",
              "transition-[background-color,border-color,color] duration-100",
              "disabled:opacity-[0.55] disabled:cursor-not-allowed"
            )}
          >
            <Upload size={13} aria-hidden="true" />
            {importing ? "Importing…" : "Import template"}
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept=".json,application/json"
            className="hidden"
            onChange={handleImportFile}
          />
        </div>
      </header>

      <div className="flex-1 overflow-y-auto py-5 px-6">
        {error && !loading && (
          <div className="mb-4">
            <ErrorBanner title="Couldn't load templates" message={error} />
          </div>
        )}

        {loading ? (
          <TemplatesLoadingSkeleton />
        ) : error && templates.length === 0 ? (
          <TemplatesErrorPanel message={error} />
        ) : templates.length === 0 ? (
          <TemplatesEmptyState />
        ) : (
          <TemplatesTable
            templates={templates}
            busyTemplateId={duplicatingId}
            onRowAction={handleRowAction}
          />
        )}
      </div>

      {pendingDelete && (
        <DeleteTemplateModal
          templateName={pendingDelete.name}
          runs={pendingDelete.runs}
          onCancel={() => setPendingDelete(null)}
          onConfirm={handleConfirmDelete}
        />
      )}
    </div>
  );
}
