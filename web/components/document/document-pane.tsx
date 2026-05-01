"use client";

import * as React from "react";
import dynamic from "next/dynamic";
import { ChevronDown, FileText, Sigma, Square, ZoomIn, ZoomOut } from "lucide-react";
import { Button, Kbd } from "../ui/button";
import { cn } from "@/lib/cn";
import type {
  DrawCompletion,
  DrawMode,
  DrawResult,
  ExtractedField,
  ExtractedTable,
} from "@/lib/types";
import type { Selection } from "@/lib/selection";
import { DrawingToolsPopover } from "./drawing-tools-popover";

// Dynamically import the PDF rendering module with ssr: false. Per react-pdf
// docs, the worker config must live in the same module as <Document>/<Page>
// and must not be SSR'd in Next.js.
const PdfDocumentView = dynamic(() => import("./pdf-document-view"), {
  ssr: false,
  loading: () => (
    <div className="py-12 px-6 text-center text-ink-3 text-[13px]">
      Loading PDF viewer…
    </div>
  ),
});

interface DocumentPaneProps {
  fileUrl: string;
  fileName: string;
  fields: ExtractedField[];
  tables: ExtractedTable[];
  selection: Selection | null;
  activeTableId: string | null;
  onSelect: (selection: Selection | null) => void;
  onDrawComplete: (completion: DrawCompletion) => void;
}

const ZOOM_STEP = 0.1;
const ZOOM_MIN = 0.6;
const ZOOM_MAX = 1.8;

const MODE_LABEL: Record<DrawMode, string> = {
  field: "field",
  aggregation: "aggregation",
};

const MODE_ICON: Record<DrawMode, React.ReactNode> = {
  field: <Square size={14} />,
  aggregation: <Sigma size={14} />,
};

const MODE_SHORTCUT: Record<DrawMode, string> = {
  field: "F",
  aggregation: "A",
};

export function DocumentPane({
  fileUrl,
  fileName,
  fields,
  tables,
  selection,
  activeTableId,
  onSelect,
  onDrawComplete,
}: DocumentPaneProps) {
  const [zoom, setZoom] = React.useState(1);
  const [numPages, setNumPages] = React.useState<number | null>(null);
  const [drawMode, setDrawMode] = React.useState<DrawMode | null>(null);
  // Photoshop-style "remember last selected" — clicking the toolbar button
  // when off re-enters whichever mode the user last picked from the popover.
  const [lastSelectedMode, setLastSelectedMode] = React.useState<DrawMode>("field");
  const [popoverOpen, setPopoverOpen] = React.useState(false);

  const zoomOut = () => setZoom((z) => Math.max(ZOOM_MIN, +(z - ZOOM_STEP).toFixed(2)));
  const zoomIn = () => setZoom((z) => Math.min(ZOOM_MAX, +(z + ZOOM_STEP).toFixed(2)));

  // Toolbar button click — toggle off if active, otherwise enter the
  // most-recently-selected mode.
  const toggleDrawMode = React.useCallback(() => {
    setDrawMode((current) => (current ? null : lastSelectedMode));
  }, [lastSelectedMode]);

  // Picking a mode from the popover always activates it (and remembers it
  // for next time). Switching directly between modes never goes through "off".
  const handleSelectMode = React.useCallback((mode: DrawMode) => {
    setLastSelectedMode(mode);
    setDrawMode(mode);
    setPopoverOpen(false);
  }, []);

  // Tag draw results with the active mode before bubbling up so ReviewStage
  // can route to the correct post-draw modal.
  const handleDrawComplete = React.useCallback(
    (result: DrawResult) => {
      const mode = drawMode;
      if (!mode) return; // Defensive — DrawingLayer only renders when drawMode != null.
      setDrawMode(null);
      onDrawComplete({ ...result, mode });
    },
    [drawMode, onDrawComplete]
  );

  // F → field, A → aggregation, Escape exits any active mode. Reuses the
  // existing input-guard so typing in field values doesn't toggle the toolbar.
  React.useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLElement) {
        const editable =
          e.target.tagName === "INPUT" ||
          e.target.tagName === "TEXTAREA" ||
          e.target.isContentEditable;
        if (editable) return;
      }
      if (e.key === "Escape" && drawMode) {
        e.preventDefault();
        setDrawMode(null);
        return;
      }
      if (e.key === "f" || e.key === "F") {
        e.preventDefault();
        setLastSelectedMode("field");
        setDrawMode((current) => (current === "field" ? null : "field"));
      } else if (e.key === "a" || e.key === "A") {
        e.preventDefault();
        setLastSelectedMode("aggregation");
        setDrawMode((current) => (current === "aggregation" ? null : "aggregation"));
      }
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [drawMode]);

  // Display state for the split button — what's shown reflects what would
  // happen on click.
  const displayMode = drawMode ?? lastSelectedMode;
  const isActive = drawMode !== null;
  const buttonLabel = isActive
    ? `Cancel ${MODE_LABEL[drawMode!]}`
    : `Draw ${MODE_LABEL[displayMode]}`;
  const buttonTitle = isActive
    ? `Exit ${MODE_LABEL[drawMode!]} mode (Esc)`
    : `Draw a new ${MODE_LABEL[displayMode]} (${MODE_SHORTCUT[displayMode]})`;

  return (
    <section
      aria-label="Document viewer"
      className="flex flex-col flex-1 min-w-0 min-h-0 bg-bg"
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
              "font-mono text-[12px] font-medium text-ink-2",
              "overflow-hidden text-ellipsis whitespace-nowrap"
            )}
          >
            {fileName}
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
        {/* Split button: main entry toggles the current mode; chevron opens
            the popover to switch modes. Wrapped in a relative container so
            the popover can anchor to its right edge. */}
        <div className="relative flex items-center">
          <Button
            active={isActive}
            onClick={toggleDrawMode}
            aria-pressed={isActive}
            title={buttonTitle}
            className="rounded-r-none"
          >
            {MODE_ICON[displayMode]}
            {buttonLabel}
            {!isActive && <Kbd>{MODE_SHORTCUT[displayMode]}</Kbd>}
          </Button>
          <Button
            active={isActive}
            onClick={() => setPopoverOpen((v) => !v)}
            aria-label="Switch drawing tool"
            aria-haspopup="menu"
            aria-expanded={popoverOpen}
            className="rounded-l-none border-l border-line/60 px-1.5"
            title="Switch tool"
          >
            <ChevronDown size={13} />
          </Button>
          {popoverOpen && (
            <DrawingToolsPopover
              activeMode={drawMode}
              onSelect={handleSelectMode}
              onClose={() => setPopoverOpen(false)}
            />
          )}
        </div>
      </header>

      <div className="flex-1 overflow-auto min-h-0">
        <PdfDocumentView
          fileUrl={fileUrl}
          fields={fields}
          tables={tables}
          selection={selection}
          activeTableId={activeTableId}
          onSelect={onSelect}
          zoom={zoom}
          onPagesLoaded={setNumPages}
          drawMode={drawMode}
          onDrawComplete={handleDrawComplete}
        />
      </div>
    </section>
  );
}
