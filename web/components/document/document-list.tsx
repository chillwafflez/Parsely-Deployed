"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Clock, FileText, LayoutTemplate, Upload } from "lucide-react";
import { Button } from "../ui/button";
import { ErrorBanner } from "../ui/error-banner";
import { Skeleton } from "../ui/skeleton";
import { cn } from "@/lib/cn";
import { uploadDocument } from "@/lib/api-client";
import type { DocumentResponse, DocumentSummary } from "@/lib/types";

interface DocumentListProps {
  documents: DocumentSummary[];
  loading: boolean;
  /** Fetch error for the documents list (not upload errors). */
  error: string | null;
  /** Persistent upload error displayed above the list. */
  uploadError?: string | null;
  onDismissUploadError?: () => void;
  onUploadStart: (fileName: string) => void;
  onUploadComplete: (doc: DocumentResponse) => void;
  onUploadError: (message: string) => void;
}

/** Formats an ISO timestamp as a human-readable relative time (e.g. "3h ago"). */
function relativeTime(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diffMs / 60_000);
  const hours = Math.floor(diffMs / 3_600_000);
  const days = Math.floor(diffMs / 86_400_000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  if (hours < 24) return `${hours}h ago`;
  if (days < 30) return `${days}d ago`;
  return new Date(iso).toLocaleDateString();
}

// Bordered card wrapper shared by the table and the loading skeleton so they
// share the same visual frame.
const CARD_WRAPPER = cn(
  "bg-surface border border-line rounded-lg shadow-sm overflow-hidden"
);

// Shared padding for <th> and <td> so the header row and body rows line up.
const CELL_PADDING = "py-2.5 px-3.5";

// Shared <td> styling: padding, text styling, bottom border (dropped on the
// last row via `group-last:`), and hover tint driven by the row-level `group`.
const BODY_CELL = cn(
  CELL_PADDING,
  "text-[13px] text-ink-2 align-middle",
  "border-b border-line group-last:border-b-0",
  "group-hover:bg-accent-weak"
);

// Colored dot ::before pseudo shared by every status variant.
const PILL_DOT_BEFORE = cn(
  "before:content-[''] before:w-1.5 before:h-1.5 before:rounded-full",
  "before:bg-current before:shrink-0"
);

const STATUS_STYLES: Record<string, { label: string; cls: string }> = {
  Completed: {
    label: "Completed",
    cls: "bg-ok-weak text-ok",
  },
  Failed: {
    label: "Failed",
    cls: "bg-err-weak text-err",
  },
  Analyzing: {
    label: "Analyzing…",
    cls: "bg-warn-weak text-warn",
  },
  Uploaded: {
    label: "Queued",
    cls: "bg-surface-2 text-ink-3 border border-line",
  },
};

function StatusPill({ status }: { status: string }) {
  const cfg =
    STATUS_STYLES[status] ?? {
      label: status,
      cls: "bg-surface-2 text-ink-3 border border-line",
    };
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 py-0.5 px-2 rounded-full",
        "text-[11.5px] font-medium whitespace-nowrap",
        PILL_DOT_BEFORE,
        cfg.cls
      )}
    >
      {cfg.label}
    </span>
  );
}

function DocumentRow({
  doc,
  onClick,
}: {
  doc: DocumentSummary;
  onClick: () => void;
}) {
  return (
    <tr
      onClick={onClick}
      className="group cursor-pointer transition-[background-color] duration-100"
    >
      <td className={BODY_CELL}>
        <div className="flex items-center gap-2 max-w-[360px]">
          <FileText
            size={14}
            aria-hidden="true"
            className="shrink-0 text-ink-4"
          />
          <span
            title={doc.fileName}
            className="overflow-hidden text-ellipsis whitespace-nowrap font-medium text-ink"
          >
            {doc.fileName}
          </span>
        </div>
      </td>
      <td className={BODY_CELL}>
        <StatusPill status={doc.status} />
      </td>
      <td className={BODY_CELL}>
        {doc.templateName ? (
          <span
            title={doc.templateName}
            className={cn(
              "inline-flex items-center gap-[5px] max-w-[200px]",
              "py-0.5 px-2 rounded-full",
              "bg-accent-weak border border-accent-border",
              "text-[11.5px] font-medium text-accent-ink"
            )}
          >
            <LayoutTemplate size={11} aria-hidden="true" />
            <span className="overflow-hidden text-ellipsis whitespace-nowrap">
              {doc.templateName}
            </span>
          </span>
        ) : (
          <span className="text-ink-4">—</span>
        )}
      </td>
      <td className={cn(BODY_CELL, "text-right")}>
        <span className="font-mono text-[12px] text-ink-3">
          {doc.fieldCount}
        </span>
      </td>
      <td className={BODY_CELL}>
        <div className="flex items-center gap-[5px] text-ink-3 text-[12px] whitespace-nowrap">
          <Clock size={11} aria-hidden="true" />
          {relativeTime(doc.createdAt)}
        </div>
      </td>
    </tr>
  );
}

function EmptyState({ onUploadClick }: { onUploadClick: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center gap-4 py-20 px-6 text-center">
      <div
        className={cn(
          "w-14 h-14 grid place-items-center rounded-xl",
          "bg-accent-weak border border-accent-border text-accent-ink"
        )}
      >
        <FileText size={24} aria-hidden="true" />
      </div>
      <h2 className="m-0 text-[17px] font-semibold tracking-[-0.01em] text-ink">
        No documents yet
      </h2>
      <p className="m-0 max-w-[300px] text-ink-3 text-[13px] leading-[1.55]">
        Drop a file anywhere on this page, or upload one to start parsing.
      </p>
      <Button variant="primary" onClick={onUploadClick}>
        <Upload size={14} />
        Upload your first document
      </Button>
    </div>
  );
}

function LoadingSkeleton() {
  const widths = [
    ["200px", "70px", "110px", "28px", "65px"],
    ["160px", "70px", "130px", "28px", "65px"],
    ["220px", "70px", "70px", "28px", "65px"],
    ["180px", "70px", "120px", "28px", "65px"],
    ["140px", "70px", "90px", "28px", "65px"],
  ];
  return (
    <div
      aria-busy="true"
      aria-label="Loading documents"
      className={CARD_WRAPPER}
    >
      {widths.map((cols, i) => (
        <div
          key={i}
          className={cn(
            "flex items-center gap-4 py-3 px-3.5",
            i < widths.length - 1 && "border-b border-line"
          )}
        >
          {cols.map((w, j) => (
            <Skeleton key={j} width={w} height={13} />
          ))}
        </div>
      ))}
    </div>
  );
}

/**
 * Documents history list with drag-and-drop upload. Renders a loading skeleton,
 * an empty state, or a table of prior documents depending on state. Upload events
 * propagate to the parent so it can show the parsing overlay and handle navigation.
 */
export function DocumentList({
  documents,
  loading,
  error,
  uploadError,
  onDismissUploadError,
  onUploadStart,
  onUploadComplete,
  onUploadError,
}: DocumentListProps) {
  const router = useRouter();
  const inputRef = React.useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = React.useState(false);

  const handleFile = React.useCallback(
    async (file: File) => {
      onUploadStart(file.name);
      try {
        const doc = await uploadDocument(file);
        onUploadComplete(doc);
      } catch (err) {
        onUploadError(err instanceof Error ? err.message : "Upload failed");
      }
    },
    [onUploadStart, onUploadComplete, onUploadError]
  );

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) void handleFile(file);
    if (inputRef.current) inputRef.current.value = "";
  };

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
    // Only clear dragging when the pointer genuinely leaves this container
    // (not when it moves over a child element, which also fires DragLeave).
    if (!e.currentTarget.contains(e.relatedTarget as Node)) {
      setIsDragging(false);
    }
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) void handleFile(file);
  };

  return (
    <div
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      className="relative flex flex-1 flex-col min-h-0 bg-bg"
    >
      <header
        className={cn(
          "flex items-center gap-3 shrink-0",
          "py-3 px-6 bg-surface border-b border-line"
        )}
      >
        <h1 className="flex-1 m-0 text-[15px] font-semibold text-ink tracking-[-0.01em]">
          Documents
        </h1>
        <Button variant="primary" onClick={() => inputRef.current?.click()}>
          <Upload size={13} />
          Upload new
        </Button>
        <input
          ref={inputRef}
          type="file"
          accept=".pdf,.png,.jpg,.jpeg,.tif,.tiff"
          className="hidden"
          onChange={handleInputChange}
          aria-label="Upload document"
        />
      </header>

      <div className="flex-1 overflow-y-auto py-5 px-6">
        {uploadError && (
          <ErrorBanner
            title="Upload failed"
            message={uploadError}
            onDismiss={onDismissUploadError}
            className="mb-4"
          />
        )}
        {error && (
          <ErrorBanner
            title="Couldn't load documents"
            message={error}
            className="mb-4"
          />
        )}

        {loading ? (
          <LoadingSkeleton />
        ) : documents.length === 0 ? (
          <EmptyState onUploadClick={() => inputRef.current?.click()} />
        ) : (
          <div className={CARD_WRAPPER}>
            <table className="w-full border-collapse">
              <thead className="bg-surface-2">
                <tr>
                  <Th>Name</Th>
                  <Th>Status</Th>
                  <Th>Template</Th>
                  <Th align="right">Fields</Th>
                  <Th>Uploaded</Th>
                </tr>
              </thead>
              <tbody>
                {documents.map((doc) => (
                  <DocumentRow
                    key={doc.id}
                    doc={doc}
                    onClick={() => router.push(`/documents/${doc.id}`)}
                  />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {isDragging && (
        <div
          aria-hidden="true"
          className={cn(
            "absolute inset-0 z-10 grid place-items-center pointer-events-none",
            "bg-accent-weak border-2 border-dashed border-accent"
          )}
        >
          <div
            className={cn(
              "flex flex-col items-center gap-2.5",
              "py-6 px-9 rounded-lg",
              "bg-surface shadow-md",
              "text-accent-ink text-[15px] font-semibold"
            )}
          >
            <Upload size={24} />
            <span>Drop to upload</span>
          </div>
        </div>
      )}
    </div>
  );
}

function Th({
  children,
  align,
}: {
  children: React.ReactNode;
  align?: "right";
}) {
  return (
    <th
      className={cn(
        CELL_PADDING,
        "text-[10.5px] font-semibold uppercase tracking-[0.055em]",
        "text-ink-3 border-b border-line whitespace-nowrap",
        align === "right" ? "text-right" : "text-left"
      )}
    >
      {children}
    </th>
  );
}
