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
 * Full-layout skeleton for `/templates/[id]/new`. Matches TemplateFillStage's
 * toolbar + centered-page-viewer split so the transition into the loaded
 * stage is continuous. The inner placeholder blocks hint at the upcoming
 * field slots without being misleadingly specific about positions.
 */
export function TemplateFillLoadingSkeleton() {
  return (
    <section
      aria-busy="true"
      aria-label="Loading template"
      role="status"
      className="flex flex-col flex-1 min-w-0 min-h-0 bg-bg"
    >
      <div
        className={cn(
          "flex items-center gap-3 py-2.5 px-3.5",
          "bg-surface border-b border-line"
        )}
      >
        <Skeleton width={170} height={13} />
        <Skeleton width={60} height={11} />
        <div className="ml-auto flex items-center gap-1.5">
          <Skeleton width={28} height={24} radius={6} />
          <Skeleton width={38} height={11} />
          <Skeleton width={28} height={24} radius={6} />
          <div className="w-px h-5 bg-line mx-1" />
          <Skeleton width={72} height={24} radius={6} />
          <Skeleton width={110} height={24} radius={6} />
        </div>
      </div>

      <div className="flex-1 overflow-hidden flex justify-center p-5">
        <div
          className={cn(
            "w-[min(720px,100%)] aspect-[8.5/11]",
            "bg-surface border border-line rounded-md shadow-sm",
            "p-8 flex flex-col gap-2.5 opacity-60"
          )}
        >
          <Skeleton width="45%" height={16} />
          <Skeleton width="60%" height={12} />
          <div className="h-3" />
          <div className="grid grid-cols-2 gap-3">
            <Skeleton height={22} radius={4} />
            <Skeleton height={22} radius={4} />
            <Skeleton height={22} radius={4} />
            <Skeleton height={22} radius={4} />
          </div>
          <div className="h-3" />
          <Skeleton width="75%" height={12} />
          <Skeleton width="62%" height={12} />
          <Skeleton width="80%" height={12} />
          <div className="h-3" />
          <div className="grid grid-cols-3 gap-3">
            <Skeleton height={22} radius={4} />
            <Skeleton height={22} radius={4} />
            <Skeleton height={22} radius={4} />
          </div>
        </div>
      </div>
    </section>
  );
}

/** Rendered when the API fetch fails for non-404 reasons (network, 500, etc.). */
export function TemplateFillErrorPanel({ message }: { message: string }) {
  return (
    <div className={PANEL_CLASS} role="alert">
      <AlertTriangle
        size={28}
        aria-hidden="true"
        className="text-[oklch(0.58_0.17_28)]"
      />
      <h3 className="mt-1 mb-0 text-[15px] font-semibold tracking-[-0.01em] text-ink">
        Couldn&rsquo;t load template
      </h3>
      <p className="m-0 max-w-[420px] text-[13.5px] leading-[1.5]">{message}</p>
      <Link href="/documents" className={LINK_CLASS}>
        Back to documents
      </Link>
    </div>
  );
}

/** Rendered by Next.js `not-found.tsx` when the template id doesn't exist. */
export function TemplateFillNotFoundPanel() {
  return (
    <div className={PANEL_CLASS}>
      <FileX
        size={28}
        aria-hidden="true"
        className="text-[oklch(0.58_0.17_28)]"
      />
      <h3 className="mt-1 mb-0 text-[15px] font-semibold tracking-[-0.01em] text-ink">
        Template not found
      </h3>
      <p className="m-0 max-w-[360px] text-[13.5px] leading-[1.5]">
        It may have been deleted. Save a new template from a parsed document
        to use the fill workflow.
      </p>
      <Link href="/documents" className={LINK_CLASS}>
        Back to documents
      </Link>
    </div>
  );
}
