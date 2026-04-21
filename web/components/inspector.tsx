"use client";

import * as React from "react";
import { FileSearch, History, Info, PenLine, Save, Search, Sparkles } from "lucide-react";
import { Button } from "./button";
import { InspectorField } from "./inspector-field";
import { cn } from "@/lib/cn";
import { groupFields } from "@/lib/field-groups";
import type { ExtractedField, FieldUpdate } from "@/lib/types";
import styles from "./inspector.module.css";

type Filter = "all" | "issues" | "required";

interface InspectorProps {
  fields: ExtractedField[];
  selectedFieldId: string | null;
  onSelectField: (id: string | null) => void;
  onUpdateField: (id: string, update: FieldUpdate) => void;
  onDeleteField: (id: string) => void;
  onSaveTemplate: () => void;
  templateName?: string;
}

export function Inspector({
  fields,
  selectedFieldId,
  onSelectField,
  onUpdateField,
  onDeleteField,
  onSaveTemplate,
  templateName,
}: InspectorProps) {
  const [query, setQuery] = React.useState("");
  const [filter, setFilter] = React.useState<Filter>("all");

  const stats = React.useMemo(() => {
    const issues = fields.filter((f) => f.confidence < 0.9).length;
    const lowConf = fields.filter((f) => f.confidence < 0.7).length;
    const missingRequired = fields.filter((f) => f.isRequired && !f.value).length;
    const verified = fields.length - issues;
    return { verified, issues, lowConf, missingRequired };
  }, [fields]);

  const visible = React.useMemo(() => {
    const q = query.trim().toLowerCase();
    return fields.filter((f) => {
      if (filter === "issues" && f.confidence >= 0.9) return false;
      if (filter === "required" && !f.isRequired) return false;
      if (q) {
        const hay = `${f.name} ${f.value ?? ""}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [fields, filter, query]);

  const grouped = React.useMemo(() => groupFields(visible), [visible]);
  const hasAnyVisible = visible.length > 0;

  return (
    <aside className={styles.pane} aria-label="Extracted fields">
      <header className={styles.header}>
        <div className={styles.titleRow}>
          <h3>Parsed fields</h3>
          {templateName && (
            <span className={styles.template}>
              <Sparkles size={13} />
              <span>
                Template: <b>{templateName}</b>
              </span>
            </span>
          )}
        </div>
        <div className={styles.status}>
          <StatusDot tone="ok" label={`${stats.verified} verified`} />
          <StatusDot tone="warn" label={`${stats.issues - stats.lowConf} review`} />
          <StatusDot tone="err" label={`${stats.lowConf} low-conf`} />
        </div>
        <div className={styles.stats}>
          <Stat n={fields.length} label="Fields" />
          <Stat n={stats.issues} label="To Review" tone={stats.issues > 0 ? "warn" : undefined} />
          <Stat
            n={stats.missingRequired}
            label="Missing Req."
            tone={stats.missingRequired > 0 ? "err" : undefined}
          />
        </div>
      </header>

      <div className={styles.searchRow}>
        <div className={styles.search}>
          <Search size={13} />
          <input
            placeholder="Filter fields…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            aria-label="Filter fields"
          />
        </div>
        <FilterPill active={filter === "all"} onClick={() => setFilter("all")}>
          All
        </FilterPill>
        <FilterPill active={filter === "issues"} onClick={() => setFilter("issues")}>
          Issues
        </FilterPill>
        <FilterPill active={filter === "required"} onClick={() => setFilter("required")}>
          Required
        </FilterPill>
      </div>

      <div className={styles.list}>
        {!hasAnyVisible ? (
          <EmptyState hasFields={fields.length > 0} />
        ) : (
          Array.from(grouped.entries()).map(([group, list]) => (
            <section key={group}>
              <div className={styles.groupHeader}>
                <span>{group}</span>
                <span className={styles.groupCount}>{list.length}</span>
              </div>
              {list.map((f) => (
                <InspectorField
                  key={f.id}
                  field={f}
                  selected={f.id === selectedFieldId}
                  onSelect={onSelectField}
                  onUpdate={onUpdateField}
                  onDelete={onDeleteField}
                />
              ))}
            </section>
          ))
        )}
      </div>

      <footer className={styles.footer}>
        <div className={styles.hint}>
          <Info size={12} />
          <span>
            {stats.issues > 0
              ? `${stats.issues} of ${fields.length} fields need review before saving.`
              : `All ${fields.length} fields look good.`}
          </span>
        </div>
        <div className={styles.footerActions}>
          <Button disabled title="Revert lands in Day 7">
            <History size={13} />
            Revert
          </Button>
          <Button
            variant="primary"
            onClick={onSaveTemplate}
            title="Save as template (coming in Day 6)"
          >
            <Save size={13} />
            Save as template
          </Button>
        </div>
      </footer>
    </aside>
  );
}

function EmptyState({ hasFields }: { hasFields: boolean }) {
  // Two distinct empty cases: "no fields at all" (Azure DI missed everything,
  // user can still recover by drawing one) vs. "filtered to zero" (data
  // exists, just nothing matches the current search/filter).
  if (!hasFields) {
    return (
      <div className={styles.emptyState}>
        <div className={styles.emptyIcon}>
          <PenLine size={22} aria-hidden="true" />
        </div>
        <h4>No fields extracted</h4>
        <p>
          Azure didn&rsquo;t identify any fields on this document. Draw a box
          on the page to add one manually.
        </p>
      </div>
    );
  }

  return (
    <div className={styles.emptyState}>
      <div className={styles.emptyIconMuted}>
        <FileSearch size={22} aria-hidden="true" />
      </div>
      <h4>No matches</h4>
      <p>Try clearing the search or switching to the &ldquo;All&rdquo; filter.</p>
    </div>
  );
}

function StatusDot({ tone, label }: { tone: "ok" | "warn" | "err"; label: string }) {
  return (
    <span className={cn(styles.dotStat, styles[`dotStat_${tone}`])}>
      <span className={styles.dot} />
      {label}
    </span>
  );
}

function Stat({
  n,
  label,
  tone,
}: {
  n: number;
  label: string;
  tone?: "warn" | "err";
}) {
  return (
    <div className={cn(styles.stat, tone && styles[`stat_${tone}`])}>
      <div className={styles.statN}>{n}</div>
      <div className={styles.statL}>{label}</div>
    </div>
  );
}

function FilterPill({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      className={cn(styles.pill, active && styles.pillActive)}
      onClick={onClick}
    >
      {children}
    </button>
  );
}
