"use client";

import * as React from "react";
import { DocumentPane } from "./document-pane";
import { FieldListSimple } from "./field-list-simple";
import { fileUrl as apiFileUrl } from "@/lib/api-client";
import type { DocumentResponse } from "@/lib/types";
import styles from "./review-stage.module.css";

interface ReviewStageProps {
  document: DocumentResponse;
}

/**
 * Composes the PDF viewer (left) with the field list (right). Owns the
 * selected-field state so clicking a bbox or a field row stays in sync.
 */
export function ReviewStage({ document }: ReviewStageProps) {
  const [selectedFieldId, setSelectedFieldId] = React.useState<string | null>(null);
  const pdfUrl = React.useMemo(() => apiFileUrl(document.id), [document.id]);

  return (
    <div className={styles.wrapper}>
      <DocumentPane
        fileUrl={pdfUrl}
        fileName={document.fileName}
        fields={document.fields}
        selectedFieldId={selectedFieldId}
        onSelectField={setSelectedFieldId}
      />
      <FieldListSimple
        fields={document.fields}
        selectedFieldId={selectedFieldId}
        onSelectField={setSelectedFieldId}
      />
    </div>
  );
}
