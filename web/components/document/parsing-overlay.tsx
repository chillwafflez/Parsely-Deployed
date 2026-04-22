import { Check } from "lucide-react";
import { cn } from "@/lib/cn";
import styles from "./parsing-overlay.module.css";

interface ParsingOverlayProps {
  fileName: string;
}

/**
 * Visual progress indicator shown while the API round-trips the upload to
 * Azure Document Intelligence. The step progression is cosmetic — the real
 * work happens on the server as a single async call.
 */
export function ParsingOverlay({ fileName }: ParsingOverlayProps) {
  return (
    <div className={styles.overlay}>
      <div className={styles.card}>
        <h3>Parsing {fileName}</h3>
        <p className={styles.sub}>Extracting fields with Azure Document Intelligence…</p>
        <ol className={styles.steps}>
          <Step label="OCR + text extraction" state="done" />
          <Step label="Layout fingerprint" state="done" />
          <Step label="Field extraction" state="current" />
          <Step label="Validating types &amp; rules" state="pending" />
        </ol>
        <div className={styles.bar}>
          <span />
        </div>
      </div>
    </div>
  );
}

function Step({ label, state }: { label: string; state: "done" | "current" | "pending" }) {
  return (
    <li className={cn(styles.step, styles[state])}>
      <span className={styles.dot} aria-hidden="true">
        {state === "done" && <Check size={9} />}
      </span>
      <span>{label}</span>
    </li>
  );
}
