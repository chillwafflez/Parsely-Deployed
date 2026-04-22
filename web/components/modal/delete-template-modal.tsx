"use client";

import * as React from "react";
import { createPortal } from "react-dom";
import { AlertTriangle, Trash2 } from "lucide-react";
import { Button } from "../ui/button";
import styles from "./delete-template-modal.module.css";

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
      className={styles.scrim}
      onMouseDown={handleScrimMouseDown}
      role="presentation"
    >
      <div
        className={styles.modal}
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="delete-template-title"
        aria-describedby="delete-template-desc"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <header className={styles.head}>
          <div className={styles.headIcon}>
            <AlertTriangle size={20} aria-hidden="true" />
          </div>
          <div className={styles.headText}>
            <h2 id="delete-template-title">
              Delete template <b>“{templateName}”</b>?
            </h2>
            <p id="delete-template-desc">
              This will remove the template and its field rules. It can&rsquo;t be undone.
            </p>
          </div>
        </header>

        {runs > 0 && (
          <div className={styles.body}>
            <div className={styles.impact}>
              <span>
                <b>{runsLabel}</b> matched to this template. Their extracted fields
                stay intact, but they will no longer show the template badge.
              </span>
            </div>
          </div>
        )}

        <footer className={styles.foot}>
          <Button type="button" onClick={onCancel} disabled={submitting}>
            Cancel
          </Button>
          <button
            ref={confirmBtnRef}
            type="button"
            className={styles.dangerBtn}
            onClick={handleConfirm}
            disabled={submitting}
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
