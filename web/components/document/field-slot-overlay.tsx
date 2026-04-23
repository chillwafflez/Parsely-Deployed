"use client";

import { polygonToPercentBBox, primaryRegion } from "@/lib/bbox";
import type { BoundingRegion, TemplateFieldRule } from "@/lib/types";
import { FieldSlot } from "./field-slot";

interface FieldSlotOverlayProps {
  pageNumber: number;
  pageWidthPoints: number;
  pageHeightPoints: number;
  rules: TemplateFieldRule[];
  /** Keyed by rule name (matches the API contract for voice overrides). */
  filled: Record<string, string>;
  /**
   * Optional per-rule flag marking slots that should play the one-shot
   * post-voice-fill flash animation. Keyed by rule name.
   */
  flashing?: Record<string, boolean>;
  activeSlotId: string | null;
  onSelectSlot: (ruleId: string | null) => void;
  onCommit: (ruleName: string, value: string) => void;
}

/**
 * Renders one FieldSlot per rule whose primary region is on this page.
 * Positions the slot via the same polygon→percent math the
 * BoundingBoxOverlay uses for the parse-correct flow, so alignment is
 * identical across both stages.
 */
export function FieldSlotOverlay({
  pageNumber,
  pageWidthPoints,
  pageHeightPoints,
  rules,
  filled,
  flashing,
  activeSlotId,
  onSelectSlot,
  onCommit,
}: FieldSlotOverlayProps) {
  return (
    <div
      className="absolute inset-0"
      onClick={() => onSelectSlot(null)}
      aria-hidden="true"
    >
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
            className="absolute"
            style={{
              left: `${bbox.x}%`,
              top: `${bbox.y}%`,
              width: `${bbox.w}%`,
              height: `${bbox.h}%`,
            }}
          >
            <FieldSlot
              id={rule.id}
              label={rule.name}
              value={filled[rule.name] ?? ""}
              flashing={flashing?.[rule.name] ?? false}
              selected={activeSlotId === rule.id}
              onSelect={onSelectSlot}
              onCommit={(value) => onCommit(rule.name, value)}
            />
          </div>
        );
      })}
    </div>
  );
}

/** TemplateFieldRule has its own regions shape; mirror primaryRegion's logic. */
function pickRegion(
  regions: BoundingRegion[],
  pageNumber: number
): BoundingRegion | null {
  if (regions.length === 0) return null;
  return regions.find((r) => r.pageNumber === pageNumber) ?? regions[0];
}
