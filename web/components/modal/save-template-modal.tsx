"use client";

import * as React from "react";
import { createPortal } from "react-dom";
import { Check, ChevronDown, Save } from "lucide-react";
import { Button } from "../ui/button";
import { cn } from "@/lib/cn";
import { getDocumentTypeName } from "@/lib/document-types";
import type {
  DocumentTypeOption,
  ExtractedField,
  RuleOverride,
  TemplateApplyTo,
} from "@/lib/types";

const LABEL_CLASS =
  "text-[11px] text-ink-3 font-semibold tracking-[0.04em] uppercase";

const INPUT_CLASS = cn(
  "h-8 px-2.5 border border-line rounded-md",
  "bg-surface text-ink font-ui text-[13px]",
  "focus:outline-0 focus:border-accent",
  "focus:shadow-[0_0_0_3px_var(--color-accent-weak)]"
);

const INPUT_CLASS_SM = cn(
  "h-7 px-2 border border-line rounded-md",
  "bg-surface text-ink font-ui text-[12px]",
  "focus:outline-0 focus:border-accent",
  "focus:shadow-[0_0_0_3px_var(--color-accent-weak)]"
);

const TEXTAREA_CLASS = cn(
  "py-2 px-2.5 border border-line rounded-md",
  "bg-surface text-ink font-mono text-[12px]",
  "resize-y min-h-[60px]",
  "focus:outline-0 focus:border-accent",
  "focus:shadow-[0_0_0_3px_var(--color-accent-weak)]"
);

const SEG_BASE =
  "flex-1 border-0 border-r border-line last:border-r-0 cursor-pointer font-ui text-[12px]";

const SEG_ACTIVE =
  "bg-surface text-ink font-medium shadow-[inset_0_-2px_0_var(--color-accent)]";

const SEG_INACTIVE = "bg-transparent text-ink-2";

const RULE_SUB_LABEL =
  "text-[10.5px] text-ink-3 font-semibold tracking-[0.04em] uppercase";

/** Per-rule editable state. Stored as raw strings so we don't churn state on every keystroke. */
interface RuleDraft {
  hint: string;
  aliases: string;
}

interface SaveTemplateModalProps {
  fields: ExtractedField[];
  /** Suggested name (e.g., vendor-derived) shown as the default. */
  suggestedName: string;
  /** Source document's Azure DI model id; drives the type label + payload kind. */
  modelId: string;
  /** Catalog used to resolve the type label; passed in from app-shell context. */
  documentTypes: DocumentTypeOption[];
  onCancel: () => void;
  onSubmit: (draft: {
    name: string;
    kind: string;
    description: string;
    applyTo: TemplateApplyTo;
    ruleOverrides?: Record<string, RuleOverride>;
  }) => void | Promise<void>;
}

export function SaveTemplateModal({
  fields,
  suggestedName,
  modelId,
  documentTypes,
  onCancel,
  onSubmit,
}: SaveTemplateModalProps) {
  // Type label is implicit from the source document — the user can't pick a
  // different kind here. Carried into the submit payload as `kind` until the
  // backend contract drops the field in 1D.
  const typeName = React.useMemo(
    () => getDocumentTypeName(documentTypes, modelId),
    [documentTypes, modelId]
  );

  const [name, setName] = React.useState(suggestedName);
  const [description, setDescription] = React.useState("");
  const [applyTo, setApplyTo] = React.useState<TemplateApplyTo>("similar");
  const [drafts, setDrafts] = React.useState<Record<string, RuleDraft>>({});
  const [expanded, setExpanded] = React.useState<Set<string>>(new Set());
  const [submitting, setSubmitting] = React.useState(false);
  const [mounted, setMounted] = React.useState(false);
  const nameInputRef = React.useRef<HTMLInputElement>(null);

  React.useEffect(() => {
    setMounted(true);
  }, []);

  React.useEffect(() => {
    nameInputRef.current?.focus();
    nameInputRef.current?.select();
  }, [mounted]);

  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onCancel();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onCancel]);

  if (!mounted) return null;

  const canSubmit = name.trim().length > 0 && !submitting;

  const toggleExpanded = (fieldName: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(fieldName)) next.delete(fieldName);
      else next.add(fieldName);
      return next;
    });
  };

  const updateDraft = (
    fieldName: string,
    key: keyof RuleDraft,
    value: string
  ) => {
    setDrafts((prev) => ({
      ...prev,
      [fieldName]: { ...(prev[fieldName] ?? { hint: "", aliases: "" }), [key]: value },
    }));
  };

  const buildRuleOverrides = (): Record<string, RuleOverride> | undefined => {
    const result: Record<string, RuleOverride> = {};
    for (const [fieldName, draft] of Object.entries(drafts)) {
      const hint = draft.hint.trim();
      const aliases = draft.aliases
        .split(",")
        .map((a) => a.trim())
        .filter((a) => a.length > 0);
      if (hint.length === 0 && aliases.length === 0) continue;
      result[fieldName] = { hint: hint || null, aliases };
    }
    return Object.keys(result).length > 0 ? result : undefined;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;
    setSubmitting(true);
    try {
      await onSubmit({
        name: name.trim(),
        kind: typeName,
        description: description.trim(),
        applyTo,
        ruleOverrides: buildRuleOverrides(),
      });
    } finally {
      setSubmitting(false);
    }
  };

  return createPortal(
    <div
      onMouseDown={onCancel}
      role="presentation"
      className="fixed inset-0 z-[100] grid place-items-center bg-[rgba(15,23,42,0.32)] animate-scrim-fade"
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="save-template-title"
        onMouseDown={(e) => e.stopPropagation()}
        className="w-[620px] max-w-[92vw] bg-surface rounded-lg shadow-lg overflow-hidden animate-modal-pop"
      >
        <form onSubmit={handleSubmit}>
          <header className="pt-4 px-5 pb-2.5 border-b border-line">
            <div className="flex items-center gap-2">
              <h2
                id="save-template-title"
                className="m-0 text-[16px] font-semibold tracking-[-0.01em]"
              >
                Save corrections as template
              </h2>
              <span
                title="Document type — derived from the source upload"
                className={cn(
                  "inline-flex items-center px-1.5 py-0.5 rounded-md",
                  "bg-accent-weak border border-accent-border text-accent-ink",
                  "text-[11px] font-medium tracking-[0.02em]"
                )}
              >
                {typeName}
              </span>
            </div>
            <p className="mt-1 mb-0 text-ink-3 text-[12.5px]">
              Future documents from this sender will parse using your corrections —
              field anchors, data types, and validation rules.
            </p>
          </header>

          <div className="py-4 px-5 flex flex-col gap-3.5 max-h-[60vh] overflow-auto">
            <label className="flex flex-col gap-[5px]">
              <span className={LABEL_CLASS}>Template name</span>
              <input
                ref={nameInputRef}
                className={INPUT_CLASS}
                value={name}
                onChange={(e) => setName(e.target.value)}
                maxLength={256}
                autoComplete="off"
              />
            </label>

            <label className="flex flex-col gap-[5px]">
              <span className={LABEL_CLASS}>Description (optional)</span>
              <textarea
                className={TEXTAREA_CLASS}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={3}
                maxLength={2048}
                placeholder="What corrections did this template capture?"
              />
            </label>

            <div className="flex flex-col gap-[5px]">
              <span className={LABEL_CLASS}>Apply to</span>
              <div
                role="radiogroup"
                className="flex h-8 max-w-[420px] border border-line rounded-md overflow-hidden bg-surface-2"
              >
                <SegButton
                  active={applyTo === "vendor"}
                  onClick={() => setApplyTo("vendor")}
                >
                  Same vendor
                </SegButton>
                <SegButton
                  active={applyTo === "similar"}
                  onClick={() => setApplyTo("similar")}
                >
                  Similar layout
                </SegButton>
                <SegButton
                  active={applyTo === "all"}
                  onClick={() => setApplyTo("all")}
                >
                  All documents
                </SegButton>
              </div>
              <p className="m-0 text-[11.5px] text-ink-4">
                New uploads will auto-match this template by layout + vendor name.
              </p>
            </div>

            <div className="flex flex-col gap-[5px]">
              <div className="flex items-baseline justify-between">
                <span className={LABEL_CLASS}>
                  Field rules captured ({fields.length})
                </span>
                <span className="text-[11px] text-ink-4">
                  Click a row to add voice hints
                </span>
              </div>
              <div className="flex flex-col border border-line rounded-md bg-surface-2 overflow-hidden">
                {fields.length === 0 ? (
                  <div className="p-2.5 text-center text-ink-4 text-[12px]">
                    No fields to capture yet.
                  </div>
                ) : (
                  fields.map((f) => {
                    const isExpanded = expanded.has(f.name);
                    const draft = drafts[f.name];
                    const hasOverride = Boolean(
                      draft && (draft.hint.trim() || draft.aliases.trim())
                    );
                    return (
                      <div
                        key={f.id}
                        className="border-b border-line last:border-b-0"
                      >
                        <button
                          type="button"
                          onClick={() => toggleExpanded(f.name)}
                          aria-expanded={isExpanded}
                          aria-controls={`rule-${f.id}-panel`}
                          className={cn(
                            "w-full grid grid-cols-[1fr_16px_110px_70px_16px] items-center gap-2",
                            "text-[12px] py-1.5 px-2 text-left",
                            "hover:bg-surface focus:outline-0 focus:bg-surface",
                            "cursor-pointer"
                          )}
                        >
                          <span className="font-medium text-ink overflow-hidden text-ellipsis whitespace-nowrap">
                            {f.name}
                          </span>
                          <span className="flex justify-center">
                            {hasOverride && (
                              <Check
                                size={12}
                                className="text-ok"
                                aria-label="Voice hint set"
                              />
                            )}
                          </span>
                          <span className="font-mono text-[11px] text-ink-3">
                            {f.dataType}
                          </span>
                          <span className="font-mono text-[11px] text-ink-3">
                            {f.isRequired ? "required" : "optional"}
                          </span>
                          <ChevronDown
                            size={13}
                            className={cn(
                              "text-ink-3 transition-transform",
                              isExpanded && "rotate-180"
                            )}
                          />
                        </button>
                        {isExpanded && (
                          <div
                            id={`rule-${f.id}-panel`}
                            className="px-2 pt-1 pb-2.5 flex flex-col gap-1.5 bg-surface"
                          >
                            <label className="flex flex-col gap-0.5">
                              <span className={RULE_SUB_LABEL}>Voice hint</span>
                              <input
                                className={INPUT_CLASS_SM}
                                value={draft?.hint ?? ""}
                                onChange={(e) =>
                                  updateDraft(f.name, "hint", e.target.value)
                                }
                                maxLength={200}
                                placeholder="e.g., the billing contact's full name"
                                autoComplete="off"
                              />
                            </label>
                            <label className="flex flex-col gap-0.5">
                              <span className={RULE_SUB_LABEL}>Aliases</span>
                              <input
                                className={INPUT_CLASS_SM}
                                value={draft?.aliases ?? ""}
                                onChange={(e) =>
                                  updateDraft(f.name, "aliases", e.target.value)
                                }
                                placeholder="PO, P.O., purchase order"
                                autoComplete="off"
                              />
                              <span className="text-[10.5px] text-ink-4 mt-0.5">
                                Separate with commas
                              </span>
                            </label>
                          </div>
                        )}
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          </div>

          <footer className="flex items-center gap-2 justify-end py-3 px-5 bg-surface-2 border-t border-line">
            <Button type="button" onClick={onCancel}>
              Cancel
            </Button>
            <Button type="submit" variant="primary" disabled={!canSubmit}>
              <Save size={13} />
              {submitting ? "Saving…" : "Save template"}
            </Button>
          </footer>
        </form>
      </div>
    </div>,
    document.body
  );
}

function SegButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={active}
      onClick={onClick}
      className={cn(SEG_BASE, active ? SEG_ACTIVE : SEG_INACTIVE)}
    >
      {children}
    </button>
  );
}
