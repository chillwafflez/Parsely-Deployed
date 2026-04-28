"use client";

import * as React from "react";
import { Download, FileSearch, History, Info, PenLine, Save, Search, Sparkles } from "lucide-react";
import { Button } from "../ui/button";
import { InspectorField } from "./inspector-field";
import { InspectorTablesSection } from "./inspector-tables-section";
import { InspectorTabularRow } from "./inspector-tabular-row";
import { cn } from "@/lib/cn";
import { groupFields } from "@/lib/field-groups";
import { exportFieldsAsCsv, exportFieldsAsJson } from "@/lib/exporters/field-exporter";
import type { ExtractedField, ExtractedTable, FieldUpdate } from "@/lib/types";
import styles from "./inspector.module.css";

const TABULAR_DATA_TYPE = "Tabular";

/** Header row count excludes the synthesized header — the user thinks in
 *  data rows, not "rows including the labels at the top". */
const dataRowCount = (table: ExtractedTable) => Math.max(0, table.rowCount - 1);

const isTabularField = (field: ExtractedField) =>
  field.dataType === TABULAR_DATA_TYPE;

/**
 * Look up the synth table that corresponds to a Tabular field row. Names
 * are unique within a document (the synthesizer's `[N]` suffix
 * disambiguates), so a name-based match is unambiguous.
 */
function findSynthTableByName(
  tables: ExtractedTable[],
  name: string
): ExtractedTable | null {
  return (
    tables.find((t) => t.source === "Synthesized" && t.name === name) ?? null
  );
}

type Filter = "all" | "issues" | "required";

interface InspectorProps {
  fields: ExtractedField[];
  /** Tables detected by Azure DI; rendered in their own section below the
   *  field groups. Empty array hides the section entirely. */
  tables: ExtractedTable[];
  fileName: string;
  /**
   * Drives the per-model field grouping (Inspector sections) and the type
   * label in the header — resolved against the catalog one level up.
   */
  modelId: string;
  /** Display label for the document type, used in the header copy. */
  typeLabel: string;
  selectedFieldId: string | null;
  onSelectField: (id: string | null) => void;
  /** Which table is currently "active" (highlighted in the list, and in
   *  Phase D, opened in the bottom drawer). Independent of field selection. */
  activeTableId: string | null;
  onSelectTable: (id: string) => void;
  /** Quick-export this table as CSV without opening the drawer. */
  onExportTable: (id: string) => void;
  onUpdateField: (id: string, update: FieldUpdate) => void;
  onDeleteField: (id: string) => void;
  onSaveTemplate: () => void;
  templateName?: string;
}

export function Inspector({
  fields,
  tables,
  fileName,
  modelId,
  typeLabel,
  selectedFieldId,
  onSelectField,
  activeTableId,
  onSelectTable,
  onExportTable,
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

  const grouped = React.useMemo(
    () => groupFields(modelId, visible),
    [modelId, visible]
  );
  const hasAnyVisible = visible.length > 0;

  // Resolve a Tabular field row → its synth table by name. Synth-table names
  // are document-unique (the synthesizer's `[N]` suffix disambiguates), so
  // a Map lookup is unambiguous + O(1).
  const synthTableByName = React.useMemo(() => {
    const map = new Map<string, ExtractedTable>();
    for (const t of tables) {
      if (t.source === "Synthesized" && t.name) map.set(t.name, t);
    }
    return map;
  }, [tables]);

  // Orphan synth tables = synth tables with no matching Tabular field row
  // anywhere in the field set (e.g. nested Accounts[i].Transactions). These
  // surface under the "Records" sub-header. Computed against the FULL field
  // set (not the filtered view) so search/filter doesn't toggle the section.
  const orphanSynthTables = React.useMemo(() => {
    const tabularNames = new Set(
      fields.filter(isTabularField).map((f) => f.name)
    );
    return tables.filter(
      (t) =>
        t.source === "Synthesized" &&
        (t.name === null || !tabularNames.has(t.name))
    );
  }, [fields, tables]);

  const handleExportCsv = React.useCallback(() => {
    exportFieldsAsCsv(fields, fileName);
  }, [fields, fileName]);

  const handleExportJson = React.useCallback(() => {
    exportFieldsAsJson(fields, fileName);
  }, [fields, fileName]);

  return (
    <aside className={styles.pane} aria-label="Extracted fields">
      <header className={styles.header}>
        <div className={styles.titleRow}>
          <h3>Parsed {typeLabel} fields</h3>
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
          <StatusDot tone="err" label={`${stats.lowConf} low confidence`} />
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
              {list.map((f) => {
                if (isTabularField(f)) {
                  const synthTable = synthTableByName.get(f.name) ?? null;
                  return (
                    <InspectorTabularRow
                      key={f.id}
                      label={f.name}
                      tableId={synthTable?.id ?? null}
                      rowCount={synthTable ? dataRowCount(synthTable) : 0}
                      active={
                        synthTable !== null &&
                        synthTable.id === activeTableId
                      }
                      onSelect={onSelectTable}
                    />
                  );
                }
                return (
                  <InspectorField
                    key={f.id}
                    field={f}
                    selected={f.id === selectedFieldId}
                    onSelect={onSelectField}
                    onUpdate={onUpdateField}
                    onDelete={onDeleteField}
                  />
                );
              })}
            </section>
          ))
        )}

        {orphanSynthTables.length > 0 && (
          <RecordsSection
            tables={orphanSynthTables}
            activeTableId={activeTableId}
            onSelectTable={onSelectTable}
          />
        )}

        <InspectorTablesSection
          tables={tables}
          activeTableId={activeTableId}
          onSelectTable={onSelectTable}
          onExportTable={onExportTable}
        />
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
        <div className={styles.exportRow}>
          <span className={styles.exportLabel}>Export fields</span>
          <Button
            onClick={handleExportCsv}
            disabled={fields.length === 0}
            title="Download extracted fields as CSV"
          >
            <Download size={12} />
            CSV
          </Button>
          <Button
            onClick={handleExportJson}
            disabled={fields.length === 0}
            title="Download extracted fields as JSON"
          >
            <Download size={12} />
            JSON
          </Button>
        </div>
        <div className={styles.footerActions}>
          <Button disabled title="Revert lands in Day 7">
            <History size={13} />
            Revert
          </Button>
          <Button
            variant="primary"
            onClick={onSaveTemplate}
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

interface RecordsSectionProps {
  tables: ExtractedTable[];
  activeTableId: string | null;
  onSelectTable: (id: string) => void;
}

/**
 * Phase G "Records" sub-header — surfaces synth tables that have no parent
 * field row (typically nested arrays like Accounts[i].Transactions). Visual
 * twin of the Tables section, intentionally placed above it so the related
 * "structured data" sections cluster together at the bottom of the field list.
 */
function RecordsSection({
  tables,
  activeTableId,
  onSelectTable,
}: RecordsSectionProps) {
  return (
    <section className="border-t border-line">
      <header
        className={cn(
          "flex items-center gap-2",
          "px-3.5 pt-3 pb-1.5",
          "text-[10.5px] font-semibold uppercase tracking-[0.06em]",
          "text-ink-3"
        )}
      >
        <span aria-hidden className="w-1.5 h-1.5 rounded-full bg-table" />
        <span>Records</span>
        <span className="font-mono font-medium text-ink-4 text-[11px]">
          {tables.length}
        </span>
      </header>

      <div className="pb-2">
        {tables.map((table) => (
          <InspectorTabularRow
            key={table.id}
            label={table.name ?? `Table ${table.index + 1}`}
            tableId={table.id}
            rowCount={dataRowCount(table)}
            active={table.id === activeTableId}
            onSelect={onSelectTable}
          />
        ))}
      </div>
    </section>
  );
}
