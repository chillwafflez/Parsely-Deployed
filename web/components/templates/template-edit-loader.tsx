"use client";

import * as React from "react";
import { notFound } from "next/navigation";
import { getTemplate } from "@/lib/api-client";
import type { Template } from "@/lib/types";
import { TemplateEditStage } from "./template-edit-stage";
import {
  TemplateEditErrorPanel,
  TemplateEditLoadingSkeleton,
} from "./template-edit-placeholder";

type LoaderState =
  | { kind: "loading" }
  | { kind: "ready"; template: Template }
  | { kind: "not-found" }
  | { kind: "error"; message: string };

interface TemplateEditLoaderProps {
  templateId: string;
}

/**
 * Discriminated-union state machine for `/templates/[id]/edit`. Mirrors
 * TemplateFillLoader so the two routes behave identically on loading / 404 /
 * error. The stage is keyed on template id so switching templates remounts
 * the editor cleanly (draft state resets — by design, since dirty work on
 * one template should not leak into another).
 */
export function TemplateEditLoader({ templateId }: TemplateEditLoaderProps) {
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
        const message = err instanceof Error ? err.message : "Failed to load template";
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
  if (state.kind === "error") return <TemplateEditErrorPanel message={state.message} />;
  if (state.kind === "loading") return <TemplateEditLoadingSkeleton />;

  return <TemplateEditStage key={state.template.id} template={state.template} />;
}
