"use client";

import * as React from "react";
import {
  Ban,
  Check,
  ChevronDown,
  Info,
  LayoutTemplate,
  Lock,
  Search,
  Sparkles,
  Upload,
  X,
  Zap,
} from "lucide-react";
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

const LABEL_CLASS =
  "text-[11px] text-ink-3 font-semibold tracking-[0.04em] uppercase";

// Segmented-control classes. Lift-into-a-card aesthetic for the active state
// (subtle shadow + 1px ring) matches the reference design and reads clearly
// against the `bg-bg` container tint.
const SEG_BASE = cn(
  "flex-1 inline-flex items-center justify-center gap-1.5",
  "py-2 px-2 rounded-md cursor-pointer",
  "font-ui text-[12.5px] text-ink-2",
  "transition-[background-color,color,box-shadow] duration-100",
  "hover:enabled:text-ink",
  "disabled:cursor-not-allowed disabled:text-ink-4 disabled:opacity-70"
);
const SEG_ACTIVE =
  "bg-surface text-ink font-semibold shadow-[0_1px_2px_rgba(15,23,42,0.08),0_0_0_1px_rgba(15,23,42,0.05)]";
const SEG_INACTIVE = "bg-transparent";

interface ModeOption {
  value: TemplateApplyMode;
  label: string;
  icon: React.ComponentType<{ size?: number; strokeWidth?: number; className?: string }>;
  description: string;
  requiresTemplates: boolean;
}

const MODE_OPTIONS: ReadonlyArray<ModeOption> = [
  {
    value: "auto",
    label: "Auto-match",
    icon: Sparkles,
    description:
      "We'll compare the document to your saved templates and apply the best fit automatically.",
    requiresTemplates: true,
  },
  {
    value: "manual",
    label: "Pick template",
    icon: LayoutTemplate,
    description:
      "Choose a saved template to apply. Fields extract exactly as mapped.",
    requiresTemplates: true,
  },
  {
    value: "none",
    label: "No template",
    icon: Ban,
    description:
      "Raw extraction — we'll pull fields from scratch without a template.",
    requiresTemplates: false,
  },
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

  // Modes that need templates are locked while the library is empty. If the
  // user was on one of them (including the initial default), fall back to
  // "none" so the upload buttons stay enabled and the disabled modes don't
  // visually "stick" as the current selection.
  const noTemplatesAvailable = !templatesLoading && templates.length === 0;
  React.useEffect(() => {
    if (noTemplatesAvailable && mode !== "none") {
      setMode("none");
    }
  }, [noTemplatesAvailable, mode]);

  // Clear stale picker selection whenever mode leaves "manual", so a template
  // id doesn't ride along if the user toggles back later.
  React.useEffect(() => {
    if (mode !== "manual") setSelectedTemplateId("");
  }, [mode]);

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

  return (
    <div className="flex-1 grid place-items-center p-10" style={STAGE_BG}>
      <div
        className={cn(
          "w-[620px] max-w-full text-center",
          "bg-surface rounded-lg shadow-sm",
          "border-[1.5px] border-dashed",
          "py-12 px-8",
          "transition-[border-color,background-color] duration-[120ms]",
          isDragging ? "border-accent bg-accent-weak" : "border-line-strong"
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

        <div className="mx-auto w-full max-w-[480px] text-left">
          <TemplateModePicker
            mode={mode}
            onModeChange={setMode}
            templates={templates}
            templatesLoading={templatesLoading}
            noTemplatesAvailable={noTemplatesAvailable}
            selectedTemplateId={selectedTemplateId}
            onTemplateChange={setSelectedTemplateId}
          />
        </div>

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
  const activeOption = MODE_OPTIONS.find((m) => m.value === mode) ?? MODE_OPTIONS[0];
  const showCombobox = mode === "manual" && !noTemplatesAvailable;

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-baseline justify-between">
        <span className={LABEL_CLASS}>Template</span>
      </div>

      <div
        role="radiogroup"
        aria-label="Template application mode"
        className="flex w-full gap-1 p-1 rounded-lg bg-bg border border-line"
      >
        {MODE_OPTIONS.map((opt) => {
          const disabled = opt.requiresTemplates && noTemplatesAvailable;
          const active = opt.value === mode;
          const Icon = opt.icon;
          return (
            <button
              key={opt.value}
              type="button"
              role="radio"
              aria-checked={active}
              disabled={disabled}
              onClick={() => onModeChange(opt.value)}
              title={
                disabled
                  ? "No templates yet — save one after parsing a document."
                  : undefined
              }
              className={cn(SEG_BASE, active ? SEG_ACTIVE : SEG_INACTIVE)}
            >
              <Icon size={13} strokeWidth={1.8} />
              <span>{opt.label}</span>
              {disabled && <Lock size={11} strokeWidth={1.8} aria-hidden />}
            </button>
          );
        })}
      </div>

      <div
        className={cn(
          "flex items-start gap-1.5 py-2 px-2.5 rounded-md",
          "bg-accent-weak border border-accent-border",
          "text-[12px] text-ink-2 leading-snug"
        )}
      >
        <Info
          size={13}
          strokeWidth={1.7}
          aria-hidden
          className="mt-[2px] shrink-0 text-accent-ink"
        />
        <span>
          {activeOption.description}
          {mode === "auto" && templates.length > 0 && (
            <span className="text-ink-3">
              {" · "}
              {templates.length} template{templates.length === 1 ? "" : "s"} on file
            </span>
          )}
        </span>
      </div>

      {showCombobox && (
        <TemplateCombobox
          templates={templates}
          value={selectedTemplateId}
          loading={templatesLoading}
          onChange={onTemplateChange}
          onClear={() => onTemplateChange("")}
        />
      )}
    </div>
  );
}

interface TemplateComboboxProps {
  templates: TemplateSummary[];
  value: string;
  loading: boolean;
  onChange: (id: string) => void;
  onClear: () => void;
}

function TemplateCombobox({
  templates,
  value,
  loading,
  onChange,
  onClear,
}: TemplateComboboxProps) {
  const [open, setOpen] = React.useState(false);
  const [query, setQuery] = React.useState("");
  const wrapperRef = React.useRef<HTMLDivElement>(null);
  const triggerRef = React.useRef<HTMLDivElement>(null);
  const searchRef = React.useRef<HTMLInputElement>(null);

  const selected = templates.find((t) => t.id === value) ?? null;
  const filtered = query
    ? templates.filter((t) => {
        const q = query.toLowerCase();
        return (
          t.name.toLowerCase().includes(q) ||
          t.kind.toLowerCase().includes(q) ||
          (t.vendorHint?.toLowerCase().includes(q) ?? false)
        );
      })
    : templates;

  React.useEffect(() => {
    if (!open) return;
    const handleMouseDown = (e: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpen(false);
        triggerRef.current?.focus();
      }
    };
    document.addEventListener("mousedown", handleMouseDown);
    document.addEventListener("keydown", handleKey);
    return () => {
      document.removeEventListener("mousedown", handleMouseDown);
      document.removeEventListener("keydown", handleKey);
    };
  }, [open]);

  React.useEffect(() => {
    if (open) {
      // Autofocus the search input once the menu is in the DOM.
      requestAnimationFrame(() => searchRef.current?.focus());
    } else {
      setQuery("");
    }
  }, [open]);

  const handleSelect = (id: string) => {
    onChange(id);
    setOpen(false);
  };

  const toggleOpen = () => {
    if (loading) return;
    setOpen((o) => !o);
  };

  const handleTriggerKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (loading) return;
    // Only act when the trigger itself has focus — ignore keypresses bubbling
    // from the nested clear-X button, which has its own activation behavior.
    if (e.target !== e.currentTarget) return;
    if (e.key === "Enter" || e.key === " " || e.key === "ArrowDown") {
      e.preventDefault();
      setOpen(true);
    }
  };

  return (
    <div ref={wrapperRef} className="relative w-full">
      {/* Trigger is a div-with-button-role rather than a <button> so the nested
          clear-X stays a real <button> without invalid nested interactive HTML
          (CLAUDE.md §Frontend — nested-button rule, Day 7D). */}
      <div
        ref={triggerRef}
        role="button"
        tabIndex={loading ? -1 : 0}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-disabled={loading || undefined}
        aria-label="Select template to apply"
        onClick={toggleOpen}
        onKeyDown={handleTriggerKeyDown}
        className={cn(
          "flex items-center gap-2 w-full h-9 px-2.5",
          "bg-surface border border-line-strong rounded-md",
          "font-ui text-[13px] text-ink text-left select-none",
          "transition-[border-color,box-shadow] duration-100",
          loading
            ? "cursor-not-allowed opacity-70"
            : "cursor-pointer focus-visible:outline-[2px_solid_var(--color-accent)] focus-visible:outline-offset-[-1px]",
          open && "border-accent shadow-[0_0_0_3px_var(--color-accent-weak)]"
        )}
      >
        <LayoutTemplate
          size={14}
          strokeWidth={1.7}
          aria-hidden
          className={cn("shrink-0", selected ? "text-accent-ink" : "text-ink-3")}
        />
        <span
          className={cn(
            "flex-1 min-w-0 truncate",
            selected ? "font-medium text-ink" : "text-ink-3"
          )}
        >
          {selected
            ? selected.name
            : loading
              ? "Loading templates…"
              : "Choose a template…"}
        </span>
        {selected && (
          <>
            <span className="shrink-0 font-mono text-[11px] py-px px-1.5 rounded-[3px] bg-surface-2 border border-line text-ink-3 tabular-nums">
              {selected.ruleCount} {selected.ruleCount === 1 ? "field" : "fields"}
            </span>
            <button
              type="button"
              aria-label="Clear template"
              title="Clear selection"
              onClick={(e) => {
                e.stopPropagation();
                onClear();
              }}
              className={cn(
                "shrink-0 w-[18px] h-[18px] grid place-items-center rounded",
                "text-ink-3 cursor-pointer",
                "hover:bg-surface-2 hover:text-ink",
                "focus-visible:outline-[2px_solid_var(--color-accent)] focus-visible:outline-offset-1"
              )}
            >
              <X size={12} strokeWidth={2} aria-hidden />
            </button>
          </>
        )}
        <ChevronDown
          size={14}
          strokeWidth={1.8}
          aria-hidden
          className={cn(
            "shrink-0 text-ink-3 transition-transform duration-100",
            open && "rotate-180"
          )}
        />
      </div>

      {open && (
        <div
          role="listbox"
          className={cn(
            "absolute top-[calc(100%+6px)] left-0 right-0 z-20",
            "bg-surface border border-line-strong rounded-lg overflow-hidden",
            "shadow-lg"
          )}
        >
          <div className="flex items-center gap-2 py-2 px-3 border-b border-line text-ink-3">
            <Search size={14} strokeWidth={1.7} aria-hidden />
            <input
              ref={searchRef}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search templates"
              aria-label="Search templates"
              className="flex-1 bg-transparent border-0 outline-0 font-ui text-[13px] text-ink placeholder:text-ink-4"
            />
            <span className="font-mono text-[10.5px] py-px px-1.5 rounded-[3px] border border-line bg-surface-2 text-ink-3 tabular-nums">
              {templates.length}
            </span>
          </div>
          <div className="max-h-[260px] overflow-y-auto p-1.5">
            {filtered.length === 0 ? (
              <div className="py-4 px-3 text-center text-[12.5px] text-ink-4">
                No templates match &ldquo;{query}&rdquo;
              </div>
            ) : (
              filtered.map((t) => {
                const active = t.id === value;
                const meta = [
                  t.kind,
                  t.vendorHint,
                  `${t.ruleCount} ${t.ruleCount === 1 ? "field" : "fields"}`,
                ]
                  .filter(Boolean)
                  .join(" · ");
                return (
                  <button
                    key={t.id}
                    type="button"
                    role="option"
                    aria-selected={active}
                    onClick={() => handleSelect(t.id)}
                    className={cn(
                      "flex items-center gap-2.5 w-full py-2 px-2.5 rounded-md",
                      "font-ui text-[13px] text-left cursor-pointer",
                      active
                        ? "bg-accent-weak text-accent-ink"
                        : "bg-transparent text-ink hover:bg-surface-2"
                    )}
                  >
                    <div className="flex-1 min-w-0 flex flex-col gap-0.5">
                      <span className="font-medium truncate">{t.name}</span>
                      <span
                        className={cn(
                          "text-[11.5px] truncate",
                          active ? "text-accent-ink" : "text-ink-4"
                        )}
                      >
                        {meta}
                      </span>
                    </div>
                    {active && (
                      <Check
                        size={14}
                        strokeWidth={2}
                        aria-hidden
                        className="shrink-0"
                      />
                    )}
                  </button>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}
