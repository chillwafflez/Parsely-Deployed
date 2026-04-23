"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Check, Save } from "lucide-react";
import { Button } from "../ui/button";
import { cn } from "@/lib/cn";
import { updateTemplate } from "@/lib/api-client";
import { useAppShell } from "@/lib/app-shell-context";
import type { Template, UpdateTemplateRequest } from "@/lib/types";
import {
  TemplateMetadataForm,
  type TemplateMetadataDraft,
} from "./template-metadata-form";
import { TemplateRulesEditor } from "./template-rules-editor";
import type { RuleDraft } from "./template-rule-row";
import { TemplatePreviewPane } from "./template-preview-pane";

interface TemplateEditStageProps {
  template: Template;
}

interface EditDraft {
  metadata: TemplateMetadataDraft;
  rules: RuleDraft[];
}

/**
 * Two-pane editor with a ghosted preview below. Owns the canonical draft
 * state + dirty tracking + pessimistic save. On error the stage rolls back
 * to the last-saved snapshot so a failed network write doesn't silently
 * leave the UI with values that aren't on the server.
 */
export function TemplateEditStage({ template }: TemplateEditStageProps) {
  const router = useRouter();
  const { showToast, refreshTemplates } = useAppShell();

  const initial = React.useMemo(() => toDraft(template), [template]);
  const [draft, setDraft] = React.useState<EditDraft>(initial);
  const [snapshot, setSnapshot] = React.useState<EditDraft>(initial);
  const [submitting, setSubmitting] = React.useState(false);

  const isDirty = React.useMemo(
    () => JSON.stringify(draft) !== JSON.stringify(snapshot),
    [draft, snapshot]
  );

  // Browser tab close / refresh — only fires for native navigation, not
  // in-app router.push. Same caveat the spec calls out in §8.
  React.useEffect(() => {
    if (!isDirty) return;
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      // Spec-compliant signal for Chrome; most modern browsers show their
      // own generic message and ignore the returnValue content.
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [isDirty]);

  const patchMetadata = React.useCallback(
    (patch: Partial<TemplateMetadataDraft>) => {
      setDraft((prev) => ({
        ...prev,
        metadata: { ...prev.metadata, ...patch },
      }));
    },
    []
  );

  const patchRule = React.useCallback(
    (id: string, patch: Partial<RuleDraft>) => {
      setDraft((prev) => ({
        ...prev,
        rules: prev.rules.map((r) => (r.id === id ? { ...r, ...patch } : r)),
      }));
    },
    []
  );

  const removeRule = React.useCallback((id: string) => {
    setDraft((prev) => ({
      ...prev,
      rules: prev.rules.map((r) => (r.id === id ? { ...r, removed: true } : r)),
    }));
  }, []);

  const undoRemoveRule = React.useCallback((id: string) => {
    setDraft((prev) => ({
      ...prev,
      rules: prev.rules.map((r) => (r.id === id ? { ...r, removed: false } : r)),
    }));
  }, []);

  const handleCancel = React.useCallback(() => {
    if (isDirty) {
      const confirmed = window.confirm(
        "You have unsaved changes. Discard them and leave?"
      );
      if (!confirmed) return;
    }
    router.push("/templates");
  }, [isDirty, router]);

  const handleSave = React.useCallback(async () => {
    if (submitting) return;

    const trimmedName = draft.metadata.name.trim();
    if (!trimmedName) {
      showToast("Name is required.", "err");
      return;
    }

    const payload: UpdateTemplateRequest = {
      name: trimmedName,
      description: emptyToNull(draft.metadata.description.trim()),
      kind: draft.metadata.kind.trim() || "Invoice",
      vendorHint: emptyToNull(draft.metadata.vendorHint.trim()),
      rules: draft.rules
        .filter((r) => !r.removed)
        .map((r) => ({
          id: r.id,
          name: r.name.trim(),
          dataType: r.dataType,
          isRequired: r.isRequired,
          hint: emptyToNull(r.hint.trim()),
          aliases: parseAliases(r.aliases),
        })),
    };

    // Guard against sending an empty-string rule name — server validation
    // would reject it but we can catch it earlier with a cleaner message.
    const blankRule = payload.rules.find((r) => r.name.length === 0);
    if (blankRule) {
      showToast("Every rule needs a name.", "err");
      return;
    }

    setSubmitting(true);
    try {
      const updated = await updateTemplate(template.id, payload);
      const nextDraft = toDraft(updated);
      setDraft(nextDraft);
      setSnapshot(nextDraft);
      await refreshTemplates();
      showToast("Template updated");
    } catch (err) {
      // Pessimistic: roll back to the last-saved snapshot so the UI
      // doesn't silently diverge from the server.
      setDraft(snapshot);
      showToast(
        err instanceof Error ? err.message : "Failed to update template",
        "err"
      );
    } finally {
      setSubmitting(false);
    }
  }, [
    draft,
    refreshTemplates,
    showToast,
    snapshot,
    submitting,
    template.id,
  ]);

  return (
    <section
      aria-label="Edit template"
      className="flex flex-col flex-1 min-w-0 min-h-0 bg-bg"
    >
      <header
        className={cn(
          "flex items-center gap-3 shrink-0",
          "py-2.5 px-4 bg-surface border-b border-line"
        )}
      >
        <Button variant="ghost" onClick={handleCancel} aria-label="Back to templates">
          <ArrowLeft size={14} />
        </Button>
        <div className="flex flex-col min-w-0">
          <h1
            title={template.name}
            className={cn(
              "m-0 text-[14px] font-semibold text-ink tracking-[-0.01em]",
              "overflow-hidden text-ellipsis whitespace-nowrap"
            )}
          >
            {draft.metadata.name || template.name}
          </h1>
          <span className="text-[11.5px] text-ink-4">
            {isDirty ? "Unsaved changes" : "All changes saved"}
          </span>
        </div>
        <div className="ml-auto flex items-center gap-2">
          <Button onClick={handleCancel} disabled={submitting}>
            Cancel
          </Button>
          <Button
            variant="primary"
            onClick={handleSave}
            disabled={submitting || !isDirty}
            title={isDirty ? "Save changes" : "Nothing to save"}
          >
            {isDirty || submitting ? <Save size={13} /> : <Check size={13} />}
            {submitting ? "Saving…" : "Save changes"}
          </Button>
        </div>
      </header>

      <div className="flex-1 overflow-auto p-5 flex flex-col gap-4">
        <div
          className={cn(
            "grid grid-cols-1 gap-4",
            "lg:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]"
          )}
        >
          <TemplateMetadataForm
            draft={draft.metadata}
            onChange={patchMetadata}
            disabled={submitting}
          />
          <TemplateRulesEditor
            rules={draft.rules}
            disabled={submitting}
            onPatchRule={patchRule}
            onRemoveRule={removeRule}
            onUndoRemoveRule={undoRemoveRule}
          />
        </div>
        <TemplatePreviewPane
          sourceDocumentId={template.sourceDocumentId}
          rules={draft.rules
            .filter((r) => !r.removed)
            // Regions don't change on this page — pull them from the
            // immutable server template instead of threading through the
            // draft (which only tracks the editable fields).
            .map((r) => {
              const source = template.rules.find((sr) => sr.id === r.id);
              return {
                id: r.id,
                name: r.name,
                boundingRegions: source?.boundingRegions ?? [],
              };
            })}
        />
      </div>
    </section>
  );
}

function toDraft(template: Template): EditDraft {
  return {
    metadata: {
      name: template.name,
      description: template.description ?? "",
      kind: template.kind,
      vendorHint: template.vendorHint ?? "",
    },
    rules: template.rules.map((rule) => ({
      id: rule.id,
      name: rule.name,
      dataType: rule.dataType,
      isRequired: rule.isRequired,
      hint: rule.hint ?? "",
      aliases: rule.aliases.join(", "),
      removed: false,
    })),
  };
}

function emptyToNull(value: string): string | null {
  return value.length === 0 ? null : value;
}

function parseAliases(raw: string): string[] {
  return raw
    .split(",")
    .map((a) => a.trim())
    .filter((a) => a.length > 0);
}
