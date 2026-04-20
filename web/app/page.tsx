"use client";

import * as React from "react";
import {
  Divider,
  Text,
  Title1,
  Title3,
  makeStyles,
  tokens,
} from "@fluentui/react-components";
import { DocumentUploader } from "@/components/document-uploader";
import { ExtractedFieldsTable } from "@/components/extracted-fields-table";
import type { DocumentResponse } from "@/lib/types";

const useStyles = makeStyles({
  page: {
    maxWidth: "960px",
    marginTop: 0,
    marginBottom: 0,
    marginLeft: "auto",
    marginRight: "auto",
    paddingTop: tokens.spacingVerticalXXL,
    paddingBottom: tokens.spacingVerticalXXL,
    paddingLeft: tokens.spacingHorizontalL,
    paddingRight: tokens.spacingHorizontalL,
    display: "flex",
    flexDirection: "column",
    rowGap: tokens.spacingVerticalL,
  },
  header: {
    display: "flex",
    flexDirection: "column",
    rowGap: tokens.spacingVerticalXS,
  },
  resultHeader: {
    display: "flex",
    alignItems: "baseline",
    justifyContent: "space-between",
    columnGap: tokens.spacingHorizontalM,
  },
  subtle: {
    color: tokens.colorNeutralForeground3,
  },
  errorText: {
    color: tokens.colorPaletteRedForeground1,
  },
});

export default function HomePage() {
  const styles = useStyles();
  const [document, setDocument] = React.useState<DocumentResponse | null>(null);

  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <Title1>Document Parsing</Title1>
        <Text className={styles.subtle}>
          Upload an invoice to extract structured fields using Azure AI Document Intelligence.
        </Text>
      </header>

      <DocumentUploader onUploaded={setDocument} />

      {document && (
        <>
          <Divider />
          <div className={styles.resultHeader}>
            <Title3>{document.fileName}</Title3>
            <Text className={styles.subtle}>
              {document.status}
              {document.fields.length > 0 && ` · ${document.fields.length} fields`}
            </Text>
          </div>
          {document.errorMessage && (
            <Text className={styles.errorText}>{document.errorMessage}</Text>
          )}
          <ExtractedFieldsTable fields={document.fields} />
        </>
      )}
    </main>
  );
}
