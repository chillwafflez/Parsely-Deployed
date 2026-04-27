"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Clock, LayoutTemplate } from "lucide-react";
import { cn } from "@/lib/cn";
import { useAppShell } from "@/lib/app-shell-context";
import { getDocumentTypeName } from "@/lib/document-types";
import { formatRelativeTime } from "@/lib/format";
import type { TemplateSummary } from "@/lib/types";
import { TemplateRowActions, type RowAction } from "./template-row-actions";

interface TemplatesTableProps {
  templates: TemplateSummary[];
  /** True while a per-row action (duplicate) is in flight — disables row click. */
  busyTemplateId?: string | null;
  onRowAction: (action: RowAction, template: TemplateSummary) => void;
}

// Card wrapper shared with the skeleton; also kept local to templates-table so
// the table doesn't import from templates-placeholder (small circular-import
// smell otherwise — cleanest to duplicate a one-line class list).
const CARD_WRAPPER = cn(
  "bg-surface border border-line rounded-lg shadow-sm overflow-hidden"
);

const CELL_PADDING = "py-2.5 px-3.5";

const BODY_CELL = cn(
  CELL_PADDING,
  "text-[13px] text-ink-2 align-middle",
  "border-b border-line group-last:border-b-0",
  "group-hover:bg-accent-weak"
);

/**
 * Reusable templates index table. Row click opens the fill flow
 * (`/templates/:id/new`); the kebab in the final column exposes Edit /
 * Duplicate / Delete without triggering the row click.
 */
export function TemplatesTable({
  templates,
  busyTemplateId,
  onRowAction,
}: TemplatesTableProps) {
  const router = useRouter();

  return (
    <div className={CARD_WRAPPER}>
      <table className="w-full border-collapse">
        <thead className="bg-surface-2">
          <tr>
            <Th>Name</Th>
            <Th>Vendor</Th>
            <Th>Kind</Th>
            <Th align="right">Rules</Th>
            <Th align="right">Runs</Th>
            <Th>Created</Th>
            {/* Kebab column — header intentionally empty. */}
            <Th>
              <span className="sr-only">Actions</span>
            </Th>
          </tr>
        </thead>
        <tbody>
          {templates.map((t) => (
            <TemplateRow
              key={t.id}
              template={t}
              busy={busyTemplateId === t.id}
              onOpen={() => router.push(`/templates/${t.id}/new`)}
              onAction={(action) => onRowAction(action, t)}
            />
          ))}
        </tbody>
      </table>
    </div>
  );
}

interface TemplateRowProps {
  template: TemplateSummary;
  busy: boolean;
  onOpen: () => void;
  onAction: (action: RowAction) => void;
}

function TemplateRow({ template, busy, onOpen, onAction }: TemplateRowProps) {
  const { documentTypes } = useAppShell();

  const handleKey = (e: React.KeyboardEvent<HTMLTableRowElement>) => {
    // Enter/Space navigate to fill flow — matches the sidebar card pattern.
    if (e.key === "Enter" || e.key === " ") {
      const target = e.target as HTMLElement;
      // Don't hijack a Space/Enter that's already targeting the kebab button.
      if (target.closest("button")) return;
      e.preventDefault();
      if (!busy) onOpen();
    }
  };

  return (
    <tr
      role="button"
      tabIndex={0}
      aria-label={`Use template ${template.name}`}
      aria-disabled={busy || undefined}
      onClick={() => !busy && onOpen()}
      onKeyDown={handleKey}
      className={cn(
        "group cursor-pointer transition-[background-color] duration-100",
        "focus-visible:outline-[2px_solid_var(--color-accent)] focus-visible:outline-offset-[-2px]",
        busy && "opacity-60 cursor-wait"
      )}
    >
      <td className={BODY_CELL}>
        <div className="flex items-center gap-2 max-w-[360px]">
          <LayoutTemplate size={14} aria-hidden="true" className="shrink-0 text-ink-4" />
          <span
            title={template.name}
            className="overflow-hidden text-ellipsis whitespace-nowrap font-medium text-ink"
          >
            {template.name}
          </span>
        </div>
      </td>
      <td className={BODY_CELL}>
        <VendorCell vendorHint={template.vendorHint} />
      </td>
      <td className={BODY_CELL}>
        <span className="text-ink-2">
          {getDocumentTypeName(documentTypes, template.modelId)}
        </span>
      </td>
      <td className={cn(BODY_CELL, "text-right")}>
        <span className="font-mono text-[12px] text-ink-3">{template.ruleCount}</span>
      </td>
      <td className={cn(BODY_CELL, "text-right")}>
        <span className="font-mono text-[12px] text-ink-3">{template.runs}</span>
      </td>
      <td className={BODY_CELL}>
        <div className="flex items-center gap-[5px] text-ink-3 text-[12px] whitespace-nowrap">
          <Clock size={11} aria-hidden="true" />
          {formatRelativeTime(template.createdAt)}
        </div>
      </td>
      <td className={cn(BODY_CELL, "text-right w-[52px]")}>
        <TemplateRowActions templateName={template.name} onSelect={onAction} />
      </td>
    </tr>
  );
}

/**
 * Vendor hint may be null (template saved from a document without a
 * recognized VendorName). Em-dash placeholder keeps the column visually
 * aligned across rows that do and don't have a vendor.
 */
function VendorCell({ vendorHint }: { vendorHint: string | null }) {
  if (!vendorHint) {
    return <span className="text-ink-4">—</span>;
  }
  return (
    <span
      title={vendorHint}
      className="block max-w-[220px] overflow-hidden text-ellipsis whitespace-nowrap text-ink-2"
    >
      {vendorHint}
    </span>
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
