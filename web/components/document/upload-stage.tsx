"use client";

import * as React from "react";
import { Upload, Zap } from "lucide-react";
import { Button } from "../ui/button";
import { cn } from "@/lib/cn";
import { uploadDocument } from "@/lib/api-client";
import type { DocumentResponse } from "@/lib/types";

interface UploadStageProps {
  onUploadStart: (fileName: string) => void;
  onUploadComplete: (doc: DocumentResponse) => void;
  onUploadError: (message: string) => void;
}

// 16px repeating dot grid behind the dropzone. Extracted out of the class list
// because the comma-separated `background: radial-gradient(...), color` shorthand
// is unwieldy as a Tailwind arbitrary value — inline style keeps it readable.
const STAGE_BG: React.CSSProperties = {
  background:
    "radial-gradient(circle at 1px 1px, rgba(15, 23, 42, 0.06) 1px, transparent 0) 0 0 / 16px 16px, var(--color-bg)",
};

export function UploadStage({ onUploadStart, onUploadComplete, onUploadError }: UploadStageProps) {
  const inputRef = React.useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = React.useState(false);

  const handleFile = async (file: File) => {
    onUploadStart(file.name);
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
    <div className="flex-1 grid place-items-center p-10" style={STAGE_BG}>
      <div
        className={cn(
          "w-[620px] max-w-full text-center",
          "bg-surface rounded-lg shadow-sm",
          "border-[1.5px] border-dashed",
          "py-12 px-8",
          "transition-[border-color,background-color] duration-[120ms]",
          isDragging
            ? "border-accent bg-accent-weak"
            : "border-line-strong"
        )}
        onDragOver={(e) => {
          e.preventDefault();
          setIsDragging(true);
        }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={handleDrop}
      >
        <div
          className={cn(
            "w-14 h-14 mx-auto",
            "grid place-items-center rounded-xl",
            "bg-accent-weak border border-accent-border text-accent-ink"
          )}
        >
          <Upload size={24} />
        </div>
        <h2 className="mt-2.5 mb-1.5 text-[18px] font-semibold tracking-[-0.01em]">
          Drop a document to parse
        </h2>
        <p className="m-0 mb-[18px] text-ink-3 text-[13px]">
          Or choose a file — up to 20 MB. We&rsquo;ll auto-match to a template if we recognize it.
        </p>
        <div className="flex gap-2 justify-center">
          <Button variant="primary" onClick={() => inputRef.current?.click()}>
            <Upload size={14} />
            Choose file
          </Button>
          <Button onClick={() => inputRef.current?.click()}>
            <Zap size={14} />
            Try sample invoice
          </Button>
        </div>
        <div className="mt-3.5 font-mono text-[11px] text-ink-4 tracking-[0.04em]">
          PDF · PNG · JPG · TIFF
        </div>
        <input
          ref={inputRef}
          type="file"
          accept=".pdf,.png,.jpg,.jpeg,.tif,.tiff"
          className="hidden"
          onChange={handleInputChange}
        />
      </div>
    </div>
  );
}
