"use client";

import * as React from "react";
import { Upload, Zap } from "lucide-react";
import { Button } from "./button";
import { cn } from "@/lib/cn";
import { uploadDocument } from "@/lib/api-client";
import type { DocumentResponse } from "@/lib/types";
import styles from "./upload-stage.module.css";

interface UploadStageProps {
  onUploadStart: () => void;
  onUploadComplete: (doc: DocumentResponse) => void;
  onUploadError: (message: string) => void;
}

export function UploadStage({ onUploadStart, onUploadComplete, onUploadError }: UploadStageProps) {
  const inputRef = React.useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = React.useState(false);

  const handleFile = async (file: File) => {
    onUploadStart();
    try {
      const doc = await uploadDocument(file);
      onUploadComplete(doc);
    } catch (err) {
      onUploadError(err instanceof Error ? err.message : "Upload failed");
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) void handleFile(file);
    if (inputRef.current) inputRef.current.value = "";
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) void handleFile(file);
  };

  return (
    <div className={styles.stage}>
      <div
        className={cn(styles.dropzone, isDragging && styles.hot)}
        onDragOver={(e) => {
          e.preventDefault();
          setIsDragging(true);
        }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={handleDrop}
      >
        <div className={styles.icon}>
          <Upload size={24} />
        </div>
        <h2>Drop a document to parse</h2>
        <p>Or choose a file — up to 20 MB. We&rsquo;ll auto-match to a template if we recognize it.</p>
        <div className={styles.actions}>
          <Button variant="primary" onClick={() => inputRef.current?.click()}>
            <Upload size={14} />
            Choose file
          </Button>
          <Button onClick={() => inputRef.current?.click()}>
            <Zap size={14} />
            Try sample invoice
          </Button>
        </div>
        <div className={styles.fileTypes}>PDF · PNG · JPG · TIFF</div>
        <input
          ref={inputRef}
          type="file"
          accept=".pdf,.png,.jpg,.jpeg,.tif,.tiff"
          className={styles.hidden}
          onChange={handleInputChange}
        />
      </div>
    </div>
  );
}
