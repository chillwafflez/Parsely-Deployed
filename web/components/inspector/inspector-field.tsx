"use client";

import * as React from "react";
import { Lock, Pin, Sigma, Trash2 } from "lucide-react";
import { cn } from "@/lib/cn";
import { confidenceLevel } from "@/lib/bbox";
import type { ExtractedField, FieldDataType, FieldUpdate } from "@/lib/types";
import { TypePopover } from "../ui/type-popover";

interface InspectorFieldProps {
  field: ExtractedField;
  selected: boolean;
  onSelect: (id: string) => void;
  onUpdate: (id: string, update: FieldUpdate) => void;
  onDelete: (id: string) => void;
}

export function InspectorField({
  field,
  selected,
  onSelect,
  onUpdate,
  onDelete,
}: InspectorFieldProps) {
  const [editing, setEditing] = React.useState(false);
  const [draft, setDraft] = React.useState(field.value ?? "");
  const [typeAnchor, setTypeAnchor] = React.useState<DOMRect | null>(null);
  const inputRef = React.useRef<HTMLInputElement>(null);
  const rowRef = React.useRef<HTMLDivElement>(null);

  // Keep the draft in sync if the underlying value changes while not editing
  // (e.g., after an optimistic rollback or a refetch).
  React.useEffect(() => {
    if (!editing) setDraft(field.value ?? "");
  }, [field.value, editing]);

  React.useEffect(() => {
    if (editing) {
      inputRef.current?.focus();
      inputRef.current?.select();
    }
  }, [editing]);

  React.useEffect(() => {
    if (selected) {
      rowRef.current?.scrollIntoView({ block: "nearest", behavior: "smooth" });
    }
  }, [selected]);

  const commitEdit = () => {
    const next = draft;
    setEditing(false);
    if (next !== (field.value ?? "")) {
      onUpdate(field.id, { value: next });
    }
  };

  const cancelEdit = () => {
    setDraft(field.value ?? "");
    setEditing(false);
  };

  const handleKey = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      commitEdit();
    } else if (e.key === "Escape") {
      e.preventDefault();
      cancelEdit();
    }
  };

  const level = confidenceLevel(field.confidence);
  // Status dot tone — green for "verified" (≥90%), amber for "review" (70–89%),
  // red for "low confidence" (<70%). Mirrors the Inspector header legend.
  const dotTone =
    level === "high" ? "bg-ok" : level === "med" ? "bg-warn" : "bg-err";
  const confidencePct = `${Math.round(field.confidence * 100)}% confidence`;
  const isAggregation = field.aggregationConfig !== null;
  const isCustomNonAgg = field.isUserAdded && !isAggregation;

  return (
    <div
      ref={rowRef}
      data-confidence={level}
      className={cn(
        "group/field rounded-md px-2.5 py-2 cursor-pointer",
        "border border-transparent transition-colors",
        selected
          ? "bg-accent-weak border-accent-border"
          : "hover:bg-surface-2"
      )}
      onClick={() => onSelect(field.id)}
    >
      <div className="flex items-center gap-1.5">
        <span
          aria-hidden
          title={confidencePct}
          className={cn("w-1.5 h-1.5 rounded-full shrink-0", dotTone)}
        />
        <span
          className="text-[11.5px] text-ink-2 font-medium truncate"
          title={field.name}
        >
          {field.name}
        </span>
        {field.isRequired && (
          <span
            className="font-mono text-[9.5px] font-semibold tracking-[0.08em] text-err"
            title="Required field"
          >
            REQ
          </span>
        )}
        {isAggregation && (
          <span
            className={cn(
              "inline-flex items-center gap-1 px-1.5 py-px rounded",
              "text-[9.5px] font-medium",
              "bg-agg-weak text-agg-ink"
            )}
          >
            <Sigma size={9} aria-hidden />
            {field.aggregationConfig!.operation.toLowerCase()}
          </span>
        )}
        {isCustomNonAgg && (
          <span
            className={cn(
              "inline-flex items-center px-1.5 py-px rounded",
              "text-[9.5px] font-medium",
              "bg-custom-weak text-custom-ink"
            )}
          >
            custom
          </span>
        )}
        <button
          type="button"
          title="Change data type"
          className={cn(
            "ml-auto font-mono text-[9.5px] px-1.5 py-px rounded",
            "bg-surface-2 border border-line text-ink-3",
            "hover:border-line-strong hover:text-ink"
          )}
          onClick={(e) => {
            e.stopPropagation();
            setTypeAnchor(e.currentTarget.getBoundingClientRect());
          }}
        >
          {field.dataType}
        </button>
        <div
          className={cn(
            "flex items-center gap-px",
            "opacity-0 group-hover/field:opacity-100",
            "group-focus-within/field:opacity-100",
            "transition-opacity"
          )}
          onClick={(e) => e.stopPropagation()}
        >
          <button
            type="button"
            title={field.isRequired ? "Make optional" : "Mark required"}
            className={cn(
              "w-[18px] h-[18px] grid place-items-center rounded",
              "text-ink-3 hover:text-ink hover:bg-surface"
            )}
            onClick={() =>
              onUpdate(field.id, { isRequired: !field.isRequired })
            }
          >
            {field.isRequired ? <Lock size={11} /> : <Pin size={11} />}
          </button>
          <button
            type="button"
            title="Remove field"
            className={cn(
              "w-[18px] h-[18px] grid place-items-center rounded",
              "text-ink-3 hover:text-err hover:bg-err-weak"
            )}
            onClick={() => onDelete(field.id)}
          >
            <Trash2 size={11} />
          </button>
        </div>
      </div>

      <div
        className={cn(
          "mt-1 font-mono text-[12px] leading-tight rounded px-1 py-0.5 -mx-1",
          "border border-transparent",
          editing
            ? "bg-surface border-accent shadow-[0_0_0_2px_var(--color-accent-weak)] p-0"
            : "hover:bg-surface hover:border-line",
          !draft && !editing && "text-ink-4 italic"
        )}
        onClick={(e) => {
          e.stopPropagation();
          onSelect(field.id);
          setEditing(true);
        }}
      >
        {editing ? (
          <input
            ref={inputRef}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onBlur={commitEdit}
            onKeyDown={handleKey}
            onClick={(e) => e.stopPropagation()}
            className={cn(
              "w-full px-1 py-0.5",
              "bg-transparent border-0 outline-none",
              "font-mono text-[12px] text-ink"
            )}
          />
        ) : (
          draft || "—"
        )}
      </div>

      {typeAnchor && (
        <TypePopover
          anchorRect={typeAnchor}
          current={field.dataType}
          onPick={(type: FieldDataType) => onUpdate(field.id, { dataType: type })}
          onClose={() => setTypeAnchor(null)}
        />
      )}
    </div>
  );
}
