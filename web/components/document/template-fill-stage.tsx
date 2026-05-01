"use client";

import * as React from "react";
import dynamic from "next/dynamic";
import { Download, FileText, Mic, ZoomIn, ZoomOut } from "lucide-react";
import { Button } from "../ui/button";
import { cn } from "@/lib/cn";
import { fileUrl as apiFileUrl } from "@/lib/api-client";
import { useAppShell } from "@/lib/app-shell-context";
import { exportFilled } from "@/lib/exporters";
import type { FilledField } from "@/lib/exporters";
import { fillFromTranscript, startRecognition } from "@/lib/voice-fill";
import type { Template } from "@/lib/types";
import { FieldSlotOverlay } from "./field-slot-overlay";
import { VoiceBar, type VoiceBarState, type VoiceWarning } from "./voice-bar";

// Match DocumentPane's dynamic-import boundary: the react-pdf worker
// must not be SSR'd under Next.js 15.
const PdfDocumentView = dynamic(() => import("./pdf-document-view"), {
  ssr: false,
  loading: () => (
    <div className="py-12 px-6 text-center text-ink-3 text-[13px]">
      Loading PDF viewer…
    </div>
  ),
});

const ZOOM_STEP = 0.1;
const ZOOM_MIN = 0.6;
const ZOOM_MAX = 1.8;

/** Undo window lifetime for the post-fill VoiceBar. */
const UNDO_WINDOW_MS = 8000;

/** How long the one-shot flash animation stays on voice-filled slots. */
const FLASH_WINDOW_MS = 600;

interface TemplateFillStageProps {
  template: Template;
}

/** Local state machine for the voice session + post-fill undo window. */
type VoiceState =
  | { kind: "idle" }
  | { kind: "listening" }
  | { kind: "processing" }
  | {
      kind: "filled";
      previousFilled: Record<string, string>;
      changedFields: string[];
      warnings: VoiceWarning[];
      unmatched: string[];
    }
  | { kind: "error"; message: string; hint?: string };

/**
 * Full-width fill stage reachable from the sidebar template library.
 * Renders the template's source PDF at full opacity with field slots
 * overlaid; the user types (Phase 2) or dictates (Phase 3) values and
 * exports the filled document to PDF via the pluggable exporter pipeline.
 * On export, each slot's mask color is sampled from the surrounding page
 * so the filled regions blend with the original document.
 */
export function TemplateFillStage({ template }: TemplateFillStageProps) {
  const { showToast } = useAppShell();
  const [zoom, setZoom] = React.useState(1);
  const [numPages, setNumPages] = React.useState<number | null>(null);
  const [filled, setFilled] = React.useState<Record<string, string>>({});
  const [activeSlotId, setActiveSlotId] = React.useState<string | null>(null);
  const [exporting, setExporting] = React.useState(false);
  const [voiceState, setVoiceState] = React.useState<VoiceState>({ kind: "idle" });
  const [flashingFields, setFlashingFields] = React.useState<Record<string, boolean>>({});

  // Cancel handle for an active recognition session — lives in a ref so
  // flipping it doesn't retrigger the render that consumes voiceState.
  const stopRecognitionRef = React.useRef<(() => void) | null>(null);
  const undoTimerRef = React.useRef<number | null>(null);
  const flashTimerRef = React.useRef<number | null>(null);

  const sourcePdfUrl = template.sourceDocumentId
    ? apiFileUrl(template.sourceDocumentId)
    : null;

  const clearUndoTimer = React.useCallback(() => {
    if (undoTimerRef.current !== null) {
      window.clearTimeout(undoTimerRef.current);
      undoTimerRef.current = null;
    }
  }, []);

  const scheduleUndoExpiry = React.useCallback(() => {
    clearUndoTimer();
    undoTimerRef.current = window.setTimeout(() => {
      setVoiceState({ kind: "idle" });
      undoTimerRef.current = null;
    }, UNDO_WINDOW_MS);
  }, [clearUndoTimer]);

  const triggerFlash = React.useCallback((fields: string[]) => {
    if (fields.length === 0) return;
    if (flashTimerRef.current !== null) {
      window.clearTimeout(flashTimerRef.current);
    }
    setFlashingFields(Object.fromEntries(fields.map((f) => [f, true])));
    flashTimerRef.current = window.setTimeout(() => {
      setFlashingFields({});
      flashTimerRef.current = null;
    }, FLASH_WINDOW_MS);
  }, []);

  // Clean up any in-flight recognition + timers if the stage unmounts.
  React.useEffect(() => {
    return () => {
      clearUndoTimer();
      if (flashTimerRef.current !== null) {
        window.clearTimeout(flashTimerRef.current);
        flashTimerRef.current = null;
      }
      stopRecognitionRef.current?.();
      stopRecognitionRef.current = null;
    };
  }, [clearUndoTimer]);

  const handleCommit = React.useCallback(
    (ruleName: string, value: string) => {
      setFilled((prev) => {
        if ((prev[ruleName] ?? "") === value) return prev;
        if (value.length === 0) {
          const next = { ...prev };
          delete next[ruleName];
          return next;
        }
        return { ...prev, [ruleName]: value };
      });
    },
    []
  );

  const handleExport = React.useCallback(async () => {
    if (!sourcePdfUrl) return;

    const filledFields: FilledField[] = template.rules
      .map((rule) => {
        const value = filled[rule.name];
        const region = rule.boundingRegions[0];
        if (!value || !region) return null;
        return {
          value,
          pageNumber: region.pageNumber,
          polygon: region.polygon,
        };
      })
      .filter((f): f is FilledField => f !== null);

    setExporting(true);
    try {
      const filename = `${sanitizeFilename(template.name)}-filled.pdf`;
      await exportFilled(
        { fileUrl: sourcePdfUrl, type: "pdf" },
        filledFields,
        filename
      );
      showToast(`Exported · ${filename}`);
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Export failed", "err");
    } finally {
      setExporting(false);
    }
  }, [filled, showToast, sourcePdfUrl, template.name, template.rules]);

  const startVoiceSession = React.useCallback(async () => {
    // If the undo window is open, locking in the prior fill is implicit —
    // we just transition out of "filled" before opening the new session.
    clearUndoTimer();
    const previousFilled = { ...filled };
    setVoiceState({ kind: "listening" });

    try {
      const stop = await startRecognition({
        onTranscript: async (text) => {
          setVoiceState({ kind: "processing" });
          try {
            const response = await fillFromTranscript(
              template.id,
              text,
              previousFilled
            );

            if (response.patches.length === 0) {
              setVoiceState({
                kind: "error",
                message:
                  response.unmatchedPhrases.length > 0
                    ? `No fields matched: "${response.unmatchedPhrases.join(", ")}"`
                    : "No fields matched what you said.",
              });
              return;
            }

            const changedFields: string[] = [];
            setFilled((prev) => {
              const next = { ...prev };
              for (const patch of response.patches) {
                next[patch.field] = patch.value;
                changedFields.push(patch.field);
              }
              return next;
            });

            const warnings: VoiceWarning[] = response.patches
              .filter((p): p is typeof p & { warning: string } => p.warning != null)
              .map((p) => ({ field: p.field, warning: p.warning }));

            setVoiceState({
              kind: "filled",
              previousFilled,
              changedFields,
              warnings,
              unmatched: response.unmatchedPhrases,
            });
            triggerFlash(changedFields);
            scheduleUndoExpiry();
          } catch (err) {
            const message =
              err instanceof Error ? err.message : "Voice fill failed";
            setVoiceState({ kind: "error", message });
          }
        },
        onError: (err) => {
          setVoiceState({ kind: "error", ...voiceErrorCopy(err.kind, err.message) });
        },
      });
      stopRecognitionRef.current = stop;
    } catch (err) {
      const message = err instanceof Error ? err.message : "Voice session failed";
      setVoiceState({ kind: "error", message });
    }
  }, [clearUndoTimer, filled, scheduleUndoExpiry, template.id, triggerFlash]);

  const handleStopListening = React.useCallback(() => {
    stopRecognitionRef.current?.();
    stopRecognitionRef.current = null;
    setVoiceState({ kind: "idle" });
  }, []);

  const handleUndo = React.useCallback(() => {
    if (voiceState.kind !== "filled") return;
    setFilled(voiceState.previousFilled);
    setVoiceState({ kind: "idle" });
    clearUndoTimer();
  }, [voiceState, clearUndoTimer]);

  const handleDismissVoiceBar = React.useCallback(() => {
    setVoiceState({ kind: "idle" });
    clearUndoTimer();
  }, [clearUndoTimer]);

  const handleRetryVoice = React.useCallback(() => {
    void startVoiceSession();
  }, [startVoiceSession]);

  const zoomOut = () =>
    setZoom((z) => Math.max(ZOOM_MIN, +(z - ZOOM_STEP).toFixed(2)));
  const zoomIn = () =>
    setZoom((z) => Math.min(ZOOM_MAX, +(z + ZOOM_STEP).toFixed(2)));

  if (!sourcePdfUrl) {
    return (
      <section
        aria-label="Fill from template"
        className="flex flex-col flex-1 min-w-0 min-h-0 bg-bg items-center justify-center gap-2 text-ink-3"
      >
        <p className="text-[14px]">Template source document is unavailable.</p>
        <p className="text-[12px] text-ink-4">
          The originating document may have been deleted. Save a new template
          from a recent upload to use this flow.
        </p>
      </section>
    );
  }

  const filledCount = Object.keys(filled).length;
  const voiceActive =
    voiceState.kind === "listening" || voiceState.kind === "processing";

  const voiceBarState: VoiceBarState =
    voiceState.kind === "filled"
      ? {
          kind: "filled",
          changedFields: voiceState.changedFields,
          warnings: voiceState.warnings,
          unmatched: voiceState.unmatched,
        }
      : voiceState.kind === "error"
        ? { kind: "error", message: voiceState.message, hint: voiceState.hint }
        : voiceState;

  return (
    <section
      aria-label="Fill from template"
      className="relative flex flex-col flex-1 min-w-0 min-h-0 bg-bg"
    >
      <header
        className={cn(
          "flex items-center gap-1.5",
          "py-2 px-3 bg-surface border-b border-line"
        )}
      >
        <div className="flex items-center gap-2 min-w-0">
          <FileText size={15} />
          <span
            className={cn(
              "font-medium text-[13px] text-ink",
              "overflow-hidden text-ellipsis whitespace-nowrap"
            )}
          >
            {template.name}
          </span>
          <span className="text-ink-4 text-[11px] font-mono">
            · {filledCount}/{template.rules.length} filled
          </span>
          {numPages !== null && (
            <span className="text-ink-4 text-[11px] font-mono">· {numPages}p</span>
          )}
        </div>
        <div className="flex-1" />

        <Button
          variant="ghost"
          aria-label="Zoom out"
          onClick={zoomOut}
          disabled={zoom <= ZOOM_MIN}
        >
          <ZoomOut size={14} />
        </Button>
        <span
          aria-live="polite"
          className="font-mono text-[11px] text-ink-3 w-10 text-center"
        >
          {Math.round(zoom * 100)}%
        </span>
        <Button
          variant="ghost"
          aria-label="Zoom in"
          onClick={zoomIn}
          disabled={zoom >= ZOOM_MAX}
        >
          <ZoomIn size={14} />
        </Button>
        <div className="w-px h-5 bg-line mx-1" />

        <Button
          active={voiceActive}
          onClick={() => void startVoiceSession()}
          disabled={voiceActive}
          aria-label={voiceActive ? "Voice session in progress" : "Start voice fill"}
          aria-pressed={voiceActive}
          title={
            voiceActive
              ? "Voice session in progress"
              : "Dictate field values (click then speak)"
          }
        >
          <Mic size={14} />
          Voice
        </Button>
        <Button
          variant="primary"
          onClick={handleExport}
          disabled={exporting || filledCount === 0}
          title={
            filledCount === 0
              ? "Fill at least one field first"
              : "Download filled PDF"
          }
        >
          <Download size={14} />
          {exporting ? "Exporting…" : "Export PDF"}
        </Button>
      </header>

      <div className="flex-1 overflow-auto min-h-0">
        <PdfDocumentView
          fileUrl={sourcePdfUrl}
          fields={[]}
          zoom={zoom}
          onPagesLoaded={setNumPages}
          drawMode={null}
          onDrawComplete={() => {}}
          renderPageOverlay={({
            pageNumber,
            pageWidthPoints,
            pageHeightPoints,
          }) => (
            <FieldSlotOverlay
              pageNumber={pageNumber}
              pageWidthPoints={pageWidthPoints}
              pageHeightPoints={pageHeightPoints}
              rules={template.rules}
              filled={filled}
              flashing={flashingFields}
              activeSlotId={activeSlotId}
              onSelectSlot={setActiveSlotId}
              onCommit={handleCommit}
            />
          )}
        />
      </div>

      {/* Transient overlay — floats over the scrolling viewer, doesn't push layout. */}
      <div className="pointer-events-none absolute inset-x-0 bottom-4 flex justify-center px-4">
        <VoiceBar
          state={voiceBarState}
          onStop={handleStopListening}
          onUndo={handleUndo}
          onDismiss={handleDismissVoiceBar}
          onRetry={handleRetryVoice}
        />
      </div>
    </section>
  );
}

/** Filesystem-safe filename: keep alphanumerics + hyphen + underscore. */
function sanitizeFilename(name: string): string {
  return (
    name.replace(/[^a-z0-9-_]+/gi, "-").replace(/^-|-$/g, "") || "template"
  );
}

/**
 * Maps a recognition error kind to a user-readable message plus an optional
 * actionable hint. Permission-denied gets the loudest hint since that's the
 * only error the user has to act on outside our UI.
 */
function voiceErrorCopy(
  kind: string,
  fallback: string
): { message: string; hint?: string } {
  switch (kind) {
    case "permission-denied":
      return {
        message: "Microphone access denied.",
        hint: "Click the lock (or tune) icon in your address bar to allow microphone access, then retry.",
      };
    case "no-speech":
      return { message: "Couldn't hear that — try again." };
    case "network":
      return {
        message: "Network error.",
        hint: "Check your connection and retry.",
      };
    case "canceled":
      return { message: fallback || "Recognition canceled." };
    default:
      return { message: fallback || "Voice recognition failed." };
  }
}
