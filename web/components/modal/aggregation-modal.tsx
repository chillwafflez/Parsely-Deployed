"use client";

import * as React from "react";
import { createPortal } from "react-dom";
import { Plus, Sigma } from "lucide-react";
import { Button } from "../ui/button";
import { cn } from "@/lib/cn";
import { previewAggregation } from "@/lib/api-client";
import type {
  AggregationOperation,
  AggregationToken,
  DrawnRect,
} from "@/lib/types";

interface AggregationModalProps {
  documentId: string;
  pageNumber: number;
  polygon: number[];
  bbox: DrawnRect;
  onCancel: () => void;
  onSubmit: (draft: {
    name: string;
    operation: AggregationOperation;
    isRequired: boolean;
  }) => Promise<void> | void;
}

interface OperationCard {
  id: AggregationOperation;
  glyph: string;
  label: string;
  formula: string;
}

const OPERATIONS: OperationCard[] = [
  { id: "Sum",     glyph: "Σ",  label: "Sum",     formula: "Σ x" },
  { id: "Average", glyph: "x̄", label: "Average", formula: "avg(x)" },
  { id: "Count",   glyph: "#",  label: "Count",   formula: "count(x)" },
  { id: "Min",     glyph: "↓",  label: "Min",     formula: "min(x)" },
  { id: "Max",     glyph: "↑",  label: "Max",     formula: "max(x)" },
];

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

/**
 * Post-draw modal for aggregation fields. Calls the preview endpoint once on
 * mount to fetch numeric tokens inside the drawn region, then computes
 * Sum / Avg / Count / Min / Max locally as the user toggles operations — no
 * extra round-trips per op switch. Save POSTs the canonical request; the
 * server recomputes from the layout (not trusting our client-side number).
 */
export function AggregationModal({
  documentId,
  pageNumber,
  polygon,
  bbox,
  onCancel,
  onSubmit,
}: AggregationModalProps) {
  const [name, setName] = React.useState("");
  const [operation, setOperation] = React.useState<AggregationOperation>("Sum");
  const [isRequired, setIsRequired] = React.useState(true);
  const [tokens, setTokens] = React.useState<AggregationToken[] | null>(null);
  const [previewError, setPreviewError] = React.useState<string | null>(null);
  const [submitting, setSubmitting] = React.useState(false);
  const [mounted, setMounted] = React.useState(false);
  const nameInputRef = React.useRef<HTMLInputElement>(null);

  React.useEffect(() => {
    setMounted(true);
  }, []);

  React.useEffect(() => {
    nameInputRef.current?.focus();
  }, [mounted]);

  // Fetch the numeric tokens inside the drawn region. Cancellation guard so
  // a slow request that resolves after the user cancels doesn't try to
  // setState on an unmounted modal.
  React.useEffect(() => {
    let cancelled = false;
    previewAggregation(documentId, { pageNumber, polygon })
      .then((res) => {
        if (cancelled) return;
        setTokens(res.tokens);
      })
      .catch((err) => {
        if (cancelled) return;
        setPreviewError(err instanceof Error ? err.message : "Preview failed");
        setTokens([]);
      });
    return () => {
      cancelled = true;
    };
  }, [documentId, pageNumber, polygon]);

  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !submitting) onCancel();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onCancel, submitting]);

  if (!mounted) return null;

  const values = tokens?.map((t) => t.value) ?? [];
  const result = compute(operation, values);
  const formatted = format(operation, result);

  const trimmed = name.trim();
  const canSubmit = trimmed.length > 0 && tokens !== null && !submitting;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;
    try {
      setSubmitting(true);
      await onSubmit({ name: trimmed, operation, isRequired });
    } finally {
      setSubmitting(false);
    }
  };

  return createPortal(
    <div
      onMouseDown={() => {
        if (!submitting) onCancel();
      }}
      role="presentation"
      className="fixed inset-0 z-[100] grid place-items-center bg-[rgba(15,23,42,0.32)] animate-scrim-fade"
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="aggregation-modal-title"
        onMouseDown={(e) => e.stopPropagation()}
        className="w-[600px] max-w-[92vw] bg-surface rounded-lg shadow-lg overflow-hidden animate-modal-pop"
      >
        <form onSubmit={handleSubmit}>
          <header className="pt-4 px-5 pb-2.5 border-b border-line">
            <h2
              id="aggregation-modal-title"
              className="m-0 text-[16px] font-semibold tracking-[-0.01em] flex items-center gap-2"
            >
              <span
                aria-hidden
                className="w-7 h-7 rounded-md grid place-items-center bg-[var(--color-agg)] text-white"
              >
                <Sigma size={15} />
              </span>
              New aggregation field
            </h2>
            <p className="mt-1 mb-0 text-ink-3 text-[12.5px]">
              Pick a function to roll up the numbers inside the region you
              drew. The result becomes a new field on this document.
            </p>
          </header>

          <div className="py-4 px-5 flex flex-col gap-3.5 max-h-[70vh] overflow-auto">
            <div className="grid grid-cols-[1fr_180px] gap-3.5">
              <label className="flex flex-col gap-[5px]">
                <span className={LABEL_CLASS}>Field name</span>
                <input
                  ref={nameInputRef}
                  className={INPUT_CLASS}
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Line items total"
                  maxLength={256}
                  autoComplete="off"
                />
              </label>
              <div className="flex flex-col gap-[5px]">
                <span className={LABEL_CLASS}>Region</span>
                <div className="font-mono text-[11px] text-ink-3 h-8 px-2.5 flex items-center gap-1.5 bg-surface-2 rounded-md border border-line">
                  <span
                    aria-hidden
                    className="w-2 h-2 rounded-[2px] bg-[var(--color-agg)] shrink-0"
                  />
                  x:{bbox.x.toFixed(0)}% y:{bbox.y.toFixed(0)}% w:
                  {bbox.w.toFixed(0)}% h:{bbox.h.toFixed(0)}%
                </div>
              </div>
            </div>

            <div className="flex flex-col gap-[5px]">
              <span className={LABEL_CLASS}>Required?</span>
              <div
                role="group"
                className="flex h-8 border border-line rounded-md overflow-hidden bg-surface-2 w-fit"
              >
                <button
                  type="button"
                  onClick={() => setIsRequired(true)}
                  className={cn(
                    SEG_BASE,
                    "px-4",
                    isRequired ? SEG_ACTIVE : SEG_INACTIVE
                  )}
                >
                  Required
                </button>
                <button
                  type="button"
                  onClick={() => setIsRequired(false)}
                  className={cn(
                    SEG_BASE,
                    "px-4",
                    !isRequired ? SEG_ACTIVE : SEG_INACTIVE
                  )}
                >
                  Optional
                </button>
              </div>
            </div>

            <div className="flex flex-col gap-[5px]">
              <span className={LABEL_CLASS}>Function</span>
              <div className="grid grid-cols-5 gap-2">
                {OPERATIONS.map((op) => {
                  const selected = op.id === operation;
                  return (
                    <button
                      key={op.id}
                      type="button"
                      onClick={() => setOperation(op.id)}
                      className={cn(
                        "flex flex-col items-center gap-1 px-2 py-3 rounded-md border",
                        "cursor-pointer transition-colors",
                        selected
                          ? "border-[var(--color-agg)] bg-[color-mix(in_oklab,var(--color-agg)_10%,transparent)]"
                          : "border-line bg-surface hover:bg-surface-2"
                      )}
                    >
                      <span
                        className={cn(
                          "text-[18px] font-semibold leading-none",
                          selected ? "text-agg-ink" : "text-ink-2"
                        )}
                      >
                        {op.glyph}
                      </span>
                      <span className="text-[11px] font-medium text-ink">
                        {op.label}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            <PreviewCard
              tokens={tokens}
              operation={operation}
              formatted={formatted}
              error={previewError}
            />
          </div>

          <footer className="flex items-center gap-2 justify-end py-3 px-5 bg-surface-2 border-t border-line">
            <Button type="button" onClick={onCancel} disabled={submitting}>
              Cancel
            </Button>
            <Button type="submit" variant="primary" disabled={!canSubmit}>
              <Plus size={13} />
              {submitting ? "Saving…" : "Add aggregation"}
            </Button>
          </footer>
        </form>
      </div>
    </div>,
    document.body
  );
}

interface PreviewCardProps {
  tokens: AggregationToken[] | null;
  operation: AggregationOperation;
  formatted: string;
  error: string | null;
}

function PreviewCard({ tokens, operation, formatted, error }: PreviewCardProps) {
  const opCard = OPERATIONS.find((o) => o.id === operation)!;

  return (
    <div className="border border-line rounded-md overflow-hidden bg-surface">
      <div className="flex items-center gap-2 px-3 py-2 bg-surface-2 border-b border-line">
        <span
          aria-hidden
          className="w-1.5 h-1.5 rounded-full bg-ok shadow-[0_0_0_3px_color-mix(in_oklab,var(--color-ok)_22%,transparent)]"
        />
        <span className="text-[12px] font-semibold text-ink">Live preview</span>
        {tokens !== null && (
          <span className="ml-auto text-[11px] text-ink-3">
            {tokens.length} value{tokens.length === 1 ? "" : "s"} detected
          </span>
        )}
      </div>
      <div className="grid grid-cols-[1fr_160px] gap-3 p-3">
        <div className="flex flex-col gap-1 min-w-0">
          <div className="text-[10px] uppercase tracking-[0.06em] text-ink-3 font-semibold">
            Detected numbers
          </div>
          {tokens === null ? (
            <div className="text-[12px] text-ink-3 italic py-1">Loading…</div>
          ) : error ? (
            <div className="text-[12px] text-err">{error}</div>
          ) : tokens.length === 0 ? (
            <div className="text-[12px] text-ink-3 italic py-1">
              No numbers detected in this region.
            </div>
          ) : (
            <ol className="m-0 p-0 list-none flex flex-col max-h-[140px] overflow-auto">
              {tokens.map((t, i) => (
                <li
                  key={i}
                  className="flex items-center justify-between gap-2 py-1 border-b border-line last:border-b-0"
                >
                  <span className="text-[10px] font-mono text-ink-3 shrink-0">
                    row {i + 1}
                  </span>
                  <span className="font-mono text-[12px] text-ink truncate">
                    {t.text}
                  </span>
                </li>
              ))}
            </ol>
          )}
        </div>
        <div className="flex flex-col items-stretch gap-1 p-2.5 bg-[color-mix(in_oklab,var(--color-agg)_8%,transparent)] rounded-md border border-[color-mix(in_oklab,var(--color-agg)_25%,transparent)]">
          <div className="text-[9px] uppercase tracking-[0.08em] font-semibold text-agg-ink">
            {opCard.label} result
          </div>
          <div className="font-mono text-[20px] font-semibold text-ink leading-tight break-words">
            {formatted}
          </div>
          <div className="font-mono text-[10px] text-ink-3">{opCard.formula}</div>
        </div>
      </div>
    </div>
  );
}

function compute(operation: AggregationOperation, values: number[]): number | null {
  if (values.length === 0) return operation === "Count" ? 0 : null;
  switch (operation) {
    case "Sum":
      return values.reduce((a, b) => a + b, 0);
    case "Average":
      return values.reduce((a, b) => a + b, 0) / values.length;
    case "Count":
      return values.length;
    case "Min":
      return Math.min(...values);
    case "Max":
      return Math.max(...values);
  }
}

function format(operation: AggregationOperation, value: number | null): string {
  if (value === null) return "—";
  if (operation === "Count") return Math.trunc(value).toString();
  return value.toFixed(2);
}
