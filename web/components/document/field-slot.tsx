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
  /** Drives the " · Required" suffix on the hover tag. */
  required: boolean;
  /**
   * When true, plays a one-shot flash animation on the committed slot.
   * TemplateFillStage sets this for ~600ms after a voice-fill commits so
   * the user sees which slots the LLM just touched.
   */
  flashing?: boolean;
  selected: boolean;
  onSelect: (id: string) => void;
  onCommit: (value: string) => void;
}

/**
 * Absolutely-positioned form-field slot rendered over the source PDF.
 * Click → inline input, Enter commits, Esc reverts. The slot's outer div
 * is positioned by the parent overlay; internal styling fills that area.
 *
 * Empty slots render fully opaque so the masked PDF text underneath doesn't
 * bleed through — this keeps the form aesthetic closer to a real PDF form
 * and avoids the "which is the label and which is the underlying text?"
 * confusion users were hitting pre-2026-04-23.
 */
export function FieldSlot({
  id,
  label,
  value,
  required,
  flashing = false,
  selected,
  onSelect,
  onCommit,
}: FieldSlotProps) {
  const { editing, draft, setDraft, inputRef, startEditing, commit, handleKeyDown } =
    useInlineEdit({ value, onCommit });

  const isFilled = value.trim().length > 0;

  // `group` enables the hover tag below to reveal on cursor-over-slot without
  // a render pass (pure CSS). Kept in the base class so every state inherits.
  const baseClass = cn(
    "group absolute inset-0 flex items-center",
    "px-1.5 rounded-[3px] cursor-text text-[11px]",
    "transition-colors duration-100"
  );

  const stateClass = editing
    ? "bg-white border border-accent shadow-[0_0_0_3px_var(--color-accent-weak)] text-ink"
    : isFilled
      ? cn(
          "bg-accent-weak border border-accent-border text-accent-ink font-medium",
          flashing && "animate-slot-flash",
          selected && "shadow-[0_0_0_2px_var(--color-accent)]"
        )
      : cn(
          "bg-surface-2 border border-dashed border-line-strong text-ink-4",
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
        <>
          <span className="truncate w-full">{isFilled ? value : label}</span>
          <HoverTag name={label} required={required} selected={selected} />
        </>
      )}
    </div>
  );
}

/**
 * Small pill shown above the slot on hover or when selected. Mirrors the
 * parsed-document bounding-box tag (mono, 10px, notched bottom-left corner)
 * so users can reliably see the canonical field name before dictating it via
 * voice fill. `pointer-events-none` so the tag itself never steals a click
 * from the slot beneath it.
 */
function HoverTag({
  name,
  required,
  selected,
}: {
  name: string;
  required: boolean;
  selected: boolean;
}) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        "absolute -top-5 left-0 pointer-events-none",
        "font-mono text-[10px] py-px px-1.5 whitespace-nowrap",
        "bg-accent text-white rounded-[3px_3px_3px_0]",
        "opacity-0 group-hover:opacity-100 transition-opacity duration-100",
        selected && "opacity-100"
      )}
    >
      {name}
      {required && " · Required"}
    </span>
  );
}
