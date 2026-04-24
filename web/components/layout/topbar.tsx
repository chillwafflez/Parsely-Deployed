"use client";

import * as React from "react";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { LayoutTemplate, Settings } from "lucide-react";
import { Button } from "../ui/button";
import { useAppShell } from "@/lib/app-shell-context";
import type { TemplateSummary } from "@/lib/types";

interface TopbarProps {
  documentName?: string;
  templateName?: string | null;
}

export function Topbar({ documentName, templateName }: TopbarProps) {
  const pathname = usePathname();
  const { templates } = useAppShell();
  const crumbs = buildBreadcrumbs(pathname, documentName, templates);

  return (
    <header
      className={[
        "flex items-center gap-3 px-4 h-full",
        "border-b border-line bg-surface",
        "z-[2]",
      ].join(" ")}
    >
      <div className="flex items-center gap-2.5 font-semibold text-[15px] tracking-[-0.01em]">
        {/* Decorative — the adjacent "Parsely" text provides the accessible
            name, so alt="" marks it decorative and avoids double-announcement.
            `unoptimized` is required for SVG — Next.js blocks them from the
            Image Optimization API unless dangerouslyAllowSVG is set. */}
        <Image
          src="/logo.svg"
          alt=""
          aria-hidden="true"
          width={26}
          height={26}
          unoptimized
          priority
          className="w-[26px] h-[26px] rounded-md object-contain"
        />
        <span>Parsely</span>
      </div>
      {crumbs.length > 0 && (
        <nav
          className="flex items-center gap-[7px] text-ink-3 text-[13.5px]"
          aria-label="Breadcrumbs"
        >
          {crumbs.map((crumb, i) => {
            const isLast = i === crumbs.length - 1;
            return (
              <React.Fragment key={`${i}-${crumb}`}>
                <span className="text-ink-4">/</span>
                <span className={isLast ? "text-ink font-medium" : undefined}>
                  {crumb}
                </span>
              </React.Fragment>
            );
          })}
        </nav>
      )}
      {templateName && (
        <span
          title={`Matched template: ${templateName}`}
          className={[
            "inline-flex items-center gap-[5px] ml-2",
            "py-1 pr-[9px] pl-2",
            "text-[12px] font-medium text-accent-ink",
            "bg-[color-mix(in_oklch,var(--color-accent)_10%,transparent)]",
            "border border-[color-mix(in_oklch,var(--color-accent)_30%,transparent)]",
            "rounded-full max-w-[240px]",
            "overflow-hidden text-ellipsis whitespace-nowrap",
          ].join(" ")}
        >
          <LayoutTemplate size={12} aria-hidden="true" />
          {templateName}
        </span>
      )}
      <div className="flex-1" />
      <Button variant="ghost" aria-label="Settings">
        <Settings size={16} />
      </Button>
      <div
        aria-hidden="true"
        className={[
          "w-[30px] h-[30px] rounded-full",
          "bg-[oklch(0.85_0.04_232)] text-accent-ink",
          "text-[12px] font-semibold grid place-items-center",
        ].join(" ")}
      >
        JK
      </div>
    </header>
  );
}

/**
 * Builds the breadcrumb segments for the current route. Returns label strings
 * only — the Topbar handles the separator and "you-are-here" styling on the
 * last segment. An empty array means no breadcrumb is rendered (the Parsely
 * logo is enough context on its own).
 *
 *  /                          → []                    (upload landing, no crumb)
 *  /documents                 → ["Documents"]
 *  /documents/<id>            → ["Documents", <doc name>]
 *  /templates                 → ["Templates"]
 *  /templates/<id>/edit|new   → ["Templates", <template name>]
 *
 * Template name comes from the already-fetched summary list in shell context,
 * so deep-linking to a template URL before that list loads briefly shows just
 * `Templates` until the name arrives. Prototype-acceptable.
 */
function buildBreadcrumbs(
  pathname: string,
  documentName: string | undefined,
  templates: TemplateSummary[]
): string[] {
  if (pathname === "/documents") return ["Documents"];
  if (pathname.startsWith("/documents/")) {
    return documentName ? ["Documents", documentName] : ["Documents"];
  }

  if (pathname === "/templates") return ["Templates"];
  if (pathname.startsWith("/templates/")) {
    const templateId = /^\/templates\/([^/]+)\//.exec(pathname)?.[1];
    const template = templateId
      ? templates.find((t) => t.id === templateId)
      : undefined;
    return template ? ["Templates", template.name] : ["Templates"];
  }

  return [];
}
