import Link from "next/link";
import { AlertTriangle, FileX } from "lucide-react";
import { Skeleton } from "../ui/skeleton";
import styles from "./document-placeholder.module.css";

/**
 * Full-layout skeleton for `/documents/[id]`. Mirrors the ReviewStage split
 * (document viewer on the left, Inspector on the right) so the transition
 * into the loaded editor feels continuous rather than jarring.
 */
export function DocumentLoadingSkeleton() {
  return (
    <div
      className={styles.skeleton}
      aria-busy="true"
      aria-label="Loading document"
      role="status"
    >
      <div className={styles.skelDocPane}>
        <div className={styles.skelToolbar}>
          <Skeleton width={180} height={13} />
          <div className={styles.skelToolbarRight}>
            <Skeleton width={60} height={24} radius={6} />
            <Skeleton width={60} height={24} radius={6} />
          </div>
        </div>
        <div className={styles.skelStage}>
          <div className={styles.skelPage}>
            <Skeleton width="60%" height={18} />
            <Skeleton width="40%" height={14} />
            <div className={styles.skelPageSpacer} />
            <Skeleton width="85%" height={12} />
            <Skeleton width="92%" height={12} />
            <Skeleton width="78%" height={12} />
            <div className={styles.skelPageSpacer} />
            <Skeleton width="65%" height={12} />
            <Skeleton width="88%" height={12} />
            <Skeleton width="72%" height={12} />
          </div>
        </div>
      </div>

      <div className={styles.skelInspector}>
        <div className={styles.skelInspectorHeader}>
          <Skeleton width={120} height={14} />
          <div className={styles.skelStats}>
            <Skeleton height={44} radius={6} />
            <Skeleton height={44} radius={6} />
            <Skeleton height={44} radius={6} />
          </div>
        </div>
        <div className={styles.skelSearch}>
          <Skeleton height={28} radius={6} />
        </div>
        <div className={styles.skelFieldList}>
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className={styles.skelFieldRow}>
              <div className={styles.skelFieldTop}>
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
    <div className={styles.panel} role="alert">
      <AlertTriangle size={28} className={styles.errIcon} aria-hidden="true" />
      <h3>Couldn&rsquo;t load document</h3>
      <p>{message}</p>
      <Link href="/documents" className={styles.link}>
        Back to documents
      </Link>
    </div>
  );
}

/** Rendered by Next.js `not-found.tsx` when the document id doesn't exist. */
export function DocumentNotFoundPanel() {
  return (
    <div className={styles.panel}>
      <FileX size={28} className={styles.errIcon} aria-hidden="true" />
      <h3>Document not found</h3>
      <p>The document you&rsquo;re looking for doesn&rsquo;t exist or was deleted.</p>
      <Link href="/documents" className={styles.link}>
        Back to documents
      </Link>
    </div>
  );
}
