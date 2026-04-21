"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Clock, FileText, LayoutTemplate, Upload } from "lucide-react";
import { Button } from "./button";
import { ErrorBanner } from "./error-banner";
import { Skeleton } from "./skeleton";
import { cn } from "@/lib/cn";
import { uploadDocument } from "@/lib/api-client";
import type { DocumentResponse, DocumentSummary } from "@/lib/types";
import styles from "./document-list.module.css";

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

const STATUS_CONFIG: Record<string, { label: string; cls: string }> = {
  Completed: { label: "Completed", cls: styles.statusOk },
  Failed: { label: "Failed", cls: styles.statusErr },
  Analyzing: { label: "Analyzing…", cls: styles.statusWarn },
  Uploaded: { label: "Queued", cls: styles.statusNeutral },
};

function StatusPill({ status }: { status: string }) {
  const cfg = STATUS_CONFIG[status] ?? { label: status, cls: styles.statusNeutral };
  return <span className={cn(styles.statusPill, cfg.cls)}>{cfg.label}</span>;
}

function DocumentRow({
  doc,
  onClick,
}: {
  doc: DocumentSummary;
  onClick: () => void;
}) {
  return (
    <tr className={styles.row} onClick={onClick}>
      <td>
        <div className={styles.cellName}>
          <FileText size={14} className={styles.fileIcon} aria-hidden="true" />
          <span className={styles.fileName} title={doc.fileName}>
            {doc.fileName}
          </span>
        </div>
      </td>
      <td>
        <StatusPill status={doc.status} />
      </td>
      <td>
        {doc.templateName ? (
          <span className={styles.templateBadge} title={doc.templateName}>
            <LayoutTemplate size={11} aria-hidden="true" />
            <span className={styles.templateBadgeText}>{doc.templateName}</span>
          </span>
        ) : (
          <span className={styles.dash}>—</span>
        )}
      </td>
      <td className={styles.colRight}>
        <span className={styles.mono}>{doc.fieldCount}</span>
      </td>
      <td>
        <div className={styles.cellTime}>
          <Clock size={11} aria-hidden="true" />
          {relativeTime(doc.createdAt)}
        </div>
      </td>
    </tr>
  );
}

function EmptyState({ onUploadClick }: { onUploadClick: () => void }) {
  return (
    <div className={styles.empty}>
      <div className={styles.emptyIcon}>
        <FileText size={24} aria-hidden="true" />
      </div>
      <h2>No documents yet</h2>
      <p>
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
      className={styles.skeletonWrapper}
      aria-busy="true"
      aria-label="Loading documents"
    >
      {widths.map((cols, i) => (
        <div key={i} className={styles.skeletonRow}>
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
      className={styles.page}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      <header className={styles.pageHeader}>
        <h1 className={styles.pageTitle}>Documents</h1>
        <Button variant="primary" onClick={() => inputRef.current?.click()}>
          <Upload size={13} />
          Upload new
        </Button>
        <input
          ref={inputRef}
          type="file"
          accept=".pdf,.png,.jpg,.jpeg,.tif,.tiff"
          className={styles.hiddenInput}
          onChange={handleInputChange}
          aria-label="Upload document"
        />
      </header>

      <div className={styles.content}>
        {uploadError && (
          <ErrorBanner
            title="Upload failed"
            message={uploadError}
            onDismiss={onDismissUploadError}
            className={styles.errorBannerSpacing}
          />
        )}
        {error && (
          <ErrorBanner
            title="Couldn't load documents"
            message={error}
            className={styles.errorBannerSpacing}
          />
        )}

        {loading ? (
          <LoadingSkeleton />
        ) : documents.length === 0 ? (
          <EmptyState onUploadClick={() => inputRef.current?.click()} />
        ) : (
          <div className={styles.tableWrapper}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Status</th>
                  <th>Template</th>
                  <th className={styles.colRight}>Fields</th>
                  <th>Uploaded</th>
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
        <div className={styles.dropOverlay} aria-hidden="true">
          <div className={styles.dropMessage}>
            <Upload size={24} />
            <span>Drop to upload</span>
          </div>
        </div>
      )}
    </div>
  );
}
