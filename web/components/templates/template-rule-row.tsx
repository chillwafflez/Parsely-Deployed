"use client";

import * as React from "react";
import { ChevronDown, Trash2, Undo2 } from "lucide-react";
import { cn } from "@/lib/cn";
import { FIELD_TYPES } from "@/lib/constants";
import { INPUT_CLASS, LABEL_CLASS } from "./template-metadata-form";

const INPUT_CLASS_SM = cn(
  "h-7 px-2 border border-line rounded-md",
  "bg-surface text-ink font-ui text-[12px]",
  "focus:outline-0 focus:border-accent",
  "focus:shadow-[0_0_0_3px_var(--color-accent-weak)]"
);

export interface RuleDraft {
  id: string;
  name: string;
  dataType: string;
  isRequired: boolean;
  hint: string;
  /** Comma-separated during edit; split on save to match the API contract. */
  aliases: string;
  /** Marked for deletion on save. Row stays visible (struck through) until save. */
  removed: boolean;
}

interface TemplateRuleRowProps {
  rule: RuleDraft;
  expanded: boolean;
  disabled: boolean;
  onToggle: () => void;
  onPatch: (patch: Partial<RuleDraft>) => void;
  onRemove: () => void;
  onUndoRemove: () => void;
}

/**
 * One row in the rules editor. Collapsed: name + type + required + delete.
 * Expanded: name edit + hint + aliases. Delete marks the row for removal on
 * save rather than firing an API call immediately — keeps the PUT payload
 * atomic (one request, full rule diff).
 */
export function TemplateRuleRow({
  rule,
  expanded,
  disabled,
  onToggle,
  onPatch,
  onRemove,
  onUndoRemove,
}: TemplateRuleRowProps) {
  const panelId = `rule-${rule.id}-panel`;

  return (
    <div
      className={cn(
        "border-b border-line last:border-b-0",
        rule.removed && "bg-err-weak/50"
      )}
    >
      <div
        className={cn(
          "grid grid-cols-[1fr_130px_90px_26px_26px] items-center gap-2",
          "py-1.5 px-2"
        )}
      >
        <button
          type="button"
          onClick={onToggle}
          aria-expanded={expanded}
          aria-controls={panelId}
          disabled={disabled}
          className={cn(
            "text-left overflow-hidden text-ellipsis whitespace-nowrap",
            "font-medium text-[12.5px] cursor-pointer bg-transparent border-0 p-0",
            rule.removed ? "text-ink-3 line-through" : "text-ink",
            "hover:text-accent-ink focus:outline-0"
          )}
          title={rule.name}
        >
          {rule.name || <span className="italic text-ink-4">(unnamed)</span>}
        </button>
        <select
          value={rule.dataType}
          onChange={(e) => onPatch({ dataType: e.target.value })}
          disabled={disabled || rule.removed}
          className={cn(INPUT_CLASS_SM, "font-mono text-[11.5px]")}
          aria-label={`${rule.name} data type`}
        >
          {/* Accept an unknown type so templates saved with a custom type
              don't collapse to the first preset on open. */}
          {!FIELD_TYPES.some((t) => t.id === rule.dataType) && rule.dataType && (
            <option value={rule.dataType}>{rule.dataType}</option>
          )}
          {FIELD_TYPES.map((t) => (
            <option key={t.id} value={t.id}>
              {t.label}
            </option>
          ))}
        </select>
        <label
          className={cn(
            "flex items-center gap-1.5 text-[11.5px] cursor-pointer select-none",
            (disabled || rule.removed) && "cursor-not-allowed opacity-60"
          )}
        >
          <input
            type="checkbox"
            checked={rule.isRequired}
            onChange={(e) => onPatch({ isRequired: e.target.checked })}
            disabled={disabled || rule.removed}
            className="cursor-pointer accent-[var(--color-accent)]"
          />
          <span className="text-ink-2">Required</span>
        </label>
        <button
          type="button"
          onClick={onToggle}
          disabled={disabled}
          aria-label={expanded ? "Collapse row" : "Expand row"}
          className={cn(
            "w-6 h-6 rounded-[4px] grid place-items-center",
            "border border-transparent bg-transparent text-ink-3 cursor-pointer",
            "hover:bg-surface-2 hover:text-ink hover:border-line",
            "focus-visible:outline-[2px_solid_var(--color-accent)] focus-visible:outline-offset-1"
          )}
        >
          <ChevronDown
            size={13}
            aria-hidden="true"
            className={cn("transition-transform", expanded && "rotate-180")}
          />
        </button>
        {rule.removed ? (
          // Icon-only undo keeps the same 26px footprint as the trash button
          // so the row's grid column widths (1fr_130_90_26_26) stay valid —
          // a text "Undo" button needs ~44px and overflowed the rules
          // editor's `overflow-hidden` rounded border.
          <button
            type="button"
            onClick={onUndoRemove}
            disabled={disabled}
            aria-label={`Undo removal of ${rule.name}`}
            title="Restore rule"
            className={cn(
              "w-6 h-6 rounded-[4px] grid place-items-center",
              "border border-transparent bg-transparent text-ink-2 cursor-pointer",
              "hover:bg-accent-weak hover:text-accent-ink hover:border-accent-border",
              "focus-visible:outline-[2px_solid_var(--color-accent)] focus-visible:outline-offset-1"
            )}
          >
            <Undo2 size={13} aria-hidden="true" />
          </button>
        ) : (
          <button
            type="button"
            onClick={onRemove}
            disabled={disabled}
            aria-label={`Remove rule ${rule.name}`}
            title="Remove rule (applied on save)"
            className={cn(
              "w-6 h-6 rounded-[4px] grid place-items-center",
              "border border-transparent bg-transparent text-ink-4 cursor-pointer",
              "hover:bg-err-weak hover:text-err",
              "focus-visible:outline-[2px_solid_var(--color-err)] focus-visible:outline-offset-1"
            )}
          >
            <Trash2 size={13} aria-hidden="true" />
          </button>
        )}
      </div>

      {expanded && !rule.removed && (
        <div
          id={panelId}
          className="px-2 pt-1 pb-2.5 flex flex-col gap-2 bg-surface-2"
        >
          <label className="flex flex-col gap-0.5">
            <span className={LABEL_CLASS}>Name</span>
            <input
              className={INPUT_CLASS}
              value={rule.name}
              onChange={(e) => onPatch({ name: e.target.value })}
              disabled={disabled}
              maxLength={256}
              autoComplete="off"
            />
          </label>
          <label className="flex flex-col gap-0.5">
            <span className={LABEL_CLASS}>Voice hint</span>
            <input
              className={INPUT_CLASS_SM}
              value={rule.hint}
              onChange={(e) => onPatch({ hint: e.target.value })}
              disabled={disabled}
              maxLength={200}
              placeholder="e.g., the billing contact's full name"
              autoComplete="off"
            />
          </label>
          <label className="flex flex-col gap-0.5">
            <span className={LABEL_CLASS}>Aliases</span>
            <input
              className={INPUT_CLASS_SM}
              value={rule.aliases}
              onChange={(e) => onPatch({ aliases: e.target.value })}
              disabled={disabled}
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
}
