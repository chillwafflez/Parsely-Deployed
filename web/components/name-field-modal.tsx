"use client";

import * as React from "react";
import { createPortal } from "react-dom";
import { Plus } from "lucide-react";
import { Button } from "./button";
import { cn } from "@/lib/cn";
import { FIELD_TYPES } from "@/lib/constants";
import type { DrawnRect, FieldDataType } from "@/lib/types";
import styles from "./name-field-modal.module.css";

interface NameFieldModalProps {
  bbox: DrawnRect;
  onCancel: () => void;
  onSubmit: (draft: { name: string; dataType: FieldDataType; isRequired: boolean }) => void;
}

export function NameFieldModal({ bbox, onCancel, onSubmit }: NameFieldModalProps) {
  const [name, setName] = React.useState("");
  const [dataType, setDataType] = React.useState<FieldDataType>("string");
  const [isRequired, setIsRequired] = React.useState(true);
  const [mounted, setMounted] = React.useState(false);
  const nameInputRef = React.useRef<HTMLInputElement>(null);

  React.useEffect(() => {
    setMounted(true);
  }, []);

  React.useEffect(() => {
    nameInputRef.current?.focus();
  }, [mounted]);

  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onCancel();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onCancel]);

  if (!mounted) return null;

  const trimmed = name.trim();
  const canSubmit = trimmed.length > 0;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;
    onSubmit({ name: trimmed, dataType, isRequired });
  };

  return createPortal(
    <div className={styles.scrim} onMouseDown={onCancel} role="presentation">
      <div
        className={styles.modal}
        role="dialog"
        aria-modal="true"
        aria-labelledby="name-field-title"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <form onSubmit={handleSubmit}>
          <header className={styles.head}>
            <h2 id="name-field-title">Name this field</h2>
            <p>
              The AI will learn to extract this region on future documents of this type.
            </p>
          </header>

          <div className={styles.body}>
            <label className={styles.row}>
              <span className={styles.label}>Field name</span>
              <input
                ref={nameInputRef}
                className={styles.input}
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Payment Terms"
                maxLength={256}
                autoComplete="off"
              />
            </label>

            <div className={styles.split}>
              <label className={styles.row}>
                <span className={styles.label}>Data type</span>
                <select
                  className={styles.input}
                  value={dataType}
                  onChange={(e) => setDataType(e.target.value as FieldDataType)}
                >
                  {FIELD_TYPES.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.label}
                    </option>
                  ))}
                </select>
              </label>

              <div className={styles.row}>
                <span className={styles.label}>Required?</span>
                <div className={styles.segmented} role="group">
                  <button
                    type="button"
                    className={cn(styles.seg, isRequired && styles.segOn)}
                    onClick={() => setIsRequired(true)}
                  >
                    Required
                  </button>
                  <button
                    type="button"
                    className={cn(styles.seg, !isRequired && styles.segOn)}
                    onClick={() => setIsRequired(false)}
                  >
                    Optional
                  </button>
                </div>
              </div>
            </div>

            <div className={styles.row}>
              <span className={styles.label}>Region</span>
              <div className={styles.regionDisplay}>
                x:{bbox.x.toFixed(1)}% &nbsp; y:{bbox.y.toFixed(1)}% &nbsp;
                w:{bbox.w.toFixed(1)}% &nbsp; h:{bbox.h.toFixed(1)}%
              </div>
            </div>
          </div>

          <footer className={styles.foot}>
            <Button type="button" onClick={onCancel}>
              Cancel
            </Button>
            <Button type="submit" variant="primary" disabled={!canSubmit}>
              <Plus size={13} />
              Add field
            </Button>
          </footer>
        </form>
      </div>
    </div>,
    document.body
  );
}
