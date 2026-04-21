"use client";

import * as React from "react";
import { cn } from "@/lib/cn";
import { confidenceLevel } from "@/lib/bbox";
import type { ExtractedField } from "@/lib/types";
import styles from "./field-list-simple.module.css";

interface FieldListSimpleProps {
  fields: ExtractedField[];
  selectedFieldId: string | null;
  onSelectField: (id: string | null) => void;
}

/**
 * Day-3 interim right-pane field list. Enables bidirectional selection sync
 * with the PDF overlay. Day 4 replaces this with the full Inspector (search,
 * filter pills, inline editing, type popover, required toggle).
 */
export function FieldListSimple({ fields, selectedFieldId, onSelectField }: FieldListSimpleProps) {
  const selectedRef = React.useRef<HTMLButtonElement>(null);

  React.useEffect(() => {
    if (selectedRef.current) {
      selectedRef.current.scrollIntoView({ block: "nearest", behavior: "smooth" });
    }
  }, [selectedFieldId]);

  return (
    <aside className={styles.pane} aria-label="Extracted fields">
      <header className={styles.header}>
        <h3>Parsed fields</h3>
        <p className={styles.sub}>{fields.length} extracted</p>
      </header>
      <div className={styles.list}>
        {fields.length === 0 ? (
          <p className={styles.empty}>No fields extracted from this document.</p>
        ) : (
          fields.map((f) => {
            const isSelected = f.id === selectedFieldId;
            const level = confidenceLevel(f.confidence);
            return (
              <button
                ref={isSelected ? selectedRef : undefined}
                type="button"
                key={f.id}
                className={cn(styles.field, isSelected && styles.selected)}
                data-confidence={level}
                onClick={() => onSelectField(isSelected ? null : f.id)}
              >
                <div className={styles.label}>{f.name}</div>
                <div className={styles.value}>{f.value || <em>—</em>}</div>
                <div className={styles.meta}>
                  <span className={styles.type}>{f.dataType}</span>
                  <span className={styles.confidence}>
                    {(f.confidence * 100).toFixed(0)}%
                  </span>
                </div>
              </button>
            );
          })
        )}
      </div>
    </aside>
  );
}
