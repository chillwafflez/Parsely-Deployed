"use client";

import * as React from "react";
import {
  Button,
  Spinner,
  Text,
  makeStyles,
  shorthands,
  tokens,
} from "@fluentui/react-components";
import { ArrowUpload24Regular } from "@fluentui/react-icons";
import type { DocumentResponse } from "@/lib/types";
import { uploadDocument } from "@/lib/api-client";

interface DocumentUploaderProps {
  onUploaded: (doc: DocumentResponse) => void;
}

const useStyles = makeStyles({
  dropzone: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    rowGap: tokens.spacingVerticalM,
    ...shorthands.padding(tokens.spacingVerticalXXL),
    ...shorthands.border("2px", "dashed", tokens.colorNeutralStroke2),
    ...shorthands.borderRadius(tokens.borderRadiusLarge),
    backgroundColor: tokens.colorNeutralBackground1,
    transitionProperty: "border-color, background-color",
    transitionDuration: "120ms",
    transitionTimingFunction: "ease",
  },
  dropzoneActive: {
    ...shorthands.borderColor(tokens.colorBrandStroke1),
    backgroundColor: tokens.colorBrandBackground2,
  },
  hiddenInput: {
    display: "none",
  },
  error: {
    color: tokens.colorPaletteRedForeground1,
    marginTop: tokens.spacingVerticalM,
  },
});

export function DocumentUploader({ onUploaded }: DocumentUploaderProps) {
  const styles = useStyles();
  const inputRef = React.useRef<HTMLInputElement>(null);
  const [isUploading, setIsUploading] = React.useState(false);
  const [isDragging, setIsDragging] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const handleFile = async (file: File) => {
    setError(null);
    setIsUploading(true);
    try {
      const result = await uploadDocument(file);
      onUploaded(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setIsUploading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  const onInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) void handleFile(file);
  };

  const onDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) void handleFile(file);
  };

  return (
    <div>
      <div
        className={
          isDragging
            ? `${styles.dropzone} ${styles.dropzoneActive}`
            : styles.dropzone
        }
        onDragOver={(e) => {
          e.preventDefault();
          setIsDragging(true);
        }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={onDrop}
      >
        <ArrowUpload24Regular />
        <Text weight="semibold" size={400}>
          Drop an invoice PDF here, or browse to upload
        </Text>
        <Text size={200}>Supported: PDF, PNG, JPG, TIFF (up to 20 MB)</Text>
        <Button
          appearance="primary"
          disabled={isUploading}
          onClick={() => inputRef.current?.click()}
          icon={isUploading ? <Spinner size="tiny" /> : undefined}
        >
          {isUploading ? "Analyzing…" : "Choose file"}
        </Button>
        <input
          ref={inputRef}
          type="file"
          accept=".pdf,.png,.jpg,.jpeg,.tif,.tiff"
          className={styles.hiddenInput}
          onChange={onInputChange}
        />
      </div>
      {error && (
        <Text className={styles.error} block>
          {error}
        </Text>
      )}
    </div>
  );
}
