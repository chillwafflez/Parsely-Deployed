"use client";

import { FileText } from "lucide-react";
import type { DocumentResponse } from "@/lib/types";
import { confidenceLevel } from "@/lib/constants";
import { Button } from "./button";
import styles from "./review-stage-placeholder.module.css";

interface ReviewStagePlaceholderProps {
  document: DocumentResponse;
  onNewUpload: () => void;
}

/**
 * Day-2 placeholder. The real two-pane layout (DocumentPane + Inspector)
 * lands in Day 3–4. For now we confirm the round-trip works and show the
 * raw parsed fields in the design's visual language.
 */
export function ReviewStagePlaceholder({ document, onNewUpload }: ReviewStagePlaceholderProps) {
  return (
    <div className={styles.wrapper}>
      <div className={styles.header}>
        <div className={styles.title}>
          <FileText size={15} />
          <span className={styles.fileName}>{document.fileName}</span>
          <span className={styles.meta}>
            · {document.status} · {document.fields.length} fields
          </span>
        </div>
        <Button onClick={onNewUpload}>Upload another</Button>
      </div>

      <div className={styles.body}>
        {document.errorMessage && <div className={styles.error}>{document.errorMessage}</div>}

        {document.fields.length === 0 ? (
          <div className={styles.empty}>No fields extracted.</div>
        ) : (
          <ul className={styles.fields}>
            {document.fields.map((f) => {
              const level = confidenceLevel(f.confidence);
              return (
                <li key={f.id} className={styles.field} data-confidence={level}>
                  <div className={styles.fieldLabel}>{f.name}</div>
                  <div className={styles.fieldValue}>{f.value || <em>—</em>}</div>
                  <div className={styles.fieldMeta}>
                    <span className={styles.type}>{f.dataType}</span>
                    <span className={styles.confidence}>
                      {(f.confidence * 100).toFixed(1)}%
                    </span>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
