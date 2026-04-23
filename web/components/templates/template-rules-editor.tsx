"use client";

import * as React from "react";
import { cn } from "@/lib/cn";
import { TemplateRuleRow, type RuleDraft } from "./template-rule-row";

interface TemplateRulesEditorProps {
  rules: RuleDraft[];
  disabled: boolean;
  onPatchRule: (id: string, patch: Partial<RuleDraft>) => void;
  onRemoveRule: (id: string) => void;
  onUndoRemoveRule: (id: string) => void;
}

/**
 * Right pane of the edit stage. Stacked list of rules; each row owns its own
 * expand/collapse state. Adding new rules is out of scope for this flow — a
 * new rule requires a bounding region, which requires the full PDF +
 * draw-box tooling. Users save a new template from a fresh parse instead.
 */
export function TemplateRulesEditor({
  rules,
  disabled,
  onPatchRule,
  onRemoveRule,
  onUndoRemoveRule,
}: TemplateRulesEditorProps) {
  const [expanded, setExpanded] = React.useState<Set<string>>(new Set());

  const toggle = (id: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const activeCount = rules.filter((r) => !r.removed).length;

  return (
    <div className="flex flex-col gap-3 bg-surface border border-line rounded-lg p-4 min-h-0">
      <div className="flex items-baseline justify-between">
        <h2 className="m-0 text-[13.5px] font-semibold text-ink tracking-[-0.01em]">
          Rules
        </h2>
        <span className="text-[11.5px] text-ink-3 font-mono">
          {activeCount}/{rules.length}
        </span>
      </div>
      <p className="m-0 text-[11.5px] text-ink-4 leading-[1.5]">
        Edit names, data types, required flags, voice hints, and aliases.
        Adding new rules needs a new bounding region — save a new template
        from a parsed document to do that.
      </p>

      {rules.length === 0 ? (
        <div
          className={cn(
            "py-6 px-4 text-center text-ink-3 text-[12.5px]",
            "border border-dashed border-line rounded-md bg-surface-2"
          )}
        >
          This template has no rules.
        </div>
      ) : (
        <div className="flex flex-col border border-line rounded-md bg-surface overflow-hidden">
          {rules.map((rule) => (
            <TemplateRuleRow
              key={rule.id}
              rule={rule}
              expanded={expanded.has(rule.id)}
              disabled={disabled}
              onToggle={() => toggle(rule.id)}
              onPatch={(patch) => onPatchRule(rule.id, patch)}
              onRemove={() => onRemoveRule(rule.id)}
              onUndoRemove={() => onUndoRemoveRule(rule.id)}
            />
          ))}
        </div>
      )}
    </div>
  );
}
