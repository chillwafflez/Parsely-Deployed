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

const READONLY_VALUE_CLASS = cn(
  "h-8 px-2.5 flex items-center",
  "border border-line rounded-md bg-surface-2",
  "text-ink-2 font-ui text-[13px]"
);

export interface TemplateMetadataDraft {
  name: string;
  description: string;
  vendorHint: string;
}

interface TemplateMetadataFormProps {
  draft: TemplateMetadataDraft;
  /**
   * Display label for the document type the template was created for.
   * Resolved from the template's `modelId` by the parent — kept as a string
   * here so the form doesn't need to know about the catalog.
   */
  typeLabel: string;
  onChange: (patch: Partial<TemplateMetadataDraft>) => void;
  disabled: boolean;
}

/**
 * Left pane of the edit stage. Plain controlled form — dirty tracking and
 * persistence live on the parent stage, which owns the single payload sent
 * to the PUT endpoint. The document type is shown read-only because it's
 * intrinsic to the source upload and changing it would silently rebind the
 * template to a different prebuilt model.
 */
export function TemplateMetadataForm({
  draft,
  typeLabel,
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
        <div className="flex flex-col gap-[5px]">
          <span className={LABEL_CLASS}>Type</span>
          <div
            title="Document type — derived from the source upload, not editable here."
            className={READONLY_VALUE_CLASS}
          >
            {typeLabel}
          </div>
        </div>
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
