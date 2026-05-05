"use client";

import * as React from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/cn";

interface InspectorGroupProps {
  /** Stable id used to derive `aria-controls`. Falls back to a slug of `title`
   *  when omitted. */
  id?: string;
  title: string;
  count: number;
  /** Optional visual marker rendered between the chevron and title — e.g. a
   *  Σ icon for aggregation groups, a Table icon for the Tables group. */
  icon?: React.ReactNode;
  defaultOpen?: boolean;
  children: React.ReactNode;
}

/**
 * WAI-ARIA disclosure pattern: a header button with `aria-expanded` toggles
 * a panel referenced via `aria-controls`. Open state is in-memory only — if
 * the parent re-keys the group, the state resets (matches the design
 * decision to keep collapse non-persistent for v1).
 */
export function InspectorGroup({
  id,
  title,
  count,
  icon,
  defaultOpen = true,
  children,
}: InspectorGroupProps) {
  const [open, setOpen] = React.useState(defaultOpen);
  const slug = id ?? title.replace(/\W+/g, "-").toLowerCase();
  const panelId = `inspector-group-${slug}-panel`;

  return (
    <section className="border-b border-line last:border-b-0">
      <button
        type="button"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen((o) => !o)}
        className={cn(
          "flex items-center gap-2 w-full",
          "px-3.5 pt-3 pb-3 text-left",
          "rounded-md",
          "focus-visible:outline-[2px_solid_var(--color-accent)] focus-visible:outline-offset-[-2px]"
        )}
      >
        <ChevronDown
          size={12}
          aria-hidden
          className={cn(
            "text-ink-4 transition-transform shrink-0",
            !open && "-rotate-90"
          )}
        />
        {icon}
        <span className="text-[11px] font-semibold uppercase tracking-[0.06em] text-ink">
          {title}
        </span>
        <span
          className={cn(
            "ml-auto inline-flex items-center justify-center",
            "min-w-[22px] px-2 py-0.5 rounded-full",
            "text-[10.5px] font-medium font-mono",
            "bg-surface-2 border border-line text-ink-3"
          )}
        >
          {count}
        </span>
      </button>
      {open && (
        <div id={panelId} className="flex flex-col gap-0.5 px-2 pb-2">
          {children}
        </div>
      )}
    </section>
  );
}
