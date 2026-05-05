"use client";

import * as React from "react";
import {
  Download,
  FileSearch,
  History,
  Info,
  PenLine,
  Save,
  Search,
  Sigma,
  Sparkles,
  Square,
  Table as TableIcon,
} from "lucide-react";
import { Button } from "../ui/button";
import { InspectorField } from "./inspector-field";
import { InspectorGroup } from "./inspector-group";
import { InspectorOrphanTableRow } from "./inspector-orphan-table-row";
import { InspectorTabularFieldRow } from "./inspector-tabular-field-row";
import { cn } from "@/lib/cn";
import {
  groupFields,
  USER_ADDED_AGG_GROUP,
  USER_ADDED_GROUP,
} from "@/lib/field-groups";
import { exportFieldsAsCsv, exportFieldsAsJson } from "@/lib/exporters/field-exporter";
import type { ExtractedField, ExtractedTable, FieldUpdate } from "@/lib/types";

const TABULAR_DATA_TYPE = "Tabular";

/** Header row count excludes the synthesized header — the user thinks in
 *  data rows, not "rows including the labels at the top". */
const dataRowCount = (table: ExtractedTable) => Math.max(0, table.rowCount - 1);

const isTabularField = (field: ExtractedField) =>
  field.dataType === TABULAR_DATA_TYPE;

type Filter = "all" | "issues" | "required";

interface InspectorProps {
  fields: ExtractedField[];
  /** Tables detected by Azure DI; rendered as collapsible groups below the
   *  field groups. Empty array hides those groups entirely. */
  tables: ExtractedTable[];
  fileName: string;
  /** Drives per-model field grouping and the type label in the header. */
  modelId: string;
  typeLabel: string;
  selectedFieldId: string | null;
  onSelectField: (id: string | null) => void;
  /** Which table is currently "active" (highlighted in the list and opened in
   *  the bottom drawer). Independent of field selection. */
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
    const lowConf = fields.filter((f) => f.confidence < 0.7).length;
    const review = fields.filter(
      (f) => f.confidence >= 0.7 && f.confidence < 0.9
    ).length;
    const verified = fields.filter((f) => f.confidence >= 0.9).length;
    const issues = fields.filter((f) => f.confidence < 0.9).length;
    const missingRequired = fields.filter((f) => f.isRequired && !f.value).length;
    return { verified, review, lowConf, issues, missingRequired };
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
  // (e.g., nested Accounts[i].Transactions). Computed against the FULL field
  // set — search/filter shouldn't toggle the section.
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

  // Visual tables only — synthesized tables surface as Tabular field rows or
  // under "Records". V2 design folds the layout-tables list into its own
  // collapsible group below the field groups.
  const layoutTables = React.useMemo(
    () => tables.filter((t) => t.source === "Layout"),
    [tables]
  );

  const handleExportCsv = React.useCallback(() => {
    exportFieldsAsCsv(fields, fileName);
  }, [fields, fileName]);

  const handleExportJson = React.useCallback(() => {
    exportFieldsAsJson(fields, fileName);
  }, [fields, fileName]);

  return (
    <aside
      className="w-[400px] shrink-0 bg-surface border-l border-line flex flex-col min-h-0"
      aria-label="Extracted fields"
    >
      <header className="px-3.5 pt-3 pb-2.5 border-b border-line">
        <div className="flex items-center justify-between gap-2">
          <h3 className="text-[14px] font-semibold m-0">
            Parsed {typeLabel} fields
          </h3>
          {templateName && (
            <span className="flex items-center gap-1.5 text-[11.5px] text-ink-3">
              <Sparkles size={13} className="text-accent-ink" />
              <span>
                Template: <b className="text-ink font-semibold">{templateName}</b>
              </span>
            </span>
          )}
        </div>
        <div className="mt-1.5 flex gap-2.5 text-[11.5px] text-ink-3">
          <StatusDot tone="ok" label={`${stats.verified} verified`} />
          <StatusDot tone="warn" label={`${stats.review} review`} />
          <StatusDot tone="err" label={`${stats.lowConf} low confidence`} />
        </div>
        <div className="mt-2.5 grid grid-cols-3 gap-1.5">
          <Stat n={fields.length} label="Fields" />
          <Stat
            n={stats.issues}
            label="To Review"
            tone={stats.issues > 0 ? "warn" : undefined}
          />
          <Stat
            n={stats.missingRequired}
            label="Missing Req."
            tone={stats.missingRequired > 0 ? "err" : undefined}
          />
        </div>
      </header>

      <div className="px-3 py-2 border-b border-line flex items-center gap-1.5 flex-wrap">
        <div className="flex-1 min-w-[160px] flex items-center gap-1.5 h-7 px-2.5 border border-line rounded-md bg-surface-2 text-ink-4">
          <Search size={13} />
          <input
            placeholder="Filter fields…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            aria-label="Filter fields"
            className="flex-1 min-w-0 border-0 outline-none bg-transparent font-ui text-ink placeholder:text-ink-4"
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

      <div className="flex-1 overflow-auto">
        {!hasAnyVisible &&
        orphanSynthTables.length === 0 &&
        layoutTables.length === 0 ? (
          <EmptyState hasFields={fields.length > 0} />
        ) : (
          <>
            {Array.from(grouped.entries()).map(([group, list]) => (
              <InspectorGroup
                key={group}
                title={group}
                count={list.length}
                icon={
                  group === USER_ADDED_AGG_GROUP ? (
                    <Sigma size={13} className="text-agg" aria-hidden />
                  ) : group === USER_ADDED_GROUP ? (
                    <Square size={13} className="text-custom-ink" aria-hidden />
                  ) : undefined
                }
              >
                {list.map((f) => {
                  if (isTabularField(f)) {
                    const synthTable = synthTableByName.get(f.name) ?? null;
                    return (
                      <InspectorTabularFieldRow
                        key={f.id}
                        field={f}
                        tableId={synthTable?.id ?? null}
                        rowCount={synthTable ? dataRowCount(synthTable) : 0}
                        active={
                          synthTable !== null &&
                          synthTable.id === activeTableId
                        }
                        onSelect={onSelectTable}
                        onUpdate={onUpdateField}
                        onDelete={onDeleteField}
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
              </InspectorGroup>
            ))}

            {orphanSynthTables.length > 0 && (
              <InspectorGroup
                title="Records"
                count={orphanSynthTables.length}
                icon={<TableIcon size={13} className="text-table-ink" aria-hidden />}
              >
                {orphanSynthTables.map((table) => (
                  <InspectorOrphanTableRow
                    key={table.id}
                    label={table.name ?? `Table ${table.index + 1}`}
                    tableId={table.id}
                    rowCount={dataRowCount(table)}
                    active={table.id === activeTableId}
                    onSelect={onSelectTable}
                  />
                ))}
              </InspectorGroup>
            )}

            {layoutTables.length > 0 && (
              <InspectorGroup
                title="Tables"
                count={layoutTables.length}
                icon={<TableIcon size={13} className="text-table-ink" aria-hidden />}
              >
                {layoutTables.map((table) => (
                  <LayoutTableRow
                    key={table.id}
                    table={table}
                    active={table.id === activeTableId}
                    onSelect={onSelectTable}
                    onExport={onExportTable}
                  />
                ))}
              </InspectorGroup>
            )}
          </>
        )}
      </div>

      <footer className="px-3.5 py-3 border-t border-line bg-surface-2 flex flex-col gap-2">
        <div className="flex items-center gap-1.5 text-[11.5px] text-ink-3">
          <Info size={12} />
          <span>
            {stats.issues > 0
              ? `${stats.issues} of ${fields.length} fields need review before saving.`
              : `All ${fields.length} fields look good.`}
          </span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="flex-1 text-[11.5px] text-ink-3">Export fields</span>
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
        <div className="flex gap-2 [&>button]:flex-1 [&>button]:justify-center">
          <Button disabled title="Revert lands in Phase 2">
            <History size={13} />
            Revert
          </Button>
          <Button variant="primary" onClick={onSaveTemplate}>
            <Save size={13} />
            Save as template
          </Button>
        </div>
      </footer>
    </aside>
  );
}

interface LayoutTableRowProps {
  table: ExtractedTable;
  active: boolean;
  onSelect: (id: string) => void;
  onExport: (id: string) => void;
}

/** Layout-detected table card. Sibling of <InspectorOrphanTableRow/> but
 *  with page/dimension meta and a hover-revealed CSV download. */
function LayoutTableRow({ table, active, onSelect, onExport }: LayoutTableRowProps) {
  const label = `Table ${table.index + 1}`;
  const meta = `pg ${table.pageNumber} · ${table.rowCount}×${table.columnCount}`;

  const handleKey = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      onSelect(table.id);
    }
  };

  return (
    <div
      role="button"
      tabIndex={0}
      aria-pressed={active}
      onClick={() => onSelect(table.id)}
      onKeyDown={handleKey}
      className={cn(
        "group/row flex items-center gap-2.5",
        "px-2.5 py-2 rounded-md cursor-pointer",
        "border transition-colors",
        "focus-visible:outline-[2px_solid_var(--color-accent)] focus-visible:outline-offset-2",
        active
          ? "bg-table-weak border-table-border"
          : "bg-surface border-line hover:bg-surface-2 hover:border-line-strong"
      )}
    >
      <div
        aria-hidden
        className={cn(
          "w-7 h-7 rounded-md grid place-items-center text-table-ink shrink-0",
          active ? "bg-surface" : "bg-table-weak"
        )}
      >
        <TableIcon size={14} />
      </div>
      <div className="min-w-0 flex-1">
        <div className="text-[12px] font-medium text-ink truncate">{label}</div>
        <div className="text-[10.5px] text-ink-3 mt-px font-mono">{meta}</div>
      </div>
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          onExport(table.id);
        }}
        title="Export this table as CSV"
        aria-label={`Export ${label} as CSV`}
        className={cn(
          "w-6 h-6 grid place-items-center rounded text-ink-3 shrink-0",
          "opacity-0 group-hover/row:opacity-100 group-focus-within/row:opacity-100",
          "transition-opacity",
          "hover:bg-surface hover:text-ink",
          "focus-visible:opacity-100 focus-visible:outline-[2px_solid_var(--color-accent)]"
        )}
      >
        <Download size={12} />
      </button>
    </div>
  );
}

function EmptyState({ hasFields }: { hasFields: boolean }) {
  // Two distinct cases: "no fields at all" (Azure missed everything; user can
  // still recover by drawing one) vs. "filtered to zero".
  if (!hasFields) {
    return (
      <div className="px-5 py-9 flex flex-col items-center text-center gap-2.5">
        <div className="w-11 h-11 grid place-items-center rounded-[10px] bg-accent-weak border border-accent-border text-accent-ink">
          <PenLine size={22} aria-hidden="true" />
        </div>
        <h4 className="text-[14px] font-semibold text-ink m-0 mt-1 tracking-[-0.01em]">
          No fields extracted
        </h4>
        <p className="m-0 max-w-[280px] text-ink-3 text-[12.5px] leading-[1.5]">
          Azure didn&rsquo;t identify any fields on this document. Draw a box on
          the page to add one manually.
        </p>
      </div>
    );
  }

  return (
    <div className="px-5 py-9 flex flex-col items-center text-center gap-2.5">
      <div className="w-11 h-11 grid place-items-center rounded-[10px] bg-surface-2 border border-line text-ink-3">
        <FileSearch size={22} aria-hidden="true" />
      </div>
      <h4 className="text-[14px] font-semibold text-ink m-0 mt-1 tracking-[-0.01em]">
        No matches
      </h4>
      <p className="m-0 max-w-[280px] text-ink-3 text-[12.5px] leading-[1.5]">
        Try clearing the search or switching to the &ldquo;All&rdquo; filter.
      </p>
    </div>
  );
}

function StatusDot({ tone, label }: { tone: "ok" | "warn" | "err"; label: string }) {
  const dotClass =
    tone === "ok" ? "bg-ok" : tone === "warn" ? "bg-warn" : "bg-err";
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className={cn("w-2 h-2 rounded-full", dotClass)} />
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
  const numTone =
    tone === "warn" ? "text-warn" : tone === "err" ? "text-err" : "text-ink";
  return (
    <div className="bg-surface-2 border border-line rounded-md px-2 py-1.5">
      <div className={cn("font-mono text-[16px] font-semibold leading-none", numTone)}>
        {n}
      </div>
      <div className="text-[10.5px] text-ink-3 tracking-[0.04em] uppercase mt-0.5">
        {label}
      </div>
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
      onClick={onClick}
      className={cn(
        "px-2.5 py-[3px] rounded-full border text-[11px] cursor-pointer",
        active
          ? "bg-accent-weak text-accent-ink border-accent-border"
          : "bg-surface-2 text-ink-3 border-line hover:border-line-strong"
      )}
    >
      {children}
    </button>
  );
}
