"use client";

import * as React from "react";
import dynamic from "next/dynamic";
import { FileText, Square, ZoomIn, ZoomOut } from "lucide-react";
import { Button, Kbd } from "./button";
import type { ExtractedField } from "@/lib/types";
import styles from "./document-pane.module.css";

// Dynamically import the PDF rendering module with ssr: false. Per react-pdf
// docs, the worker config must live in the same module as <Document>/<Page>
// and must not be SSR'd in Next.js.
const PdfDocumentView = dynamic(() => import("./pdf-document-view"), {
  ssr: false,
  loading: () => <div className={styles.loading}>Loading PDF viewer…</div>,
});

interface DocumentPaneProps {
  fileUrl: string;
  fileName: string;
  fields: ExtractedField[];
  selectedFieldId: string | null;
  onSelectField: (id: string | null) => void;
}

const ZOOM_STEP = 0.1;
const ZOOM_MIN = 0.6;
const ZOOM_MAX = 1.8;

export function DocumentPane({
  fileUrl,
  fileName,
  fields,
  selectedFieldId,
  onSelectField,
}: DocumentPaneProps) {
  const [zoom, setZoom] = React.useState(1);
  const [numPages, setNumPages] = React.useState<number | null>(null);

  const zoomOut = () => setZoom((z) => Math.max(ZOOM_MIN, +(z - ZOOM_STEP).toFixed(2)));
  const zoomIn = () => setZoom((z) => Math.min(ZOOM_MAX, +(z + ZOOM_STEP).toFixed(2)));

  return (
    <section className={styles.pane} aria-label="Document viewer">
      <header className={styles.toolbar}>
        <div className={styles.title}>
          <FileText size={15} />
          <span className={styles.fileName}>{fileName}</span>
          {numPages !== null && (
            <span className={styles.meta}>· {numPages}p</span>
          )}
        </div>
        <div className={styles.spacer} />
        <Button
          variant="ghost"
          aria-label="Zoom out"
          onClick={zoomOut}
          disabled={zoom <= ZOOM_MIN}
        >
          <ZoomOut size={14} />
        </Button>
        <span className={styles.zoomLabel} aria-live="polite">
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
        <div className={styles.divider} />
        <Button disabled title="Coming in Day 4">
          <Square size={14} />
          Draw field
          <Kbd>B</Kbd>
        </Button>
      </header>

      <div className={styles.stage}>
        <PdfDocumentView
          fileUrl={fileUrl}
          fields={fields}
          selectedFieldId={selectedFieldId}
          onSelectField={onSelectField}
          zoom={zoom}
          onPagesLoaded={setNumPages}
        />
      </div>
    </section>
  );
}
