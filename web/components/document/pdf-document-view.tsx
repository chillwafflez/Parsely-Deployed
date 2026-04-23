"use client";

import * as React from "react";
import { Document, Page, pdfjs } from "react-pdf";
import "react-pdf/dist/Page/AnnotationLayer.css";
import "react-pdf/dist/Page/TextLayer.css";
import type { DrawResult, ExtractedField } from "@/lib/types";
import { BoundingBoxOverlay } from "./bounding-box-overlay";
import { DrawingLayer } from "./drawing-layer";

/** Arguments passed to a custom page-overlay renderer. */
export interface PageOverlayArgs {
  pageNumber: number;
  pageWidthPoints: number;
  pageHeightPoints: number;
}

/**
 * Render prop that replaces the default BoundingBoxOverlay when provided
 * (and drawMode is false). Lets the TemplateFillStage plug in its
 * FieldSlotOverlay without duplicating the react-pdf wiring in this file.
 */
export type PageOverlayRenderer = (args: PageOverlayArgs) => React.ReactNode;

/**
 * PDF.js worker config. Per react-pdf docs this MUST live in the same module
 * as the <Document>/<Page> usage — otherwise Next.js module execution order
 * may let the default value overwrite our custom setting.
 *
 * Using the CDN variant instead of `new URL('pdfjs-dist/build/pdf.worker.min.mjs',
 * import.meta.url)` because the import.meta.url path is unreliable under
 * Next.js 15 + Webpack (source-map transforms can break pdfjs module init).
 */
pdfjs.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;

interface PdfDocumentViewProps {
  fileUrl: string;
  fields: ExtractedField[];
  selectedFieldId: string | null;
  onSelectField: (id: string | null) => void;
  zoom: number;
  onPagesLoaded?: (count: number) => void;
  drawMode: boolean;
  onDrawComplete: (result: DrawResult) => void;
  /**
   * Optional renderer that replaces the default BoundingBoxOverlay.
   * Called per page once its native dimensions are known. Ignored when
   * drawMode is active.
   */
  renderPageOverlay?: PageOverlayRenderer;
}

interface PageDimensions {
  widthPoints: number;
  heightPoints: number;
}

const BASE_PAGE_WIDTH = 720;

export default function PdfDocumentView({
  fileUrl,
  fields,
  selectedFieldId,
  onSelectField,
  zoom,
  onPagesLoaded,
  drawMode,
  onDrawComplete,
  renderPageOverlay,
}: PdfDocumentViewProps) {
  const [numPages, setNumPages] = React.useState(0);
  const [pageDims, setPageDims] = React.useState<Map<number, PageDimensions>>(
    () => new Map()
  );
  const [loadError, setLoadError] = React.useState<string | null>(null);

  const handleDocumentLoad = ({ numPages: n }: { numPages: number }) => {
    setNumPages(n);
    setLoadError(null);
    onPagesLoaded?.(n);
  };

  // Structural type instead of `PDFPageProxy` from pdfjs-dist: pnpm's isolated
  // store can resolve two separate copies of pdfjs-dist (one direct, one via
  // react-pdf), and their `#private` brands collide under strict mode. The
  // shape below is all we actually use.
  const handlePageLoad = React.useCallback(
    (page: {
      pageNumber: number;
      getViewport: (opts: { scale: number }) => { width: number; height: number };
    }) => {
      // The callback's `page.width` / `page.height` are the *rendered* pixel
      // dimensions, not the native PDF points. Ask for the scale-1 viewport
      // to get the true native size used by Azure DI's polygon coordinates.
      const viewport = page.getViewport({ scale: 1 });
      setPageDims((prev) => {
        const next = new Map(prev);
        next.set(page.pageNumber, {
          widthPoints: viewport.width,
          heightPoints: viewport.height,
        });
        return next;
      });
    },
    []
  );

  return (
    <div className="flex flex-col items-center gap-4 p-6 min-h-full">
      <Document
        file={fileUrl}
        onLoadSuccess={handleDocumentLoad}
        onLoadError={(err) => setLoadError(err.message)}
        loading={
          <div className="py-12 px-6 text-center text-ink-3 text-[13px]">
            Loading PDF…
          </div>
        }
        error={
          <div className="py-12 px-6 text-center text-err text-[13px]">
            {loadError ?? "Failed to load PDF."}
          </div>
        }
        noData={
          <div className="py-12 px-6 text-center text-ink-3 text-[13px]">
            No PDF specified.
          </div>
        }
      >
        {Array.from({ length: numPages }, (_, idx) => {
          const pageNumber = idx + 1;
          const dims = pageDims.get(pageNumber);

          return (
            <div
              key={pageNumber}
              className="relative rounded-[2px] bg-white shadow-md overflow-hidden"
            >
              <Page
                pageNumber={pageNumber}
                width={BASE_PAGE_WIDTH * zoom}
                onLoadSuccess={handlePageLoad}
                renderTextLayer={false}
                renderAnnotationLayer={false}
                className="block"
              />
              {dims && drawMode && (
                <DrawingLayer
                  pageNumber={pageNumber}
                  pageWidthPoints={dims.widthPoints}
                  pageHeightPoints={dims.heightPoints}
                  onDrawComplete={onDrawComplete}
                />
              )}
              {dims && !drawMode && renderPageOverlay
                ? renderPageOverlay({
                    pageNumber,
                    pageWidthPoints: dims.widthPoints,
                    pageHeightPoints: dims.heightPoints,
                  })
                : dims && !drawMode && (
                    <BoundingBoxOverlay
                      pageNumber={pageNumber}
                      pageWidthPoints={dims.widthPoints}
                      pageHeightPoints={dims.heightPoints}
                      fields={fields}
                      selectedFieldId={selectedFieldId}
                      onSelectField={onSelectField}
                    />
                  )}
            </div>
          );
        })}
      </Document>
    </div>
  );
}
