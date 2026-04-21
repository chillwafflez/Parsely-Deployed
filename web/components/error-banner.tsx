import * as React from "react";
import { AlertCircle, X } from "lucide-react";
import { cn } from "@/lib/cn";
import styles from "./error-banner.module.css";

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
    <div className={cn(styles.banner, className)} role="alert">
      <AlertCircle size={16} className={styles.icon} aria-hidden="true" />
      <div className={styles.body}>
        {title && <div className={styles.title}>{title}</div>}
        <div className={styles.message}>{message}</div>
      </div>
      {onDismiss && (
        <button
          type="button"
          className={styles.dismiss}
          onClick={onDismiss}
          aria-label="Dismiss error"
        >
          <X size={14} aria-hidden="true" />
        </button>
      )}
    </div>
  );
}
