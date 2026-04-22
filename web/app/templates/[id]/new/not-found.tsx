import Link from "next/link";

export default function NotFound() {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-2 text-center px-6">
      <p className="text-[14px] text-ink font-medium">Template not found</p>
      <p className="text-[12px] text-ink-3 max-w-[360px]">
        It may have been deleted. Save a new template from a parsed document
        to use the fill workflow.
      </p>
      <Link
        href="/documents"
        className="text-[12px] text-accent-ink underline-offset-2 hover:underline"
      >
        Back to documents
      </Link>
    </div>
  );
}
