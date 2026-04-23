"use client";

import * as React from "react";
import dynamic from "next/dynamic";
import { FileWarning } from "lucide-react";
import { cn } from "@/lib/cn";
import { fileUrl as apiFileUrl } from "@/lib/api-client";
import { polygonToPercentBBox } from "@/lib/bbox";
import type { BoundingRegion, TemplateFieldRule } from "@/lib/types";

// Match the fill stage's SSR-skip boundary for react-pdf.
const PdfDocumentView = dynamic(
  () => import("../document/pdf-document-view"),
  {
    ssr: false,
    loading: () => (
      <div className="py-12 px-6 text-center text-ink-3 text-[13px]">
        Loading preview…
      </div>
    ),
  }
);

interface TemplatePreviewPaneProps {
  sourceDocumentId: string | null;
  /** Rules with their current (possibly edited) names — the overlay labels
   *  boxes using whatever the user has typed so the preview stays in sync. */
  rules: Array<Pick<TemplateFieldRule, "id" | "name" | "boundingRegions">>;
}

/**
 * Ghosted read-only PDF preview with labeled bounding boxes. Intentionally
 * not interactive: this surface is an orientation aid, not an editor. If the
 * user wants to change a region they need to save a new template from a
 * fresh parse (see TEMPLATES_PAGE.md §1 — out of scope for V1 edit flow).
 */
export function TemplatePreviewPane({
  sourceDocumentId,
  rules,
}: TemplatePreviewPaneProps) {
  const sourcePdfUrl = sourceDocumentId ? apiFileUrl(sourceDocumentId) : null;

  if (!sourcePdfUrl) {
    return (
      <div
        className={cn(
          "flex flex-col items-center justify-center gap-2",
          "bg-surface border border-line rounded-lg p-8 text-center"
        )}
      >
        <FileWarning size={22} aria-hidden="true" className="text-ink-3" />
        <p className="m-0 text-[13px] text-ink-2 font-medium">
          Source document unavailable
        </p>
        <p className="m-0 max-w-[340px] text-[12px] text-ink-3 leading-[1.5]">
          The original document this template was saved from has been deleted.
          You can still edit names, types, hints, and aliases above.
        </p>
      </div>
    );
  }

  return (
    <section
      aria-label="Template preview"
      className="flex flex-col bg-surface border border-line rounded-lg overflow-hidden"
    >
      <header className="flex items-center gap-2 py-2 px-3 border-b border-line bg-surface-2">
        <span className="text-[11px] text-ink-3 font-semibold tracking-[0.04em] uppercase">
          Preview
        </span>
        <span className="text-[11.5px] text-ink-4">
          Read-only · regions can&rsquo;t be edited here
        </span>
      </header>
      <div className="max-h-[60vh] overflow-auto bg-bg">
        <PdfDocumentView
          fileUrl={sourcePdfUrl}
          fields={[]}
          selectedFieldId={null}
          onSelectField={() => {}}
          zoom={0.85}
          drawMode={false}
          onDrawComplete={() => {}}
          renderPageOverlay={({ pageNumber, pageWidthPoints, pageHeightPoints }) => (
            <PreviewOverlay
              pageNumber={pageNumber}
              pageWidthPoints={pageWidthPoints}
              pageHeightPoints={pageHeightPoints}
              rules={rules}
            />
          )}
        />
      </div>
    </section>
  );
}

interface PreviewOverlayProps {
  pageNumber: number;
  pageWidthPoints: number;
  pageHeightPoints: number;
  rules: Array<Pick<TemplateFieldRule, "id" | "name" | "boundingRegions">>;
}

/**
 * Non-interactive overlay of every rule region that lives on this page.
 * Labeled bboxes let the user confirm "which box is this rule?" without
 * leaving the edit view.
 */
function PreviewOverlay({
  pageNumber,
  pageWidthPoints,
  pageHeightPoints,
  rules,
}: PreviewOverlayProps) {
  return (
    <div className="absolute inset-0 pointer-events-none">
      {rules.map((rule) => {
        const region = pickRegion(rule.boundingRegions, pageNumber);
        if (!region || region.pageNumber !== pageNumber) return null;

        const bbox = polygonToPercentBBox(
          region.polygon,
          pageWidthPoints,
          pageHeightPoints
        );
        if (!bbox) return null;

        return (
          <div
            key={rule.id}
            className={cn(
              "absolute border border-accent bg-accent-weak/50",
              "rounded-[2px]"
            )}
            style={{
              left: `${bbox.x}%`,
              top: `${bbox.y}%`,
              width: `${bbox.w}%`,
              height: `${bbox.h}%`,
            }}
          >
            <span
              className={cn(
                "absolute -top-[18px] left-0",
                "py-[1px] px-1.5 rounded-[3px]",
                "bg-accent text-white font-ui text-[10px] font-medium",
                "whitespace-nowrap max-w-[200px] overflow-hidden text-ellipsis"
              )}
              title={rule.name}
            >
              {rule.name || "(unnamed)"}
            </span>
          </div>
        );
      })}
    </div>
  );
}

function pickRegion(regions: BoundingRegion[], pageNumber: number): BoundingRegion | null {
  if (regions.length === 0) return null;
  return regions.find((r) => r.pageNumber === pageNumber) ?? regions[0];
}
