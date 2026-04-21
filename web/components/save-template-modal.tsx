"use client";

import * as React from "react";
import { createPortal } from "react-dom";
import { Check, Save } from "lucide-react";
import { Button } from "./button";
import { cn } from "@/lib/cn";
import type { ExtractedField, TemplateApplyTo } from "@/lib/types";
import styles from "./save-template-modal.module.css";

const DOCUMENT_KINDS = [
  "Invoice",
  "Purchase Order",
  "Bank Statement",
  "Tax Form",
  "Insurance Claim",
] as const;

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
    <div className={styles.scrim} onMouseDown={onCancel} role="presentation">
      <div
        className={styles.modal}
        role="dialog"
        aria-modal="true"
        aria-labelledby="save-template-title"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <form onSubmit={handleSubmit}>
          <header className={styles.head}>
            <h2 id="save-template-title">Save corrections as template</h2>
            <p>
              Future documents from this sender will parse using your corrections —
              field anchors, data types, and validation rules.
            </p>
          </header>

          <div className={styles.body}>
            <div className={styles.split}>
              <label className={styles.row}>
                <span className={styles.label}>Template name</span>
                <input
                  ref={nameInputRef}
                  className={styles.input}
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  maxLength={256}
                  autoComplete="off"
                />
              </label>
              <label className={styles.row}>
                <span className={styles.label}>Document kind</span>
                <select
                  className={styles.input}
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

            <label className={styles.row}>
              <span className={styles.label}>Description (optional)</span>
              <textarea
                className={styles.textarea}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={3}
                maxLength={2048}
                placeholder="What corrections did this template capture?"
              />
            </label>

            <div className={styles.row}>
              <span className={styles.label}>Apply to</span>
              <div className={styles.segmented} role="radiogroup">
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
              <p className={styles.hint}>
                New uploads will auto-match this template by layout + vendor name.
              </p>
            </div>

            <div className={styles.row}>
              <span className={styles.label}>
                Field rules captured ({fields.length})
              </span>
              <div className={styles.ruleList}>
                {fields.length === 0 ? (
                  <div className={styles.ruleEmpty}>No fields to capture yet.</div>
                ) : (
                  fields.map((f) => (
                    <div key={f.id} className={styles.rule}>
                      <div className={styles.ruleName}>{f.name}</div>
                      <div className={styles.ruleType}>{f.dataType}</div>
                      <div className={styles.ruleReq}>
                        {f.isRequired ? "required" : "optional"}
                      </div>
                      <Check size={13} className={styles.ruleCheck} />
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>

          <footer className={styles.foot}>
            <Button type="button" onClick={onCancel}>
              Cancel
            </Button>
            <Button
              type="submit"
              variant="primary"
              disabled={!canSubmit}
            >
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
      className={cn(styles.seg, active && styles.segOn)}
      onClick={onClick}
    >
      {children}
    </button>
  );
}
