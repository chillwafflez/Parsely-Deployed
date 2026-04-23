"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Files,
  History,
  LayoutTemplate,
  Plus,
  Trash2,
  Upload,
} from "lucide-react";
import type { TemplateSummary } from "@/lib/types";
import { cn } from "@/lib/cn";
import { formatRelativeTime } from "@/lib/format";
import { useAppShell } from "@/lib/app-shell-context";
import { deleteTemplate } from "@/lib/api-client";
import { DeleteTemplateModal } from "../modal/delete-template-modal";
import { Skeleton } from "../ui/skeleton";

interface SidebarProps {
  templates: TemplateSummary[];
  activeTemplateId: string | null;
  onPickTemplate: (id: string) => void;
  templatesLoading: boolean;
  parseCount: number;
  documentsCount?: number;
  queueCount: number;
}

/**
 * Maximum number of template cards rendered directly in the sidebar.
 * Overflow is reachable via the "View all" link to `/templates`, where the
 * full library can be managed (edit / duplicate / delete).
 */
const SIDEBAR_TEMPLATE_CAP = 6;

// Background color is intentionally left OUT of the base — callers apply
// `bg-accent-weak` (active) or `bg-transparent` (inactive) via mutually
// exclusive ternaries. Stacking both here caused the generated CSS to emit
// `.bg-transparent` after `.bg-accent-weak`, and at equal specificity source
// order wins — so the active blue tint never actually rendered. See
// CLAUDE.md §Tailwind-v4 "mutually exclusive ternaries" rule.
const NAV_ITEM_BASE = cn(
  "flex items-center gap-3 w-full",
  "py-[9px] px-3 rounded-md",
  "font-ui text-[14px] font-medium text-left no-underline",
  "border-0 cursor-pointer",
  "hover:enabled:bg-surface-2",
  "disabled:opacity-[0.55] disabled:cursor-not-allowed",
  "[&_svg]:opacity-80"
);

const NAV_COUNT_BASE = cn(
  "ml-auto py-0.5 px-[7px] rounded-[4px] border",
  "font-mono text-[12px]"
);

export function Sidebar({
  templates,
  activeTemplateId,
  onPickTemplate,
  templatesLoading,
  parseCount,
  documentsCount,
  queueCount,
}: SidebarProps) {
  const pathname = usePathname();
  const { showToast, refreshTemplates } = useAppShell();
  const [pendingDelete, setPendingDelete] = React.useState<TemplateSummary | null>(null);

  const handleConfirmDelete = React.useCallback(async () => {
    if (!pendingDelete) return;
    const target = pendingDelete;
    try {
      await deleteTemplate(target.id);
      // Close modal before refetch so the UI reacts immediately — the
      // refresh below re-syncs the sidebar list with the server.
      setPendingDelete(null);
      await refreshTemplates();
      showToast(`Template removed · ${target.name}`);
    } catch (err) {
      showToast(
        err instanceof Error ? err.message : "Failed to delete template",
        "err"
      );
      // Keep the modal open so the user can retry or cancel explicitly.
      throw err;
    }
  }, [pendingDelete, refreshTemplates, showToast]);

  return (
    <aside className="flex flex-col min-h-0 bg-surface border-r border-line">
      <div className="flex flex-col gap-[3px] pt-3 px-2.5 pb-2 border-b border-line">
        <NavLink
          href="/"
          icon={<Upload size={17} />}
          label="Parse"
          count={parseCount}
          active={pathname === "/"}
        />
        <NavLink
          href="/documents"
          icon={<History size={17} />}
          label="Documents"
          count={documentsCount}
          active={pathname.startsWith("/documents")}
        />
        <NavButtonPlaceholder
          icon={<Files size={17} />}
          label="Queue"
          count={queueCount}
          title="Batch queue — Phase 2"
        />
        <NavLink
          href="/templates"
          icon={<LayoutTemplate size={17} />}
          label="Templates"
          count={templates.length}
          active={pathname.startsWith("/templates")}
        />
      </div>

      <div
        className={cn(
          "flex items-center justify-between",
          "pt-3 px-3.5 pb-2",
          "text-ink-3 text-[12px] font-semibold tracking-[0.06em] uppercase"
        )}
      >
        <span>Templates</span>
        <button
          className={cn(
            "w-[22px] h-[22px] rounded-[4px] grid place-items-center cursor-pointer",
            "border border-line bg-surface-2 text-ink-2",
            "hover:bg-white hover:border-line-strong hover:text-ink"
          )}
          title="New template (save one from the review screen)"
          aria-label="New template"
          disabled
        >
          <Plus size={13} />
        </button>
      </div>

      <div className="flex-1 overflow-auto px-2 pb-3">
        {templatesLoading ? (
          <TemplateListSkeleton />
        ) : templates.length === 0 ? (
          <p className="py-[14px] px-2.5 text-ink-4 text-[11.5px] leading-[1.4]">
            No templates yet. Save one after reviewing a parse.
          </p>
        ) : (
          <>
            {/* API already returns templates by CreatedAt desc — slice to
                the top 6 so the sidebar doesn't scroll indefinitely as the
                library grows. Management lives on /templates. */}
            {templates.slice(0, SIDEBAR_TEMPLATE_CAP).map((t) => (
              <TemplateCard
                key={t.id}
                template={t}
                active={t.id === activeTemplateId}
                onPick={() => onPickTemplate(t.id)}
                onRequestDelete={() => setPendingDelete(t)}
              />
            ))}
            {templates.length > SIDEBAR_TEMPLATE_CAP && (
              <Link
                href="/templates"
                className={cn(
                  "block py-[7px] px-2.5 mt-1 rounded-md",
                  "text-ink-3 text-[11.5px] font-medium no-underline",
                  "hover:bg-surface-2 hover:text-ink"
                )}
              >
                View all {templates.length} →
              </Link>
            )}
          </>
        )}
      </div>

      {pendingDelete && (
        <DeleteTemplateModal
          templateName={pendingDelete.name}
          runs={pendingDelete.runs}
          onCancel={() => setPendingDelete(null)}
          onConfirm={handleConfirmDelete}
        />
      )}
    </aside>
  );
}

interface TemplateCardProps {
  template: TemplateSummary;
  active: boolean;
  onPick: () => void;
  onRequestDelete: () => void;
}

/**
 * Template card with a hover-revealed delete action. The card body is a
 * `role="button"` div (not a `<button>`) so we can nest the trash
 * `<button>` without producing invalid HTML. `group` lets the nested delete
 * button respond to card-level hover/focus-within.
 */
function TemplateCard({ template, active, onPick, onRequestDelete }: TemplateCardProps) {
  const handleKey = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      onPick();
    }
  };

  const handleDeleteClick = (e: React.MouseEvent<HTMLButtonElement>) => {
    e.stopPropagation();
    onRequestDelete();
  };

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onPick}
      onKeyDown={handleKey}
      className={cn(
        "group relative w-full mb-[3px]",
        "flex flex-col gap-1",
        "rounded-md py-2.5 px-3 cursor-pointer text-left",
        "border",
        active
          ? "bg-accent-weak border-accent-border"
          : "border-transparent bg-transparent hover:bg-surface-2",
        "focus-visible:outline-[2px_solid_var(--color-accent)] focus-visible:outline-offset-1"
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <span
          className={cn(
            "font-medium text-[13.5px]",
            active ? "text-accent-ink" : "text-ink"
          )}
        >
          {template.name}
        </span>
        <button
          type="button"
          title="Delete template"
          aria-label={`Delete template ${template.name}`}
          onClick={handleDeleteClick}
          className={cn(
            "shrink-0 w-[22px] h-[22px] p-0 grid place-items-center",
            "border-0 bg-transparent rounded-[4px] cursor-pointer",
            "text-ink-4 opacity-0",
            "transition-[opacity,background-color,color] duration-[120ms]",
            "group-hover:opacity-100 group-focus-within:opacity-100",
            "hover:bg-err-weak hover:text-err",
            "focus-visible:opacity-100",
            "focus-visible:outline-[2px_solid_var(--color-err)] focus-visible:outline-offset-1"
          )}
        >
          <Trash2 size={13} aria-hidden="true" />
        </button>
      </div>
      <div className="flex gap-2 text-[12px] text-ink-3">
        <span>{template.kind}</span>
        <span className="font-mono">· {template.runs} runs</span>
        <span className="ml-auto text-ink-4">
          {formatRelativeTime(template.createdAt)}
        </span>
      </div>
    </div>
  );
}

interface NavLinkProps {
  href: string;
  icon: React.ReactNode;
  label: string;
  count?: number;
  active: boolean;
}

function NavLink({ href, icon, label, count, active }: NavLinkProps) {
  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={cn(
        NAV_ITEM_BASE,
        active ? "bg-accent-weak text-accent-ink" : "bg-transparent text-ink-2"
      )}
    >
      {icon}
      <span>{label}</span>
      {count !== undefined && (
        <span
          className={cn(
            NAV_COUNT_BASE,
            active
              ? "bg-white border-accent-border text-accent-ink"
              : "bg-surface-2 border-line text-ink-3"
          )}
        >
          {count}
        </span>
      )}
    </Link>
  );
}

/** Shimmer placeholders sized to roughly match a real template card. */
function TemplateListSkeleton() {
  return (
    <div
      className="flex flex-col gap-[3px]"
      aria-busy="true"
      aria-label="Loading templates"
    >
      {Array.from({ length: 3 }).map((_, i) => (
        <div key={i} className="py-2.5 px-3 flex flex-col gap-1.5">
          <div className="flex items-center justify-between gap-2">
            <Skeleton width="60%" height={13} />
            <Skeleton width={6} height={6} radius={999} />
          </div>
          <Skeleton width="45%" height={11} />
        </div>
      ))}
    </div>
  );
}

/** Visual-only nav entry for features that don't have a route yet. */
function NavButtonPlaceholder({
  icon,
  label,
  count,
  title,
}: {
  icon: React.ReactNode;
  label: string;
  count?: number;
  title: string;
}) {
  return (
    <button
      type="button"
      className={cn(NAV_ITEM_BASE, "bg-transparent text-ink-2")}
      title={title}
      disabled
    >
      {icon}
      <span>{label}</span>
      {count !== undefined && (
        <span className={cn(NAV_COUNT_BASE, "bg-surface-2 border-line text-ink-3")}>
          {count}
        </span>
      )}
    </button>
  );
}
