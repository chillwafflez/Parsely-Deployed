import Link from "next/link";
import { AlertTriangle, LayoutTemplate } from "lucide-react";
import { cn } from "@/lib/cn";
import { Skeleton } from "../ui/skeleton";

// Card frame shared by the table and the loading skeleton so they line up
// visually as the page transitions from skeleton → table.
const CARD_WRAPPER = cn(
  "bg-surface border border-line rounded-lg shadow-sm overflow-hidden"
);

const LINK_CLASS = cn(
  "mt-1 inline-block py-[7px] px-3 rounded-lg",
  "bg-surface border border-line no-underline",
  "font-ui text-[13px] font-medium text-accent-ink",
  "transition-[background-color,border-color] duration-[120ms]",
  "hover:bg-surface-2",
  "hover:border-[color-mix(in_oklch,var(--color-accent)_40%,var(--color-line))]"
);

const PANEL_CLASS = cn(
  "flex flex-1 flex-col items-center justify-center gap-3",
  "py-12 px-6 text-center text-ink-2"
);

/**
 * Skeleton for `/templates` while the list is fetched. Mirrors the real table
 * columns (name / vendor / kind / rules / runs / created / kebab) so the
 * reveal is continuous.
 */
export function TemplatesLoadingSkeleton() {
  const widths = [
    ["200px", "140px", "70px", "32px", "32px", "70px"],
    ["170px", "160px", "70px", "32px", "32px", "70px"],
    ["210px", "120px", "70px", "32px", "32px", "70px"],
    ["150px", "150px", "70px", "32px", "32px", "70px"],
    ["180px", "130px", "70px", "32px", "32px", "70px"],
  ];
  return (
    <div
      aria-busy="true"
      aria-label="Loading templates"
      role="status"
      className={CARD_WRAPPER}
    >
      {widths.map((cols, i) => (
        <div
          key={i}
          className={cn(
            "flex items-center gap-4 py-3 px-3.5",
            i < widths.length - 1 && "border-b border-line"
          )}
        >
          {cols.map((w, j) => (
            <Skeleton key={j} width={w} height={13} />
          ))}
        </div>
      ))}
    </div>
  );
}

/**
 * Empty-state panel shown when no templates exist yet. Templates are saved
 * from the review stage after a parse, so the CTA points at the parse route
 * rather than pretending there's a "New template" form.
 */
export function TemplatesEmptyState() {
  return (
    <div className="flex flex-col items-center justify-center gap-4 py-20 px-6 text-center">
      <div
        className={cn(
          "w-14 h-14 grid place-items-center rounded-xl",
          "bg-accent-weak border border-accent-border text-accent-ink"
        )}
      >
        <LayoutTemplate size={24} aria-hidden="true" />
      </div>
      <h2 className="m-0 text-[17px] font-semibold tracking-[-0.01em] text-ink">
        No templates yet
      </h2>
      <p className="m-0 max-w-[340px] text-ink-3 text-[13px] leading-[1.55]">
        Save one after reviewing a parsed document. Future uploads that match
        will auto-apply its field rules.
      </p>
      <Link href="/" className={LINK_CLASS}>
        Go to Parse
      </Link>
    </div>
  );
}

/** Rendered when the list fetch fails for non-404 reasons. */
export function TemplatesErrorPanel({ message }: { message: string }) {
  return (
    <div className={PANEL_CLASS} role="alert">
      <AlertTriangle
        size={28}
        aria-hidden="true"
        className="text-[oklch(0.58_0.17_28)]"
      />
      <h3 className="mt-1 mb-0 text-[15px] font-semibold tracking-[-0.01em] text-ink">
        Couldn&rsquo;t load templates
      </h3>
      <p className="m-0 max-w-[420px] text-[13.5px] leading-[1.5]">{message}</p>
      <Link href="/documents" className={LINK_CLASS}>
        Back to documents
      </Link>
    </div>
  );
}
