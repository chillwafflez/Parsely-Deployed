"use client";

import * as React from "react";
import { cn } from "@/lib/cn";
import { useInlineEdit } from "@/lib/hooks/use-inline-edit";

interface FieldSlotProps {
  /** Stable id for selection — usually the rule's id. */
  id: string;
  /** Placeholder text shown when empty (usually the rule's field name). */
  label: string;
  value: string;
  /**
   * When true, the slot renders as a pending-commit state (dashed accent
   * border + pulse). Currently unused — Phase 3 sets this for voice-filled
   * slots awaiting confirmation.
   */
  pending?: boolean;
  selected: boolean;
  onSelect: (id: string) => void;
  onCommit: (value: string) => void;
}

/**
 * Absolutely-positioned form-field slot rendered over a ghosted source PDF.
 * Click → inline input, Enter commits, Esc reverts. The slot's outer div
 * is positioned by the parent overlay; internal styling fills that area.
 */
export function FieldSlot({
  id,
  label,
  value,
  pending = false,
  selected,
  onSelect,
  onCommit,
}: FieldSlotProps) {
  const { editing, draft, setDraft, inputRef, startEditing, commit, handleKeyDown } =
    useInlineEdit({ value, onCommit });

  const isFilled = value.trim().length > 0;

  const baseClass = cn(
    "absolute inset-0 flex items-center",
    "px-1.5 rounded-[3px] cursor-text text-[11px]",
    "transition-colors duration-100"
  );

  const stateClass = editing
    ? "bg-white border border-accent shadow-[0_0_0_3px_var(--color-accent-weak)] text-ink"
    : pending
      ? "bg-accent-weak/60 border border-dashed border-accent text-accent-ink animate-[blink_1.4s_ease-in-out_infinite]"
      : isFilled
        ? cn(
            "bg-accent-weak border border-accent-border text-accent-ink font-medium",
            selected && "shadow-[0_0_0_2px_var(--color-accent)]"
          )
        : cn(
            "bg-surface-2/90 border border-dashed border-line-strong text-ink-4",
            "hover:bg-surface hover:border-accent-border",
            selected && "shadow-[0_0_0_2px_var(--color-accent)]"
          );

  return (
    <div
      role="textbox"
      aria-label={label}
      onClick={(e) => {
        e.stopPropagation();
        onSelect(id);
        if (!editing) startEditing();
      }}
      className={cn(baseClass, stateClass)}
    >
      {editing ? (
        <input
          ref={inputRef}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={commit}
          onKeyDown={handleKeyDown}
          onClick={(e) => e.stopPropagation()}
          className={cn(
            "w-full bg-transparent border-0 outline-0",
            "font-ui text-[11px] text-ink"
          )}
          placeholder={label}
          autoComplete="off"
          spellCheck={false}
        />
      ) : (
        <span className="truncate w-full">{isFilled ? value : label}</span>
      )}
    </div>
  );
}
