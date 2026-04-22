"use client";

import * as React from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getTemplate } from "@/lib/api-client";
import type { Template } from "@/lib/types";
import { TemplateFillStage } from "./template-fill-stage";

type LoaderState =
  | { kind: "loading" }
  | { kind: "ready"; template: Template }
  | { kind: "not-found" }
  | { kind: "error"; message: string };

interface TemplateFillLoaderProps {
  templateId: string;
}

/**
 * Owns the canonical template state for `/templates/[id]/new`. Mirrors
 * DocumentLoader's discriminated-union pattern so loading / 404 / error
 * states are handled out-of-band of TemplateFillStage's typing flow.
 * The fill stage is keyed on template id so navigating between templates
 * remounts cleanly (and clears the in-progress fill state, which is by
 * design — the fill is per-session, not persisted).
 */
export function TemplateFillLoader({ templateId }: TemplateFillLoaderProps) {
  const [state, setState] = React.useState<LoaderState>({ kind: "loading" });

  React.useEffect(() => {
    let cancelled = false;
    setState({ kind: "loading" });

    (async () => {
      try {
        const template = await getTemplate(templateId);
        if (cancelled) return;
        setState({ kind: "ready", template });
      } catch (err) {
        if (cancelled) return;
        const message =
          err instanceof Error ? err.message : "Failed to load template";
        if (/\b404\b/.test(message)) {
          setState({ kind: "not-found" });
        } else {
          setState({ kind: "error", message });
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [templateId]);

  if (state.kind === "not-found") notFound();
  if (state.kind === "error") return <TemplateFillErrorPanel message={state.message} />;
  if (state.kind === "loading") return <TemplateFillLoading />;

  return <TemplateFillStage key={state.template.id} template={state.template} />;
}

export function TemplateFillLoading() {
  return (
    <div
      role="status"
      aria-live="polite"
      className="flex flex-1 items-center justify-center text-ink-3 text-[13px]"
    >
      Loading template…
    </div>
  );
}

function TemplateFillErrorPanel({ message }: { message: string }) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-2 text-center px-6">
      <p className="text-[14px] text-err font-medium">Couldn&apos;t load template</p>
      <p className="text-[12px] text-ink-3 max-w-[420px]">{message}</p>
      <Link
        href="/documents"
        className="text-[12px] text-accent-ink underline-offset-2 hover:underline"
      >
        Back to documents
      </Link>
    </div>
  );
}
