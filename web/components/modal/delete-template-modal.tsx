"use client";

import * as React from "react";
import { createPortal } from "react-dom";
import { AlertTriangle, Trash2 } from "lucide-react";
import { cn } from "@/lib/cn";
import { Button } from "../ui/button";

interface DeleteTemplateModalProps {
  templateName: string;
  /** Number of documents currently linked to this template. */
  runs: number;
  onCancel: () => void;
  /**
   * Called when the user confirms. Modal stays mounted and shows a submitting
   * state while the promise is in-flight — the parent unmounts it on settle.
   */
  onConfirm: () => Promise<void>;
}

// Solid-red destructive button. Kept local because this is the only destructive
// confirmation in the app today — if a second one shows up, promote to a
// `variant="destructive"` on <Button>.
const DANGER_BTN_CLASS = cn(
  "inline-flex items-center gap-1.5",
  "h-7 px-3 rounded-md border",
  "font-ui text-[12.5px] font-medium text-white",
  "bg-err border-[color-mix(in_oklab,var(--color-err)_60%,black)]",
  "cursor-pointer",
  "shadow-[0_1px_0_rgba(0,0,0,0.08),inset_0_1px_0_rgba(255,255,255,0.12)]",
  "transition-[background-color,border-color] duration-100",
  "hover:enabled:bg-[color-mix(in_oklab,var(--color-err)_88%,black)]",
  "hover:enabled:border-[color-mix(in_oklab,var(--color-err)_50%,black)]",
  "focus-visible:outline-[2px_solid_var(--color-err)] focus-visible:outline-offset-2",
  "disabled:opacity-60 disabled:cursor-not-allowed"
);

/**
 * Destructive-action confirmation. Matches the NameFieldModal pattern:
 * portal to `document.body`, click-scrim to cancel, Escape to cancel.
 * Explicitly lists how many documents are affected and what happens to them
 * (they keep their data — the backend FK is SetNull).
 */
export function DeleteTemplateModal({
  templateName,
  runs,
  onCancel,
  onConfirm,
}: DeleteTemplateModalProps) {
  const [mounted, setMounted] = React.useState(false);
  const [submitting, setSubmitting] = React.useState(false);
  const confirmBtnRef = React.useRef<HTMLButtonElement>(null);

  React.useEffect(() => {
    setMounted(true);
  }, []);

  React.useEffect(() => {
    // Focus the destructive action so keyboard users can confirm with Enter —
    // but not so aggressively that a stray Return key on an opening click
    // immediately triggers the delete. Deferring with a microtask here is
    // enough to avoid that race.
    if (mounted) {
      queueMicrotask(() => confirmBtnRef.current?.focus());
    }
  }, [mounted]);

  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !submitting) onCancel();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onCancel, submitting]);

  if (!mounted) return null;

  const handleScrimMouseDown = () => {
    if (!submitting) onCancel();
  };

  const handleConfirm = async () => {
    if (submitting) return;
    setSubmitting(true);
    try {
      await onConfirm();
    } finally {
      // Parent typically unmounts on success, but guard for error paths.
      setSubmitting(false);
    }
  };

  const runsLabel = runs === 1 ? "1 document was" : `${runs} documents were`;

  return createPortal(
    <div
      onMouseDown={handleScrimMouseDown}
      role="presentation"
      className="fixed inset-0 z-[100] grid place-items-center bg-[rgba(15,23,42,0.32)] animate-scrim-fade"
    >
      <div
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="delete-template-title"
        aria-describedby="delete-template-desc"
        onMouseDown={(e) => e.stopPropagation()}
        className="w-[460px] max-w-[92vw] bg-surface rounded-lg shadow-lg overflow-hidden animate-modal-pop"
      >
        <header className="flex items-start gap-3 pt-[18px] px-5 pb-2.5">
          <div className="shrink-0 w-[38px] h-[38px] rounded-[10px] bg-err-weak text-err grid place-items-center mt-px">
            <AlertTriangle size={20} aria-hidden="true" />
          </div>
          <div>
            <h2
              id="delete-template-title"
              className="m-0 text-[16px] font-semibold tracking-[-0.01em] text-ink"
            >
              Delete template <b>&ldquo;{templateName}&rdquo;</b>?
            </h2>
            <p
              id="delete-template-desc"
              className="mt-1 mb-0 text-ink-3 text-[13px] leading-[1.5]"
            >
              This will remove the template and its field rules. It can&rsquo;t be undone.
            </p>
          </div>
        </header>

        {runs > 0 && (
          <div className="pt-1 px-5 pb-4">
            <div className="flex items-start gap-2 py-2.5 px-3 bg-surface-2 border border-line rounded-md text-[12.5px] text-ink-2 leading-[1.5]">
              <span>
                <b className="text-ink font-semibold">{runsLabel}</b> matched to this template. Their extracted fields
                stay intact, but they will no longer show the template badge.
              </span>
            </div>
          </div>
        )}

        <footer className="flex items-center gap-2 justify-end py-3 px-5 bg-surface-2 border-t border-line">
          <Button type="button" onClick={onCancel} disabled={submitting}>
            Cancel
          </Button>
          <button
            ref={confirmBtnRef}
            type="button"
            onClick={handleConfirm}
            disabled={submitting}
            className={DANGER_BTN_CLASS}
          >
            <Trash2 size={13} aria-hidden="true" />
            {submitting ? "Deleting…" : "Delete template"}
          </button>
        </footer>
      </div>
    </div>,
    document.body
  );
}
