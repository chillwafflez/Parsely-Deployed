"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Files,
  History,
  LayoutTemplate,
  Plus,
  Settings,
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
import styles from "./sidebar.module.css";

interface SidebarProps {
  templates: TemplateSummary[];
  activeTemplateId: string | null;
  onPickTemplate: (id: string) => void;
  templatesLoading: boolean;
  parseCount: number;
  documentsCount?: number;
  queueCount: number;
}

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
    <aside className={styles.sidebar}>
      <div className={styles.nav}>
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
        <NavButtonPlaceholder
          icon={<LayoutTemplate size={17} />}
          label="Templates"
          count={templates.length}
          title="Templates browser — Phase 2"
        />
        <NavButtonPlaceholder
          icon={<Settings size={17} />}
          label="Settings"
          title="Settings — Phase 2"
        />
      </div>

      <div className={styles.section}>
        <span>Templates</span>
        <button
          className={styles.add}
          title="New template (save one from the review screen)"
          aria-label="New template"
          disabled
        >
          <Plus size={13} />
        </button>
      </div>

      <div className={styles.templates}>
        {templatesLoading ? (
          <TemplateListSkeleton />
        ) : templates.length === 0 ? (
          <p className={styles.empty}>No templates yet. Save one after reviewing a parse.</p>
        ) : (
          templates.map((t) => (
            <TemplateCard
              key={t.id}
              template={t}
              active={t.id === activeTemplateId}
              onPick={() => onPickTemplate(t.id)}
              onRequestDelete={() => setPendingDelete(t)}
            />
          ))
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
 * `<button>` without producing invalid HTML.
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
      className={cn(styles.tpl, active && styles.tplActive)}
      role="button"
      tabIndex={0}
      onClick={onPick}
      onKeyDown={handleKey}
    >
      <div className={styles.tplRow}>
        <span className={styles.tplName}>{template.name}</span>
        <button
          type="button"
          className={styles.tplDelete}
          title="Delete template"
          aria-label={`Delete template ${template.name}`}
          onClick={handleDeleteClick}
        >
          <Trash2 size={13} aria-hidden="true" />
        </button>
      </div>
      <div className={styles.tplMeta}>
        <span>{template.kind}</span>
        <span className={styles.mono}>· {template.runs} runs</span>
        <span className={styles.tplTime}>{formatRelativeTime(template.createdAt)}</span>
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
      className={cn(styles.navItem, active && styles.navItemActive)}
      aria-current={active ? "page" : undefined}
    >
      {icon}
      <span>{label}</span>
      {count !== undefined && <span className={styles.count}>{count}</span>}
    </Link>
  );
}

/** Shimmer placeholders sized to roughly match a real template card. */
function TemplateListSkeleton() {
  return (
    <div
      className={styles.templateSkeletonList}
      aria-busy="true"
      aria-label="Loading templates"
    >
      {Array.from({ length: 3 }).map((_, i) => (
        <div key={i} className={styles.templateSkeletonCard}>
          <div className={styles.templateSkeletonRow}>
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
      className={styles.navItem}
      title={title}
      disabled
    >
      {icon}
      <span>{label}</span>
      {count !== undefined && <span className={styles.count}>{count}</span>}
    </button>
  );
}
