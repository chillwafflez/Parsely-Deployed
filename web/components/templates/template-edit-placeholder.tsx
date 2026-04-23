import Link from "next/link";
import { AlertTriangle, FileX } from "lucide-react";
import { cn } from "@/lib/cn";
import { Skeleton } from "../ui/skeleton";

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
 * Full-layout skeleton for `/templates/[id]/edit`. Mirrors the two-pane +
 * preview-below structure of TemplateEditStage so the transition into the
 * loaded page is continuous rather than a reflow.
 */
export function TemplateEditLoadingSkeleton() {
  return (
    <section
      aria-busy="true"
      aria-label="Loading template"
      role="status"
      className="flex flex-col flex-1 min-w-0 min-h-0 bg-bg"
    >
      <div
        className={cn(
          "flex items-center gap-3 py-2.5 px-4",
          "bg-surface border-b border-line"
        )}
      >
        <Skeleton width={18} height={18} radius={4} />
        <Skeleton width={180} height={14} />
        <div className="ml-auto flex items-center gap-2">
          <Skeleton width={72} height={26} radius={6} />
          <Skeleton width={130} height={26} radius={6} />
        </div>
      </div>

      <div className="flex-1 overflow-auto p-5">
        <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)] gap-4 mb-4">
          <div className="bg-surface border border-line rounded-lg p-4 flex flex-col gap-3">
            <Skeleton width="40%" height={11} />
            <Skeleton height={30} radius={6} />
            <Skeleton width="40%" height={11} />
            <Skeleton height={72} radius={6} />
            <div className="grid grid-cols-2 gap-3">
              <div className="flex flex-col gap-1.5">
                <Skeleton width="50%" height={11} />
                <Skeleton height={30} radius={6} />
              </div>
              <div className="flex flex-col gap-1.5">
                <Skeleton width="50%" height={11} />
                <Skeleton height={30} radius={6} />
              </div>
            </div>
          </div>
          <div className="bg-surface border border-line rounded-lg p-4 flex flex-col gap-2.5">
            <Skeleton width="30%" height={11} />
            {[0, 1, 2, 3].map((i) => (
              <Skeleton key={i} height={46} radius={6} />
            ))}
          </div>
        </div>
        <div
          className={cn(
            "mx-auto w-[min(720px,100%)] aspect-[8.5/11]",
            "bg-surface border border-line rounded-md shadow-sm opacity-60"
          )}
        />
      </div>
    </section>
  );
}

/** Rendered when the API fetch fails for non-404 reasons. */
export function TemplateEditErrorPanel({ message }: { message: string }) {
  return (
    <div className={PANEL_CLASS} role="alert">
      <AlertTriangle size={28} aria-hidden="true" className="text-[oklch(0.58_0.17_28)]" />
      <h3 className="mt-1 mb-0 text-[15px] font-semibold tracking-[-0.01em] text-ink">
        Couldn&rsquo;t load template
      </h3>
      <p className="m-0 max-w-[420px] text-[13.5px] leading-[1.5]">{message}</p>
      <Link href="/templates" className={LINK_CLASS}>
        Back to templates
      </Link>
    </div>
  );
}

/** Rendered by Next.js not-found.tsx when the template id doesn't exist. */
export function TemplateEditNotFoundPanel() {
  return (
    <div className={PANEL_CLASS}>
      <FileX size={28} aria-hidden="true" className="text-[oklch(0.58_0.17_28)]" />
      <h3 className="mt-1 mb-0 text-[15px] font-semibold tracking-[-0.01em] text-ink">
        Template not found
      </h3>
      <p className="m-0 max-w-[360px] text-[13.5px] leading-[1.5]">
        It may have been deleted. Head back to the templates list to see what&rsquo;s still around.
      </p>
      <Link href="/templates" className={LINK_CLASS}>
        Back to templates
      </Link>
    </div>
  );
}
