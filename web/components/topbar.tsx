import { LayoutTemplate, Settings } from "lucide-react";
import { Button } from "./button";
import styles from "./topbar.module.css";

interface TopbarProps {
  documentName?: string;
  templateName?: string | null;
}

export function Topbar({ documentName, templateName }: TopbarProps) {
  return (
    <header className={styles.topbar}>
      <div className={styles.brand}>
        <div className={styles.mark}>P</div>
        <span>Parser</span>
      </div>
      <nav className={styles.crumbs} aria-label="Breadcrumbs">
        <span className={styles.sep}>/</span>
        <span>Workspace</span>
        <span className={styles.sep}>/</span>
        <span>Documents</span>
        {documentName && (
          <>
            <span className={styles.sep}>/</span>
            <span className={styles.cur}>{documentName}</span>
          </>
        )}
      </nav>
      {templateName && (
        <span
          className={styles.templateBadge}
          title={`Matched template: ${templateName}`}
        >
          <LayoutTemplate size={12} aria-hidden="true" />
          {templateName}
        </span>
      )}
      <div className="flex-1" />
      <span className={styles.env}>local · dev</span>
      <Button variant="ghost" aria-label="Settings">
        <Settings size={16} />
      </Button>
      <div className={styles.avatar} aria-hidden="true">
        JK
      </div>
    </header>
  );
}
