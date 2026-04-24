import { Check } from "lucide-react";
import { cn } from "@/lib/cn";

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
    <div className="flex-1 grid place-items-center bg-bg">
      <div
        className={cn(
          "w-[380px] bg-surface rounded-lg border border-line p-7",
          "shadow-md"
        )}
      >
        <h3 className="m-0 mb-1 text-[14px] font-semibold">
          Parsing {fileName}
        </h3>
        <p className="m-0 mb-[18px] text-ink-3 text-[12.5px]">
          Extracting fields…
        </p>
        <ol className="list-none m-0 p-0 flex flex-col gap-2.5 text-[12.5px]">
          <Step label="OCR + text extraction" state="done" />
          <Step label="Layout fingerprint" state="done" />
          <Step label="Field extraction" state="current" />
          <Step label="Validating types &amp; rules" state="pending" />
        </ol>
        <div className="mt-[18px] h-1 rounded-[2px] bg-surface-2 overflow-hidden">
          <span
            className={cn(
              "block h-full w-[72%] transition-[width] duration-[400ms] ease",
              "bg-[linear-gradient(90deg,var(--color-accent),oklch(0.62_0.13_262))]"
            )}
          />
        </div>
      </div>
    </div>
  );
}

type StepState = "done" | "current" | "pending";

function Step({ label, state }: { label: string; state: StepState }) {
  const textClass =
    state === "done"
      ? "text-ink"
      : state === "current"
        ? "text-ink font-medium"
        : "text-ink-3";

  const dotClass =
    state === "done"
      ? "bg-ok border-ok text-white"
      : state === "current"
        ? "bg-surface border-accent text-white"
        : "bg-surface border-line-strong text-white";

  return (
    <li className={cn("flex items-center gap-2.5", textClass)}>
      <span
        className={cn(
          "w-3.5 h-3.5 rounded-full border-[1.5px] grid place-items-center",
          dotClass
        )}
        aria-hidden="true"
      >
        {state === "done" && <Check size={9} />}
        {state === "current" && (
          <span className="w-1.5 h-1.5 rounded-full bg-accent animate-blink" />
        )}
      </span>
      <span>{label}</span>
    </li>
  );
}
