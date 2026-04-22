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
 * Full-layout skeleton for `/documents/[id]`. Mirrors the ReviewStage split
 * (document viewer on the left, Inspector on the right) so the transition
 * into the loaded editor feels continuous rather than jarring.
 */
export function DocumentLoadingSkeleton() {
  return (
    <div
      aria-busy="true"
      aria-label="Loading document"
      role="status"
      className="flex flex-1 min-w-0 min-h-0 bg-bg"
    >
      <div className="flex flex-1 flex-col min-w-0 min-h-0">
        <div
          className={cn(
            "flex items-center gap-3 py-2.5 px-3.5",
            "border-b border-line bg-surface"
          )}
        >
          <Skeleton width={180} height={13} />
          <div className="ml-auto flex gap-1.5">
            <Skeleton width={60} height={24} radius={6} />
            <Skeleton width={60} height={24} radius={6} />
          </div>
        </div>
        <div className="flex-1 overflow-hidden flex justify-center p-5">
          <div
            className={cn(
              "w-[min(720px,100%)] aspect-[8.5/11]",
              "bg-surface border border-line rounded-md shadow-sm",
              "py-10 px-11",
              "flex flex-col gap-2.5"
            )}
          >
            <Skeleton width="60%" height={18} />
            <Skeleton width="40%" height={14} />
            <div className="h-3" />
            <Skeleton width="85%" height={12} />
            <Skeleton width="92%" height={12} />
            <Skeleton width="78%" height={12} />
            <div className="h-3" />
            <Skeleton width="65%" height={12} />
            <Skeleton width="88%" height={12} />
            <Skeleton width="72%" height={12} />
          </div>
        </div>
      </div>

      <div
        className={cn(
          "w-[400px] shrink-0 flex flex-col min-h-0",
          "bg-surface border-l border-line"
        )}
      >
        <div
          className={cn(
            "flex flex-col gap-3 pt-3.5 px-3.5 pb-3",
            "border-b border-line"
          )}
        >
          <Skeleton width={120} height={14} />
          <div className="grid grid-cols-3 gap-1.5">
            <Skeleton height={44} radius={6} />
            <Skeleton height={44} radius={6} />
            <Skeleton height={44} radius={6} />
          </div>
        </div>
        <div className="py-2.5 px-3.5 border-b border-line">
          <Skeleton height={28} radius={6} />
        </div>
        <div className="flex-1 overflow-hidden py-1.5">
          {Array.from({ length: 5 }).map((_, i) => (
            <div
              key={i}
              className="flex flex-col gap-2 py-3 px-3.5 border-b border-line"
            >
              <div className="flex items-center justify-between gap-2">
                <Skeleton width={110} height={11} />
                <Skeleton width={54} height={18} radius={4} />
              </div>
              <Skeleton width="75%" height={13} />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/** Rendered when the API fetch fails for non-404 reasons (network, 500, etc.). */
export function DocumentErrorPanel({ message }: { message: string }) {
  return (
    <div className={PANEL_CLASS} role="alert">
      <AlertTriangle
        size={28}
        aria-hidden="true"
        className="text-[oklch(0.58_0.17_28)]"
      />
      <h3 className="mt-1 mb-0 text-[15px] font-semibold tracking-[-0.01em] text-ink">
        Couldn&rsquo;t load document
      </h3>
      <p className="m-0 max-w-[360px] text-[13.5px] leading-[1.5]">{message}</p>
      <Link href="/documents" className={LINK_CLASS}>
        Back to documents
      </Link>
    </div>
  );
}

/** Rendered by Next.js `not-found.tsx` when the document id doesn't exist. */
export function DocumentNotFoundPanel() {
  return (
    <div className={PANEL_CLASS}>
      <FileX
        size={28}
        aria-hidden="true"
        className="text-[oklch(0.58_0.17_28)]"
      />
      <h3 className="mt-1 mb-0 text-[15px] font-semibold tracking-[-0.01em] text-ink">
        Document not found
      </h3>
      <p className="m-0 max-w-[360px] text-[13.5px] leading-[1.5]">
        The document you&rsquo;re looking for doesn&rsquo;t exist or was deleted.
      </p>
      <Link href="/documents" className={LINK_CLASS}>
        Back to documents
      </Link>
    </div>
  );
}
