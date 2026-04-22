"use client";

import { use } from "react";
import { DocumentLoader } from "@/components/document/document-loader";

interface DocumentPageProps {
  params: Promise<{ id: string }>;
}

/**
 * Dynamic route for viewing a single parsed document. The id segment is a
 * Promise in Next.js 15 — unwrap it with `use()` before handing off to the
 * client-side loader. Loading / error / not-found UI lives alongside this
 * file via Next's `loading.tsx` + `not-found.tsx` conventions plus the
 * loader's internal placeholders.
 */
export default function DocumentPage({ params }: DocumentPageProps) {
  const { id } = use(params);
  return <DocumentLoader documentId={id} />;
}
