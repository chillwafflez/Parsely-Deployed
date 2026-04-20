import { FileText, Files, LayoutTemplate, Plus, Settings } from "lucide-react";
import type { SidebarView, Template } from "@/lib/types";
import { cn } from "@/lib/cn";
import styles from "./sidebar.module.css";

interface SidebarProps {
  view: SidebarView;
  onChangeView: (view: SidebarView) => void;
  templates: Template[];
  activeTemplateId: string | null;
  onPickTemplate: (id: string) => void;
  parseCount: number;
  queueCount: number;
}

export function Sidebar({
  view,
  onChangeView,
  templates,
  activeTemplateId,
  onPickTemplate,
  parseCount,
  queueCount,
}: SidebarProps) {
  return (
    <aside className={styles.sidebar}>
      <div className={styles.nav}>
        <NavItem
          icon={<FileText size={15} />}
          label="Parse"
          count={parseCount}
          active={view === "parse"}
          onClick={() => onChangeView("parse")}
        />
        <NavItem
          icon={<Files size={15} />}
          label="Queue"
          count={queueCount}
          active={view === "queue"}
          onClick={() => onChangeView("queue")}
        />
        <NavItem
          icon={<LayoutTemplate size={15} />}
          label="Templates"
          count={templates.length}
          active={view === "templates"}
          onClick={() => onChangeView("templates")}
        />
        <NavItem
          icon={<Settings size={15} />}
          label="Settings"
          active={view === "settings"}
          onClick={() => onChangeView("settings")}
        />
      </div>

      <div className={styles.section}>
        <span>Templates</span>
        <button className={styles.add} title="New template" aria-label="New template">
          <Plus size={12} />
        </button>
      </div>

      <div className={styles.templates}>
        {templates.length === 0 ? (
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
                <span
                  className={cn(styles.dot, t.status === "draft" && styles.dotDraft)}
                  title={t.status}
                />
              </div>
              <div className={styles.tplMeta}>
                <span>{t.kind}</span>
                <span className={styles.mono}>· {t.runs} runs</span>
                <span className={styles.tplTime}>{t.lastUsed}</span>
              </div>
            </button>
          ))
        )}
      </div>
    </aside>
  );
}

function NavItem({
  icon,
  label,
  count,
  active,
  onClick,
}: {
  icon: React.ReactNode;
  label: string;
  count?: number;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      className={cn(styles.navItem, active && styles.navItemActive)}
      onClick={onClick}
    >
      {icon}
      <span>{label}</span>
      {count !== undefined && <span className={styles.count}>{count}</span>}
    </button>
  );
}
