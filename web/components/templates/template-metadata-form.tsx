"use client";

import { cn } from "@/lib/cn";

export const LABEL_CLASS =
  "text-[11px] text-ink-3 font-semibold tracking-[0.04em] uppercase";

export const INPUT_CLASS = cn(
  "h-8 px-2.5 border border-line rounded-md",
  "bg-surface text-ink font-ui text-[13px]",
  "focus:outline-0 focus:border-accent",
  "focus:shadow-[0_0_0_3px_var(--color-accent-weak)]"
);

export const TEXTAREA_CLASS = cn(
  "py-2 px-2.5 border border-line rounded-md",
  "bg-surface text-ink font-ui text-[12.5px]",
  "resize-y min-h-[72px]",
  "focus:outline-0 focus:border-accent",
  "focus:shadow-[0_0_0_3px_var(--color-accent-weak)]"
);

const DOCUMENT_KINDS = [
  "Invoice",
  "Purchase Order",
  "Bank Statement",
  "Tax Form",
  "Insurance Claim",
] as const;

export interface TemplateMetadataDraft {
  name: string;
  description: string;
  kind: string;
  vendorHint: string;
}

interface TemplateMetadataFormProps {
  draft: TemplateMetadataDraft;
  onChange: (patch: Partial<TemplateMetadataDraft>) => void;
  disabled: boolean;
}

/**
 * Left pane of the edit stage. Plain controlled form — dirty tracking and
 * persistence live on the parent stage, which owns the single payload sent
 * to the PUT endpoint.
 */
export function TemplateMetadataForm({
  draft,
  onChange,
  disabled,
}: TemplateMetadataFormProps) {
  return (
    <div className="flex flex-col gap-3.5 bg-surface border border-line rounded-lg p-4">
      <h2 className="m-0 text-[13.5px] font-semibold text-ink tracking-[-0.01em]">
        Details
      </h2>

      <label className="flex flex-col gap-[5px]">
        <span className={LABEL_CLASS}>Name</span>
        <input
          className={INPUT_CLASS}
          value={draft.name}
          onChange={(e) => onChange({ name: e.target.value })}
          maxLength={256}
          required
          disabled={disabled}
          autoComplete="off"
        />
      </label>

      <label className="flex flex-col gap-[5px]">
        <span className={LABEL_CLASS}>Description</span>
        <textarea
          className={TEXTAREA_CLASS}
          value={draft.description}
          onChange={(e) => onChange({ description: e.target.value })}
          maxLength={2048}
          disabled={disabled}
          placeholder="Optional — what this template captures"
        />
      </label>

      <div className="grid grid-cols-2 gap-3">
        <label className="flex flex-col gap-[5px]">
          <span className={LABEL_CLASS}>Kind</span>
          <select
            className={INPUT_CLASS}
            value={draft.kind}
            onChange={(e) => onChange({ kind: e.target.value })}
            disabled={disabled}
          >
            {/* Accept the current value even if it isn't one of the presets —
                some templates were saved with custom kinds before the select
                shipped. Otherwise `value` won't match any option and the
                select will visually default to the first entry. */}
            {!DOCUMENT_KINDS.includes(draft.kind as (typeof DOCUMENT_KINDS)[number]) && (
              <option value={draft.kind}>{draft.kind}</option>
            )}
            {DOCUMENT_KINDS.map((k) => (
              <option key={k} value={k}>
                {k}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-[5px]">
          <span className={LABEL_CLASS}>Vendor hint</span>
          <input
            className={INPUT_CLASS}
            value={draft.vendorHint}
            onChange={(e) => onChange({ vendorHint: e.target.value })}
            maxLength={512}
            disabled={disabled}
            placeholder="Vendor name for auto-match"
            autoComplete="off"
          />
        </label>
      </div>
    </div>
  );
}
