"use client";

import * as React from "react";
import { Upload, Zap } from "lucide-react";
import { Button } from "../ui/button";
import { cn } from "@/lib/cn";
import { uploadDocument } from "@/lib/api-client";
import { useAppShell } from "@/lib/app-shell-context";
import type {
  DocumentResponse,
  TemplateApplyMode,
  TemplateSummary,
} from "@/lib/types";

interface UploadStageProps {
  onUploadStart: (fileName: string) => void;
  onUploadComplete: (doc: DocumentResponse) => void;
  onUploadError: (message: string) => void;
}

// 16px repeating dot grid behind the dropzone. Extracted out of the class list
// because the comma-separated `background: radial-gradient(...), color` shorthand
// is unwieldy as a Tailwind arbitrary value — inline style keeps it readable.
const STAGE_BG: React.CSSProperties = {
  background:
    "radial-gradient(circle at 1px 1px, rgba(15, 23, 42, 0.06) 1px, transparent 0) 0 0 / 16px 16px, var(--color-bg)",
};

// Segmented-control class set, lifted from save-template-modal so the upload
// card's mode picker matches the existing radio-group aesthetic.
const SEG_BASE =
  "flex-1 border-0 border-r border-line last:border-r-0 cursor-pointer font-ui text-[12px] py-1.5";
const SEG_ACTIVE =
  "bg-surface text-ink font-medium shadow-[inset_0_-2px_0_var(--color-accent)]";
const SEG_INACTIVE = "bg-transparent text-ink-2 hover:text-ink";

const SELECT_CLASS = cn(
  "w-full h-8 px-2.5 border border-line rounded-md",
  "bg-surface text-ink font-ui text-[13px]",
  "focus:outline-0 focus:border-accent",
  "focus:shadow-[0_0_0_3px_var(--color-accent-weak)]"
);

const MODE_OPTIONS: ReadonlyArray<{ value: TemplateApplyMode; label: string }> = [
  { value: "auto", label: "Auto" },
  { value: "manual", label: "Pick…" },
  { value: "none", label: "None" },
];

export function UploadStage({
  onUploadStart,
  onUploadComplete,
  onUploadError,
}: UploadStageProps) {
  const inputRef = React.useRef<HTMLInputElement>(null);
  const { templates, templatesLoading } = useAppShell();
  const [isDragging, setIsDragging] = React.useState(false);
  const [mode, setMode] = React.useState<TemplateApplyMode>("auto");
  const [selectedTemplateId, setSelectedTemplateId] = React.useState<string>("");

  // "Manual" requires a chosen template before any upload can proceed.
  // We also block the path entirely when the library is empty, so the user
  // sees a clear "save one first" message rather than a silent failure.
  const noTemplatesAvailable = !templatesLoading && templates.length === 0;
  const manualNeedsSelection = mode === "manual" && !selectedTemplateId;
  const uploadDisabled = manualNeedsSelection;

  const handleFile = React.useCallback(
    async (file: File) => {
      onUploadStart(file.name);
      try {
        const doc = await uploadDocument(file, {
          templateMode: mode,
          templateId: mode === "manual" ? selectedTemplateId : undefined,
        });
        onUploadComplete(doc);
      } catch (err) {
        onUploadError(err instanceof Error ? err.message : "Upload failed");
      }
    },
    [mode, selectedTemplateId, onUploadStart, onUploadComplete, onUploadError]
  );

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) void handleFile(file);
    if (inputRef.current) inputRef.current.value = "";
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
    if (uploadDisabled) return;
    const file = e.dataTransfer.files?.[0];
    if (file) void handleFile(file);
  };

  const handleModeChange = (next: TemplateApplyMode) => {
    setMode(next);
    // Reset the picker selection when leaving manual mode so a stale id
    // doesn't ride along if the user toggles back later.
    if (next !== "manual") setSelectedTemplateId("");
  };

  return (
    <div className="flex-1 grid place-items-center p-10" style={STAGE_BG}>
      <div
        className={cn(
          "w-[620px] max-w-full text-center",
          "bg-surface rounded-lg shadow-sm",
          "border-[1.5px] border-dashed",
          "py-12 px-8",
          "transition-[border-color,background-color] duration-[120ms]",
          isDragging
            ? "border-accent bg-accent-weak"
            : "border-line-strong"
        )}
        onDragOver={(e) => {
          e.preventDefault();
          setIsDragging(true);
        }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={handleDrop}
      >
        <div
          className={cn(
            "w-14 h-14 mx-auto",
            "grid place-items-center rounded-xl",
            "bg-accent-weak border border-accent-border text-accent-ink"
          )}
        >
          <Upload size={24} />
        </div>
        <h2 className="mt-2.5 mb-1.5 text-[18px] font-semibold tracking-[-0.01em]">
          Drop a document to parse
        </h2>
        <p className="m-0 mb-5 text-ink-3 text-[13px]">
          Or choose a file — up to 20 MB.
        </p>

        <TemplateModePicker
          mode={mode}
          onModeChange={handleModeChange}
          templates={templates}
          templatesLoading={templatesLoading}
          noTemplatesAvailable={noTemplatesAvailable}
          selectedTemplateId={selectedTemplateId}
          onTemplateChange={setSelectedTemplateId}
        />

        <div className="mt-5 flex gap-2 justify-center">
          <Button
            variant="primary"
            onClick={() => inputRef.current?.click()}
            disabled={uploadDisabled}
          >
            <Upload size={14} />
            Choose file
          </Button>
          <Button
            onClick={() => inputRef.current?.click()}
            disabled={uploadDisabled}
          >
            <Zap size={14} />
            Try sample invoice
          </Button>
        </div>
        <div className="mt-3.5 font-mono text-[11px] text-ink-4 tracking-[0.04em]">
          PDF · PNG · JPG · TIFF
        </div>
        <input
          ref={inputRef}
          type="file"
          accept=".pdf,.png,.jpg,.jpeg,.tif,.tiff"
          className="hidden"
          onChange={handleInputChange}
        />
      </div>
    </div>
  );
}

interface TemplateModePickerProps {
  mode: TemplateApplyMode;
  onModeChange: (mode: TemplateApplyMode) => void;
  templates: TemplateSummary[];
  templatesLoading: boolean;
  noTemplatesAvailable: boolean;
  selectedTemplateId: string;
  onTemplateChange: (id: string) => void;
}

function TemplateModePicker({
  mode,
  onModeChange,
  templates,
  templatesLoading,
  noTemplatesAvailable,
  selectedTemplateId,
  onTemplateChange,
}: TemplateModePickerProps) {
  return (
    <div className="flex flex-col items-center gap-2">
      <div className="flex flex-col items-start gap-1.5 w-full max-w-[360px] mx-auto text-left">
        <span className="text-[11px] text-ink-3 font-semibold tracking-[0.04em] uppercase">
          Template
        </span>
        <div
          role="radiogroup"
          aria-label="Template application mode"
          className="flex w-full h-8 border border-line rounded-md overflow-hidden bg-surface-2"
        >
          {MODE_OPTIONS.map((opt) => {
            const active = opt.value === mode;
            return (
              <button
                key={opt.value}
                type="button"
                role="radio"
                aria-checked={active}
                onClick={() => onModeChange(opt.value)}
                className={cn(SEG_BASE, active ? SEG_ACTIVE : SEG_INACTIVE)}
              >
                {opt.label}
              </button>
            );
          })}
        </div>

        {mode === "manual" && (
          <div className="w-full mt-1">
            {noTemplatesAvailable ? (
              <p className="m-0 text-[12px] text-ink-3 italic">
                No templates saved yet — parse a document and save it as a
                template first.
              </p>
            ) : (
              <select
                value={selectedTemplateId}
                onChange={(e) => onTemplateChange(e.target.value)}
                disabled={templatesLoading}
                className={SELECT_CLASS}
                aria-label="Select template to apply"
              >
                <option value="" disabled>
                  {templatesLoading
                    ? "Loading templates…"
                    : "Select a template…"}
                </option>
                {templates.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </select>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
