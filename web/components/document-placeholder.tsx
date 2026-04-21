import Link from "next/link";
import { AlertTriangle, FileX } from "lucide-react";
import styles from "./document-placeholder.module.css";

/** Fills the workspace pane while the document fetch is in-flight. */
export function DocumentLoadingPanel() {
  return (
    <div className={styles.panel} role="status" aria-live="polite">
      <div className={styles.spinner} aria-hidden="true" />
      <p>Loading document…</p>
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
      <Link href="/" className={styles.link}>
        Back to upload
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
      <Link href="/" className={styles.link}>
        Back to upload
      </Link>
    </div>
  );
}
