"use client";

import { use } from "react";
import { TemplateFillLoader } from "@/components/document/template-fill-loader";

interface TemplateNewPageProps {
  params: Promise<{ id: string }>;
}

/**
 * Dynamic route for the "create from template" voice/typing fill workflow.
 * Same Next.js 15 + React 19 `use()` unwrap pattern as `/documents/[id]`.
 */
export default function TemplateNewPage({ params }: TemplateNewPageProps) {
  const { id } = use(params);
  return <TemplateFillLoader templateId={id} />;
}
