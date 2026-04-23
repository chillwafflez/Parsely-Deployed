import { LayoutTemplate, Settings } from "lucide-react";
import { Button } from "../ui/button";

interface TopbarProps {
  documentName?: string;
  templateName?: string | null;
}

const MARK_STYLE: React.CSSProperties = {
  background:
    "linear-gradient(135deg, var(--color-accent) 0%, oklch(0.45 0.16 252) 100%)",
  boxShadow: "inset 0 -1px 0 rgba(0, 0, 0, 0.15), 0 1px 2px rgba(0, 0, 0, 0.12)",
};

export function Topbar({ documentName, templateName }: TopbarProps) {
  return (
    <header
      className={[
        "flex items-center gap-3 px-4 h-full",
        "border-b border-line bg-surface",
        "z-[2]",
      ].join(" ")}
    >
      <div className="flex items-center gap-2.5 font-semibold text-[15px] tracking-[-0.01em]">
        <div
          className="w-[26px] h-[26px] rounded-md grid place-items-center text-white text-[13px] font-bold"
          style={MARK_STYLE}
        >
          P
        </div>
        <span>Parsely</span>
      </div>
      <nav
        className="flex items-center gap-[7px] text-ink-3 text-[13.5px]"
        aria-label="Breadcrumbs"
      >
        <span className="text-ink-4">/</span>
        <span>Documents</span>
        {documentName && (
          <>
            <span className="text-ink-4">/</span>
            <span className="text-ink font-medium">{documentName}</span>
          </>
        )}
      </nav>
      {templateName && (
        <span
          title={`Matched template: ${templateName}`}
          className={[
            "inline-flex items-center gap-[5px] ml-2",
            "py-1 pr-[9px] pl-2",
            "text-[12px] font-medium text-accent-ink",
            "bg-[color-mix(in_oklch,var(--color-accent)_10%,transparent)]",
            "border border-[color-mix(in_oklch,var(--color-accent)_30%,transparent)]",
            "rounded-full max-w-[240px]",
            "overflow-hidden text-ellipsis whitespace-nowrap",
          ].join(" ")}
        >
          <LayoutTemplate size={12} aria-hidden="true" />
          {templateName}
        </span>
      )}
      <div className="flex-1" />
      <Button variant="ghost" aria-label="Settings">
        <Settings size={16} />
      </Button>
      <div
        aria-hidden="true"
        className={[
          "w-[30px] h-[30px] rounded-full",
          "bg-[oklch(0.85_0.04_232)] text-accent-ink",
          "text-[12px] font-semibold grid place-items-center",
        ].join(" ")}
      >
        JK
      </div>
    </header>
  );
}
