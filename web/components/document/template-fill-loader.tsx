"use client";

import * as React from "react";
import { notFound } from "next/navigation";
import { getTemplate } from "@/lib/api-client";
import type { Template } from "@/lib/types";
import { TemplateFillStage } from "./template-fill-stage";
import {
  TemplateFillErrorPanel,
  TemplateFillLoadingSkeleton,
} from "./template-fill-placeholder";

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
  if (state.kind === "loading") return <TemplateFillLoadingSkeleton />;

  return <TemplateFillStage key={state.template.id} template={state.template} />;
}
