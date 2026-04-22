"use client";

import * as React from "react";
import {
  AlertTriangle,
  Check,
  Loader2,
  Mic,
  RotateCcw,
  Square,
  Undo2,
  X,
} from "lucide-react";
import { Button } from "../ui/button";
import { cn } from "@/lib/cn";

export interface VoiceWarning {
  field: string;
  warning: string;
}

/**
 * UI state of the voice-fill transient surface. Split from TemplateFillStage's
 * session state so this component stays presentational — VoiceBar never
 * touches the Speech SDK or the fetch layer.
 */
export type VoiceBarState =
  | { kind: "idle" }
  | { kind: "listening" }
  | { kind: "processing" }
  | {
      kind: "filled";
      changedFields: string[];
      warnings: VoiceWarning[];
      unmatched: string[];
    }
  | { kind: "error"; message: string };

interface VoiceBarProps {
  state: VoiceBarState;
  /** Called when the user clicks Stop during listening. */
  onStop: () => void;
  /** Called when the user clicks Undo during the filled window. */
  onUndo: () => void;
  /** Called when the user dismisses the filled or error bar. */
  onDismiss: () => void;
  /** Called when the user clicks Retry after an error. */
  onRetry: () => void;
}

/**
 * Fixed, transient surface that appears at the bottom of the fill stage
 * while a voice session is active or a post-fill undo window is open.
 * Styled to float over the scrolling PDF without pushing layout.
 */
export function VoiceBar({
  state,
  onStop,
  onUndo,
  onDismiss,
  onRetry,
}: VoiceBarProps) {
  if (state.kind === "idle") return null;

  return (
    <div
      role="status"
      aria-live="polite"
      className={cn(
        "pointer-events-auto",
        "flex flex-col gap-2",
        "py-2.5 px-3.5",
        "bg-surface border border-line rounded-full",
        "shadow-lg",
        "text-[12.5px] text-ink",
        "min-w-[300px] max-w-[640px]"
      )}
    >
      <div className="flex items-center gap-3">
        {state.kind === "listening" && (
          <ListeningBody onStop={onStop} />
        )}
        {state.kind === "processing" && <ProcessingBody />}
        {state.kind === "filled" && (
          <FilledBody
            changedFields={state.changedFields}
            onUndo={onUndo}
            onDismiss={onDismiss}
          />
        )}
        {state.kind === "error" && (
          <ErrorBody
            message={state.message}
            onRetry={onRetry}
            onDismiss={onDismiss}
          />
        )}
      </div>

      {state.kind === "filled" &&
        (state.warnings.length > 0 || state.unmatched.length > 0) && (
          <PillList warnings={state.warnings} unmatched={state.unmatched} />
        )}
    </div>
  );
}

function ListeningBody({ onStop }: { onStop: () => void }) {
  return (
    <>
      <span
        className="block w-2 h-2 rounded-full bg-err animate-[blink_1s_ease-in-out_infinite]"
        aria-hidden="true"
      />
      <Mic size={14} className="text-err" aria-hidden="true" />
      <span className="font-medium">Listening…</span>
      <div className="flex-1" />
      <Button variant="ghost" onClick={onStop} aria-label="Stop listening">
        <Square size={13} />
        Stop
      </Button>
    </>
  );
}

function ProcessingBody() {
  return (
    <>
      <Loader2 size={14} className="text-accent animate-spin" aria-hidden="true" />
      <span className="font-medium">Understanding…</span>
    </>
  );
}

function FilledBody({
  changedFields,
  onUndo,
  onDismiss,
}: {
  changedFields: string[];
  onUndo: () => void;
  onDismiss: () => void;
}) {
  // Short lists read as names; long lists read as a count to keep the bar tight.
  const label =
    changedFields.length === 0
      ? "No changes"
      : changedFields.length <= 3
        ? `Filled ${changedFields.join(", ")}`
        : `Filled ${changedFields.length} fields`;

  return (
    <>
      <Check size={14} className="text-ok" aria-hidden="true" />
      <span
        className={cn(
          "font-medium overflow-hidden text-ellipsis whitespace-nowrap",
          "max-w-[360px]"
        )}
        title={changedFields.join(", ")}
      >
        {label}
      </span>
      <div className="flex-1" />
      {changedFields.length > 0 && (
        <Button variant="ghost" onClick={onUndo} aria-label="Undo last voice fill">
          <Undo2 size={13} />
          Undo
        </Button>
      )}
      <button
        type="button"
        onClick={onDismiss}
        aria-label="Dismiss"
        className={cn(
          "w-[22px] h-[22px] grid place-items-center rounded-[4px] cursor-pointer",
          "bg-transparent border-0 text-ink-4 hover:text-ink hover:bg-surface-2"
        )}
      >
        <X size={13} />
      </button>
    </>
  );
}

function ErrorBody({
  message,
  onRetry,
  onDismiss,
}: {
  message: string;
  onRetry: () => void;
  onDismiss: () => void;
}) {
  return (
    <>
      <AlertTriangle size={14} className="text-err" aria-hidden="true" />
      <span
        className={cn(
          "font-medium overflow-hidden text-ellipsis whitespace-nowrap",
          "max-w-[360px]"
        )}
        title={message}
      >
        {message}
      </span>
      <div className="flex-1" />
      <Button variant="ghost" onClick={onRetry} aria-label="Try again">
        <RotateCcw size={13} />
        Retry
      </Button>
      <button
        type="button"
        onClick={onDismiss}
        aria-label="Dismiss"
        className={cn(
          "w-[22px] h-[22px] grid place-items-center rounded-[4px] cursor-pointer",
          "bg-transparent border-0 text-ink-4 hover:text-ink hover:bg-surface-2"
        )}
      >
        <X size={13} />
      </button>
    </>
  );
}

function PillList({
  warnings,
  unmatched,
}: {
  warnings: VoiceWarning[];
  unmatched: string[];
}) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {warnings.map((w, idx) => (
        <span
          key={`w-${idx}`}
          className={cn(
            "inline-flex items-center gap-1 py-0.5 px-2 rounded-full",
            "bg-warn-weak text-ink text-[11px]"
          )}
          title={w.warning}
        >
          <AlertTriangle size={10} className="text-warn" aria-hidden="true" />
          {w.field}
        </span>
      ))}
      {unmatched.map((phrase, idx) => (
        <span
          key={`u-${idx}`}
          className={cn(
            "inline-flex items-center gap-1 py-0.5 px-2 rounded-full",
            "bg-surface-2 text-ink-3 text-[11px] border border-line"
          )}
          title="No matching field — phrase was ignored"
        >
          “{phrase}”
        </span>
      ))}
    </div>
  );
}
