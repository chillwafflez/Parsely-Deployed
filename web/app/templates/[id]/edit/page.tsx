"use client";

import { use } from "react";
import { TemplateEditLoader } from "@/components/templates/template-edit-loader";

interface TemplateEditPageProps {
  params: Promise<{ id: string }>;
}

/**
 * Dynamic route for the template edit page. Same Next.js 15 + React 19
 * `use()` unwrap pattern as `/templates/[id]/new` and `/documents/[id]` —
 * destructuring `params` directly would throw.
 */
export default function TemplateEditPage({ params }: TemplateEditPageProps) {
  const { id } = use(params);
  return <TemplateEditLoader templateId={id} />;
}
