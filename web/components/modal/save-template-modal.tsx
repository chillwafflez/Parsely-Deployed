"use client";

import * as React from "react";
import { createPortal } from "react-dom";
import { Check, Save } from "lucide-react";
import { Button } from "../ui/button";
import { cn } from "@/lib/cn";
import type { ExtractedField, TemplateApplyTo } from "@/lib/types";

const DOCUMENT_KINDS = [
  "Invoice",
  "Purchase Order",
  "Bank Statement",
  "Tax Form",
  "Insurance Claim",
] as const;

const LABEL_CLASS =
  "text-[11px] text-ink-3 font-semibold tracking-[0.04em] uppercase";

const INPUT_CLASS = cn(
  "h-8 px-2.5 border border-line rounded-md",
  "bg-surface text-ink font-ui text-[13px]",
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

interface SaveTemplateModalProps {
  fields: ExtractedField[];
  /** Suggested name (e.g., vendor-derived) shown as the default. */
  suggestedName: string;
  onCancel: () => void;
  onSubmit: (draft: {
    name: string;
    kind: string;
    description: string;
    applyTo: TemplateApplyTo;
  }) => void | Promise<void>;
}

export function SaveTemplateModal({
  fields,
  suggestedName,
  onCancel,
  onSubmit,
}: SaveTemplateModalProps) {
  const [name, setName] = React.useState(suggestedName);
  const [kind, setKind] = React.useState<string>("Invoice");
  const [description, setDescription] = React.useState("");
  const [applyTo, setApplyTo] = React.useState<TemplateApplyTo>("similar");
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;
    setSubmitting(true);
    try {
      await onSubmit({
        name: name.trim(),
        kind,
        description: description.trim(),
        applyTo,
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
            <h2
              id="save-template-title"
              className="m-0 text-[16px] font-semibold tracking-[-0.01em]"
            >
              Save corrections as template
            </h2>
            <p className="mt-1 mb-0 text-ink-3 text-[12.5px]">
              Future documents from this sender will parse using your corrections —
              field anchors, data types, and validation rules.
            </p>
          </header>

          <div className="py-4 px-5 flex flex-col gap-3.5 max-h-[60vh] overflow-auto">
            <div className="grid grid-cols-[1fr_200px] gap-3.5">
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
                <span className={LABEL_CLASS}>Document kind</span>
                <select
                  className={INPUT_CLASS}
                  value={kind}
                  onChange={(e) => setKind(e.target.value)}
                >
                  {DOCUMENT_KINDS.map((k) => (
                    <option key={k} value={k}>
                      {k}
                    </option>
                  ))}
                </select>
              </label>
            </div>

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
                  All invoices
                </SegButton>
              </div>
              <p className="m-0 text-[11.5px] text-ink-4">
                New uploads will auto-match this template by layout + vendor name.
              </p>
            </div>

            <div className="flex flex-col gap-[5px]">
              <span className={LABEL_CLASS}>
                Field rules captured ({fields.length})
              </span>
              <div className="flex flex-col gap-1 max-h-[200px] overflow-auto border border-line rounded-md p-2 bg-surface-2">
                {fields.length === 0 ? (
                  <div className="p-2.5 text-center text-ink-4 text-[12px]">
                    No fields to capture yet.
                  </div>
                ) : (
                  fields.map((f) => (
                    <div
                      key={f.id}
                      className="grid grid-cols-[1fr_110px_70px_20px] items-center gap-2 text-[12px] py-0.5 px-1"
                    >
                      <div className="font-medium text-ink overflow-hidden text-ellipsis whitespace-nowrap">
                        {f.name}
                      </div>
                      <div className="font-mono text-[11px] text-ink-3">
                        {f.dataType}
                      </div>
                      <div className="font-mono text-[11px] text-ink-3">
                        {f.isRequired ? "required" : "optional"}
                      </div>
                      <Check size={13} className="text-ok" />
                    </div>
                  ))
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
