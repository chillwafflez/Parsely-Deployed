import * as React from "react";
import { AlertCircle, X } from "lucide-react";
import { cn } from "@/lib/cn";

interface ErrorBannerProps {
  message: string;
  /** Optional bold title above the message (e.g., "Upload failed"). */
  title?: string;
  /** If provided, renders a dismiss button that calls this handler. */
  onDismiss?: () => void;
  className?: string;
}

/**
 * Persistent inline error banner for errors that should stay visible until the
 * user acknowledges or retries (e.g., upload failures, fetch errors). Distinct
 * from toasts, which are transient confirmations.
 */
export function ErrorBanner({
  message,
  title,
  onDismiss,
  className,
}: ErrorBannerProps) {
  return (
    <div
      role="alert"
      className={cn(
        "flex items-start gap-2.5",
        "py-2.5 pr-3 pl-3.5",
        "bg-err-weak border rounded-md",
        "border-[color-mix(in_oklab,var(--color-err)_22%,white)]",
        "text-err text-[13px]",
        className
      )}
    >
      <AlertCircle
        size={16}
        aria-hidden="true"
        className="shrink-0 mt-px"
      />
      <div className="flex-1 min-w-0">
        {title && (
          <div className="font-semibold mb-0.5 text-ink">{title}</div>
        )}
        <div className="leading-[1.45] break-words text-ink-2">{message}</div>
      </div>
      {onDismiss && (
        <button
          type="button"
          onClick={onDismiss}
          aria-label="Dismiss error"
          className={cn(
            "shrink-0 w-[22px] h-[22px] -mt-px p-0",
            "grid place-items-center",
            "border-0 bg-transparent rounded-[4px] cursor-pointer",
            "text-err opacity-70",
            "transition-[opacity,background-color] duration-[120ms]",
            "hover:opacity-100",
            "hover:bg-[color-mix(in_oklab,var(--color-err)_15%,white)]",
            "focus-visible:outline-[2px_solid_var(--color-err)]",
            "focus-visible:outline-offset-1 focus-visible:opacity-100"
          )}
        >
          <X size={14} aria-hidden="true" />
        </button>
      )}
    </div>
  );
}
