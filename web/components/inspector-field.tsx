"use client";

import * as React from "react";
import { AlertTriangle, Check, Lock, Pin, Trash2 } from "lucide-react";
import { cn } from "@/lib/cn";
import { confidenceLevel } from "@/lib/bbox";
import type { ExtractedField, FieldDataType, FieldUpdate } from "@/lib/types";
import { TypePopover } from "./type-popover";
import styles from "./inspector-field.module.css";

interface InspectorFieldProps {
  field: ExtractedField;
  selected: boolean;
  onSelect: (id: string) => void;
  onUpdate: (id: string, update: FieldUpdate) => void;
  onDelete: (id: string) => void;
}

export function InspectorField({
  field,
  selected,
  onSelect,
  onUpdate,
  onDelete,
}: InspectorFieldProps) {
  const [editing, setEditing] = React.useState(false);
  const [draft, setDraft] = React.useState(field.value ?? "");
  const [typeAnchor, setTypeAnchor] = React.useState<DOMRect | null>(null);
  const inputRef = React.useRef<HTMLInputElement>(null);
  const rowRef = React.useRef<HTMLDivElement>(null);

  // Keep the draft in sync if the underlying value changes while not editing
  // (e.g., after an optimistic rollback or a refetch).
  React.useEffect(() => {
    if (!editing) setDraft(field.value ?? "");
  }, [field.value, editing]);

  // Focus + select the input when entering edit mode.
  React.useEffect(() => {
    if (editing) {
      inputRef.current?.focus();
      inputRef.current?.select();
    }
  }, [editing]);

  // Scroll selected row into view when selection changes from elsewhere.
  React.useEffect(() => {
    if (selected) {
      rowRef.current?.scrollIntoView({ block: "nearest", behavior: "smooth" });
    }
  }, [selected]);

  const commitEdit = () => {
    const next = draft;
    setEditing(false);
    if (next !== (field.value ?? "")) {
      onUpdate(field.id, { value: next });
    }
  };

  const cancelEdit = () => {
    setDraft(field.value ?? "");
    setEditing(false);
  };

  const handleKey = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      commitEdit();
    } else if (e.key === "Escape") {
      e.preventDefault();
      cancelEdit();
    }
  };

  const level = confidenceLevel(field.confidence);
  const confidenceClass =
    level === "high" ? styles.flagOk : level === "med" ? styles.flagWarn : styles.flagErr;
  const confidenceLabel = `${Math.round(field.confidence * 100)}%`;
  const showConfidenceFlag = field.confidence < 0.9;

  return (
    <div
      ref={rowRef}
      className={cn(styles.row, selected && styles.selected)}
      data-confidence={level}
      onClick={() => onSelect(field.id)}
    >
      <div className={styles.labelRow}>
        <div className={styles.label}>
          <span>{field.name}</span>
          {field.isRequired && (
            <span className={styles.reqBadge} title="Required">
              REQ
            </span>
          )}
          {field.isCorrected && (
            <span className={styles.correctedBadge} title="Edited by you">
              <Check size={10} />
            </span>
          )}
        </div>
        <div className={styles.actions} onClick={(e) => e.stopPropagation()}>
          <button
            type="button"
            className={styles.typeChip}
            title="Change data type"
            onClick={(e) => setTypeAnchor(e.currentTarget.getBoundingClientRect())}
          >
            {field.dataType}
          </button>
          <button
            type="button"
            className={styles.iconBtn}
            title={field.isRequired ? "Make optional" : "Mark required"}
            onClick={() => onUpdate(field.id, { isRequired: !field.isRequired })}
          >
            {field.isRequired ? <Lock size={13} /> : <Pin size={13} />}
          </button>
          <button
            type="button"
            className={cn(styles.iconBtn, styles.iconDanger)}
            title="Remove field"
            onClick={() => onDelete(field.id)}
          >
            <Trash2 size={13} />
          </button>
        </div>
      </div>

      <div
        className={cn(styles.value, editing && styles.valueEditing, !draft && styles.valueEmpty)}
        onClick={(e) => {
          e.stopPropagation();
          onSelect(field.id);
          setEditing(true);
        }}
      >
        {editing ? (
          <input
            ref={inputRef}
            className={styles.input}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onBlur={commitEdit}
            onKeyDown={handleKey}
            onClick={(e) => e.stopPropagation()}
          />
        ) : (
          draft || "—"
        )}
      </div>

      {showConfidenceFlag && (
        <div className={styles.flags}>
          <span className={cn(styles.flag, confidenceClass)}>
            <AlertTriangle size={10} />
            {confidenceLabel} confidence
          </span>
        </div>
      )}

      {typeAnchor && (
        <TypePopover
          anchorRect={typeAnchor}
          current={field.dataType}
          onPick={(type: FieldDataType) => onUpdate(field.id, { dataType: type })}
          onClose={() => setTypeAnchor(null)}
        />
      )}
    </div>
  );
}
