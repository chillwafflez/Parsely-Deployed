"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { LayoutTemplate } from "lucide-react";
import { cn } from "@/lib/cn";
import { duplicateTemplate, deleteTemplate } from "@/lib/api-client";
import { useAppShell } from "@/lib/app-shell-context";
import { useTemplates } from "@/lib/hooks/use-templates";
import { ErrorBanner } from "@/components/ui/error-banner";
import { DeleteTemplateModal } from "@/components/modal/delete-template-modal";
import { TemplatesTable } from "@/components/templates/templates-table";
import {
  TemplatesEmptyState,
  TemplatesErrorPanel,
  TemplatesLoadingSkeleton,
} from "@/components/templates/templates-placeholder";
import type { TemplateSummary } from "@/lib/types";

/**
 * Templates management route (`/templates`). Lists every saved template with
 * Edit / Duplicate / Delete affordances. Row click opens the fill flow, the
 * kebab menu exposes the management actions without hijacking the row.
 */
export default function TemplatesPage() {
  const router = useRouter();
  const { showToast, refreshTemplates, setActiveDocument } = useAppShell();
  const { templates, loading, error, refresh } = useTemplates();

  const [pendingDelete, setPendingDelete] = React.useState<TemplateSummary | null>(null);
  const [duplicatingId, setDuplicatingId] = React.useState<string | null>(null);

  // Nothing on this page belongs to a specific document; clear the shell's
  // active-document highlight so the topbar breadcrumb and sidebar state
  // don't carry over from wherever the user navigated in from.
  React.useEffect(() => {
    setActiveDocument(null);
  }, [setActiveDocument]);

  const handleRowAction = React.useCallback(
    async (action: "edit" | "duplicate" | "delete", template: TemplateSummary) => {
      if (action === "edit") {
        router.push(`/templates/${template.id}/edit`);
        return;
      }

      if (action === "delete") {
        setPendingDelete(template);
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
    [duplicatingId, refresh, refreshTemplates, router, showToast]
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
            disabled
            title="Save one from the review screen after a parse"
            className={cn(
              "inline-flex items-center gap-1.5",
              "h-7 px-2.5 rounded-md border",
              "text-[12.5px] font-medium",
              "bg-surface text-ink-3 border-line",
              "disabled:opacity-[0.55] disabled:cursor-not-allowed"
            )}
          >
            <LayoutTemplate size={13} aria-hidden="true" />
            New template
          </button>
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
