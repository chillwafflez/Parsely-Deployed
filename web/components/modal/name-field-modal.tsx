"use client";

import * as React from "react";
import { createPortal } from "react-dom";
import { Plus } from "lucide-react";
import { Button } from "../ui/button";
import { cn } from "@/lib/cn";
import { FIELD_TYPES } from "@/lib/constants";
import type { DrawnRect, FieldDataType } from "@/lib/types";

interface NameFieldModalProps {
  bbox: DrawnRect;
  onCancel: () => void;
  onSubmit: (draft: { name: string; dataType: FieldDataType; isRequired: boolean }) => void;
}

const LABEL_CLASS =
  "text-[11px] text-ink-3 font-semibold tracking-[0.04em] uppercase";

const INPUT_CLASS = cn(
  "h-8 px-2.5 border border-line rounded-md",
  "bg-surface text-ink font-ui text-[13px]",
  "focus:outline-0 focus:border-accent",
  "focus:shadow-[0_0_0_3px_var(--color-accent-weak)]"
);

const SEG_BASE =
  "flex-1 border-0 border-r border-line last:border-r-0 cursor-pointer font-ui text-[12px]";

const SEG_ACTIVE =
  "bg-surface text-ink font-medium shadow-[inset_0_-2px_0_var(--color-accent)]";

const SEG_INACTIVE = "bg-transparent text-ink-2";

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
    <div
      onMouseDown={onCancel}
      role="presentation"
      className="fixed inset-0 z-[100] grid place-items-center bg-[rgba(15,23,42,0.32)] animate-scrim-fade"
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="name-field-title"
        onMouseDown={(e) => e.stopPropagation()}
        className="w-[440px] max-w-[92vw] bg-surface rounded-lg shadow-lg overflow-hidden animate-modal-pop"
      >
        <form onSubmit={handleSubmit}>
          <header className="pt-4 px-5 pb-2.5 border-b border-line">
            <h2
              id="name-field-title"
              className="m-0 text-[16px] font-semibold tracking-[-0.01em]"
            >
              Name this field
            </h2>
            <p className="mt-1 mb-0 text-ink-3 text-[12.5px]">
              The AI will learn to extract this region on future documents of this type.
            </p>
          </header>

          <div className="py-4 px-5 flex flex-col gap-3.5 max-h-[60vh] overflow-auto">
            <label className="flex flex-col gap-[5px]">
              <span className={LABEL_CLASS}>Field name</span>
              <input
                ref={nameInputRef}
                className={INPUT_CLASS}
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Payment Terms"
                maxLength={256}
                autoComplete="off"
              />
            </label>

            <div className="grid grid-cols-[1fr_1fr] gap-3.5">
              <label className="flex flex-col gap-[5px]">
                <span className={LABEL_CLASS}>Data type</span>
                <select
                  className={INPUT_CLASS}
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

              <div className="flex flex-col gap-[5px]">
                <span className={LABEL_CLASS}>Required?</span>
                <div
                  role="group"
                  className="flex h-8 border border-line rounded-md overflow-hidden bg-surface-2"
                >
                  <button
                    type="button"
                    onClick={() => setIsRequired(true)}
                    className={cn(SEG_BASE, isRequired ? SEG_ACTIVE : SEG_INACTIVE)}
                  >
                    Required
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsRequired(false)}
                    className={cn(SEG_BASE, !isRequired ? SEG_ACTIVE : SEG_INACTIVE)}
                  >
                    Optional
                  </button>
                </div>
              </div>
            </div>

            <div className="flex flex-col gap-[5px]">
              <span className={LABEL_CLASS}>Region</span>
              <div className="font-mono text-[11.5px] text-ink-3 py-1.5 px-2.5 bg-surface-2 rounded-md border border-line">
                x:{bbox.x.toFixed(1)}% &nbsp; y:{bbox.y.toFixed(1)}% &nbsp;
                w:{bbox.w.toFixed(1)}% &nbsp; h:{bbox.h.toFixed(1)}%
              </div>
            </div>
          </div>

          <footer className="flex items-center gap-2 justify-end py-3 px-5 bg-surface-2 border-t border-line">
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
