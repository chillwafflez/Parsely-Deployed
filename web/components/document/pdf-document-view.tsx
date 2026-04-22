"use client";

import * as React from "react";
import { Document, Page, pdfjs } from "react-pdf";
import "react-pdf/dist/Page/AnnotationLayer.css";
import "react-pdf/dist/Page/TextLayer.css";
import type { DrawResult, ExtractedField } from "@/lib/types";
import { BoundingBoxOverlay } from "./bounding-box-overlay";
import { DrawingLayer } from "./drawing-layer";
import styles from "./pdf-document-view.module.css";

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
    <div className={styles.stage}>
      <Document
        file={fileUrl}
        onLoadSuccess={handleDocumentLoad}
        onLoadError={(err) => setLoadError(err.message)}
        loading={<div className={styles.status}>Loading PDF…</div>}
        error={
          <div className={styles.error}>
            {loadError ?? "Failed to load PDF."}
          </div>
        }
        noData={<div className={styles.status}>No PDF specified.</div>}
      >
        {Array.from({ length: numPages }, (_, idx) => {
          const pageNumber = idx + 1;
          const dims = pageDims.get(pageNumber);

          return (
            <div key={pageNumber} className={styles.pageWrapper}>
              <Page
                pageNumber={pageNumber}
                width={BASE_PAGE_WIDTH * zoom}
                onLoadSuccess={handlePageLoad}
                renderTextLayer={false}
                renderAnnotationLayer={false}
                className={styles.page}
              />
              {dims && !drawMode && (
                <BoundingBoxOverlay
                  pageNumber={pageNumber}
                  pageWidthPoints={dims.widthPoints}
                  pageHeightPoints={dims.heightPoints}
                  fields={fields}
                  selectedFieldId={selectedFieldId}
                  onSelectField={onSelectField}
                />
              )}
              {dims && drawMode && (
                <DrawingLayer
                  pageNumber={pageNumber}
                  pageWidthPoints={dims.widthPoints}
                  pageHeightPoints={dims.heightPoints}
                  onDrawComplete={onDrawComplete}
                />
              )}
            </div>
          );
        })}
      </Document>
    </div>
  );
}
