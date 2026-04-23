import { cn } from "@/lib/cn";
import { TemplatesLoadingSkeleton } from "@/components/templates/templates-placeholder";

/** Next.js route-convention loading UI — renders while the page chunk loads. */
export default function Loading() {
  return (
    <div className="flex flex-1 flex-col min-h-0 bg-bg">
      <header
        className={cn(
          "flex items-center gap-3 shrink-0",
          "py-3 px-6 bg-surface border-b border-line"
        )}
      >
        <h1 className="m-0 text-[15px] font-semibold text-ink tracking-[-0.01em]">
          Templates
        </h1>
      </header>
      <div className="flex-1 overflow-y-auto py-5 px-6">
        <TemplatesLoadingSkeleton />
      </div>
    </div>
  );
}
