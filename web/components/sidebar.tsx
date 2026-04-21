"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Files,
  History,
  LayoutTemplate,
  Plus,
  Settings,
  Upload,
} from "lucide-react";
import type { TemplateSummary } from "@/lib/types";
import { cn } from "@/lib/cn";
import { formatRelativeTime } from "@/lib/format";
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
          // Active on /documents and the /documents/[id] detail view so the
          // user has a clear "you're inside the documents section" signal.
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
          <p className={styles.empty}>Loading templates…</p>
        ) : templates.length === 0 ? (
          <p className={styles.empty}>No templates yet. Save one after reviewing a parse.</p>
        ) : (
          templates.map((t) => (
            <button
              key={t.id}
              type="button"
              className={cn(styles.tpl, t.id === activeTemplateId && styles.tplActive)}
              onClick={() => onPickTemplate(t.id)}
            >
              <div className={styles.tplRow}>
                <span className={styles.tplName}>{t.name}</span>
                <span className={styles.dot} title="active" />
              </div>
              <div className={styles.tplMeta}>
                <span>{t.kind}</span>
                <span className={styles.mono}>· {t.runs} runs</span>
                <span className={styles.tplTime}>{formatRelativeTime(t.createdAt)}</span>
              </div>
            </button>
          ))
        )}
      </div>
    </aside>
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
