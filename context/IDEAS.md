# Feature Ideas — Roadmap

> Last updated **2026-04-28** — Phases A–F of #3 shipped; Phase G has a
> locked architecture (below) and is the next thing to build.
> The full architecture / day-by-day history lives in
> `context/PROJECT_CONTEXT.md`. This file is the forward-looking backlog —
> read it first if you're picking up where we left off.

---

## Status snapshot

**Tier 1 — committed for the 2026-05-29 demo:**

| # | Feature | Status |
|---|---|---|
| 1 | Multi-document-type support | ✅ **Shipped** (sub-phases 1A → 1D) |
| 2 | Field validation rules | 🔲 Not started — next up |
| 3 | Table extraction + CSV export | ⚠ **Phases A–F shipped**; Phase G architecture locked, not yet built |
| 4 | AI transformation rules | 🔲 Not started |

**Tier 2 — good but compete for time:**

- 🔲 Refined exports (raw vs clean JSON; Excel via ExcelJS — **not** SheetJS, see Day 13)
- ⚠ Inspector UX improvements — Markus's "side popout / secondary screen" idea is still vague; ask him what he was picturing before building anything

**Tier 3 — deferred past demo:**

- Teams Tab / Message Extension (Tab is ~2-3 days with Teams Toolkit + Entra ID auth, which we don't have yet; Message Extension is ~4-5 days)
- Table-fill via dropped structured text (novel UX; needs paper sketch first)
- Conditional fields ("if entity type = LLC, show EIN")
- Webhook / API output (demos weakly without a real consumer)

---

## Tier 1 — next features in detail

### #2 Field validation rules

**Goal:** flag bad extractions in the Inspector with an inline red marker and
a human-readable reason ("Invalid SSN format", "Date out of range").

**Backend sketch:**

- New columns on `TemplateFieldRule`:
  - `ValidationKind` (string, nullable): `regex` | `email` | `ssn` | `ein` |
    `phone` | `date-range` | `number-range`
  - `ValidationConfigJson` (string, nullable): per-kind config payload
    (e.g., `{"pattern": "^\\d{3}-\\d{2}-\\d{4}$"}` for regex,
    `{"min": "2020-01-01", "max": "2030-12-31"}` for date-range)
- Single additive EF migration. No data loss.
- New service `ValidationService` runs validators against extracted field
  values. Returns `(isValid: bool, reason: string?)`.
- Wire into `DocumentsController.Upload` (after `ApplyTemplateRules`) and
  `DocumentsController.UpdateField` (so manual edits get re-validated).
- Persist validation result on `ExtractedField` as a transient `ValidationError`
  string column (or compute on read — likely cheaper than another column for
  prototype).

**Frontend sketch:**

- New section in the template edit page: "Validation" sub-panel per rule
  with a kind selector + config inputs.
- `ExtractedField` view-model gets a `validationError: string | null` field;
  `InspectorField` renders a small `AlertTriangle` icon + tooltip when set.
- Counter in the Inspector header: existing "To Review / Missing Req." stats
  could grow to include "Invalid".

**Why ship this:** small surface, high demo punch. Tax/mortgage forms have
well-known validation shapes (SSN, EIN, date ranges). Pairs with #1 nicely.

**Estimated effort:** ~1 day.

---

### #3 Table extraction + CSV export

**Status (2026-04-28):** Phases A–F shipped and committed. Phase G ("synthesize
tables from `Array<Dictionary>` structured fields to cover bank statements")
was implemented in this session, smoke-tested, and **reverted by the user**
because the synthesized-as-tables approach was the wrong abstraction — see
"Why Phase G was reverted" below. A new Phase G architecture is locked and
is the next thing to build.

> **Note for the next session:** before doing anything else, run
> `git status` + `git log --oneline` to confirm the working tree reflects
> only Phases A–F. The previous CSV/JSON export commit
> (`feat(web): editable table cells + CSV/JSON export`, hash `cf571c6`)
> should be the most recent table-related commit. If `Add_ExtractedTable_Name`
> migration or `TableSynthesizer.cs` / `RegionGeometry.cs` files are still
> present, the revert is incomplete.

#### Phases A–F — what shipped (chronology in PROJECT_CONTEXT.md)

End-to-end table extraction for any prebuilt model that populates
`result.Tables` natively (invoice, receipt, layout). High-level outline:

- **A** — Backend extraction + persistence. New `ExtractedTable` entity,
  additive EF migration, `result.Tables` mapped via `DocumentIntelligenceService.AnalyzeAsync`,
  surfaced through `DocumentResponse.Tables`. Cells stored denormalised in
  `CellsJson` (read-modify-write at prototype scale).
- **B** — `PATCH /api/documents/{id}/tables/{tableId}/cells` for cell edits.
  Range-validates `(rowIndex, columnIndex)`, no-op early-return when content
  is unchanged, returns the updated `TableCellResponse`.
- **C** — Discriminated `Selection` union (`field | tableCell`) in
  `web/lib/selection.ts`. Inspector "Tables" section + row component using
  a dedicated `--color-table-*` palette (oklch hue 55, distinct from `warn`).
- **D** — Bottom drawer (`components/document/table-drawer.tsx`) with
  WAI-ARIA Window Splitter resize handle (full keyboard control, height
  persisted to `localStorage`), tab strip per table, read-only `TableGrid`.
  `BoundingBoxOverlay` extended with `TableOutline` (active-table region) +
  `CellHighlight` (selected cell), both `pointer-events-none` so field
  clicks underneath still work.
- **E** — Inline cell editing via the shared `useInlineEdit` hook.
  Optimistic update + rollback in `ReviewStage.handleUpdateCell`,
  mirroring the field-edit pattern. Empty-string commits as `null`.
- **F** — `web/lib/exporters/table-exporter.ts` with RFC 4180 CSV +
  friendly JSON. Merged cells expand by repeating content across spanned
  positions. Wired in the drawer toolbar (CSV + JSON) and as an Inspector
  hover-revealed CSV quick-export per row.

The tables UI works correctly today on any document where Azure DI returns
a non-empty `result.Tables`. **Bank statements are the gap** —
`prebuilt-bankStatement.us` doesn't populate `result.Tables` at all (its
tabular data lives entirely under `Documents[0].Fields["Accounts"][i].Transactions`),
so the "Tables" section is empty after a bank-statement upload. Closing
that gap is what Phase G is for.

**Excel still deferred:** CSV-only for V1. If/when Excel is added, use
**ExcelJS** (MIT, ~1 MB, lazy-imported). **Do not use SheetJS** — it
switched to SSPL at v0.18.5, legally murky for commercial SaaS (see
PROJECT_CONTEXT.md §13 / Day 13 Part A).

#### Why Phase G was reverted

The first Phase G attempt synthesized `TableExtraction`s from
`Array<Dictionary>` structured fields (invoice `Items`, paystub
`EarningsDetails`, bank-statement `Accounts[i].Transactions`, etc.) and
surfaced them in the same Inspector "Tables" section as
layout-detected tables. A 50% area-overlap dedupe dropped layout tables
that geometrically matched a synthesized one ("prefer Channel 2 when
present"). Real-world testing on a bank statement and the same PDF run
under the invoice model revealed two fundamental problems:

1. **Field bboxes are scattered across the page.** Bank statement
   `Accounts[i]` holds scalar fields like `AccountHolderName` (top-left),
   `EndingBalance` (bottom-right), `BankAddress` (side block), etc. The
   per-cell bbox union produces a giant rectangle covering most of the
   header — visually dishonest, since "Accounts" isn't a visual table on
   the document.
2. **Structured extraction is partial / interpretive.** On the user's
   bank statement (29 transaction rows, 5 columns including Balance),
   the model emitted `Transactions[]` for the 8 fully-typed rows only —
   skipping 21 balance-only carry-forwards. The same PDF analysed
   separately with `prebuilt-layout` produced a `result.Tables` entry
   with all 29 rows and all 5 columns. The invoice model on the same
   PDF showed the same partial-extraction pattern (`Items` with 8 rows,
   3 columns) — but its underlying layout substrate also produced the
   full 29-row table, visible in DI Studio's Content tab.

Conclusion: `Array<Dictionary>` data is the **model's structured
interpretation**, not the document's visual table structure. Layout's
`result.Tables` is the visual structure. They serve different purposes
and should be surfaced in **different parts of the UI**.

#### Phase G — locked architecture (decided 2026-04-28)

Two table sources, two surfaces.

| Surface | Source | Contents |
|---|---|---|
| Inspector "Tables" section | `result.Tables` (Channel 1) | Visual tables. Run `prebuilt-layout` as a fallback when the chosen model returns zero. |
| Inspector field row (with tabular badge) | Synthesized from `Array<Dictionary>` (Channel 2) | Model's structured interpretation. Click → opens the same bottom drawer the layout tables use. |
| Bottom-drawer tab strip | Both | Tabs include layout tables AND tabular records; user navigates freely. |

**Locked decisions** (from the design discussion at end of the session):

1. **Layout-fallback trigger:** when `result.Tables.Count == 0` AND
   `modelId != "prebuilt-layout"`, make a second `AnalyzeAsync` call with
   `prebuilt-layout` and merge its tables in. Skip when invoice/receipt
   etc. already include layout natively (their `result.Tables` is
   non-empty). Cost: ~+1s + ~+50% Azure DI per upload on the models that
   need fallback (currently bank statement, possibly W-2 / paystub —
   confirm empirically). Trade-off explicitly chosen.
2. **Tabular field row UI:** small `Table` icon + `{field name}` + count
   badge (e.g., "12 records") + chevron. Click opens the drawer to that
   table. **Not inline-editable** — the data lives in the synth-table
   cells; editing happens in the drawer.
3. **No Channel 1 ↔ 2 dedupe.** Now that the two sources have different
   homes, they coexist intentionally. An invoice will show layout's Items
   table in "Tables" AND a synth `Items` row in the field section.
4. **`BoundingBoxOverlay.TableOutline` only renders for `Source = "Layout"`.**
   Synth tables don't have meaningful overall regions (the bbox union is
   misleading, see "Why reverted" above). Individual cell-highlight
   bboxes still render correctly for both sources because those come from
   the underlying field's own `BoundingRegions`.

**Backend changes**

| File | Change |
|---|---|
| `api/Models/ExtractedTable.cs` | Add `Source` (string, `"Layout"` \| `"Synthesized"`). Probably also re-add `Name` (it was useful for synth tables in v1 and is still useful here). |
| `api/Data/AppDbContext.cs` | Configure `Source` (HasMaxLength 32, IsRequired, default `"Layout"`); configure `Name` (HasMaxLength 512, nullable). |
| `api/Migrations/<ts>_Add_ExtractedTable_Source_And_Name.cs` | Single additive migration covering both columns. Defaults `Source = "Layout"` for any pre-existing rows. |
| `api/Contracts/TableResponse.cs` | Add `Source` and `Name` to record + `FromEntity`. |
| `api/Services/IDocumentIntelligenceService.cs` | Add `Source` and `Name` to `TableExtraction` record. |
| `api/Services/DocumentIntelligenceService.cs` | (a) Tag layout tables with `Source = "Layout"`. (b) After mapping the chosen-model call, if `result.Tables.Count == 0` AND `modelId != "prebuilt-layout"`, make a second `AnalyzeAsync(modelId: "prebuilt-layout")` call against the same buffered stream and merge its tables in (also tagged Layout). (c) Synthesizer emits `Source = "Synthesized"`. (d) **Drop the `RegionGeometry` overlap-dedupe entirely** — both sources now coexist. |
| `api/Services/TableSynthesizer.cs` | Re-create from `git log` of the reverted commit. The recursion + flat-name + collision-`[N]`-suffix algorithm is correct; only the channel routing was wrong. Just emit `Source = "Synthesized"` on each table. |
| `api/Services/RegionGeometry.cs` | Not needed for Phase G v2 (no dedupe). Either skip re-creation or keep for future use. |
| `api/Services/DocumentIntelligenceService.cs` `EmitFields` | **Behavior change vs. reverted v1:** instead of suppressing `Array<Dictionary>` entirely, emit a "tabular" placeholder field row whose value summarises the array (`"{N} records"`) and whose data type signals the frontend to render the tabular variant. Recommended: set `DataType = "Tabular"` (already a string, no schema change) — the frontend matches on this. |
| `api/Controllers/DocumentsController.cs` | Persist `Source = t.Source` and `Name = t.Name` when adding `ExtractedTable`. Buffer the upload stream once and reset its position before each `AnalyzeAsync` call (existing buffer-once pattern from Day 14 Phase 1; the second layout call is the second consumer). |

**Frontend changes**

| File | Change |
|---|---|
| `web/lib/types.ts` | `ExtractedTable.source: "Layout" \| "Synthesized"`; `ExtractedTable.name: string \| null`. No `ExtractedField` shape change if backend uses `DataType = "Tabular"` as the discriminator. |
| `web/components/inspector/inspector.tsx` | Pass through. |
| `web/components/inspector/inspector-tables-section.tsx` | Filter incoming `tables` to `source === "Layout"` only. Empty-state when none (rare after layout fallback, but possible on a document that genuinely has no visual tables). |
| `web/components/inspector/inspector-tabular-row.tsx` *(new)* — or extend `InspectorField` with a tabular branch | Renders the tabular field row: small `Table` icon + name + "{N} records" + chevron. Click resolves the corresponding synth table by name and calls `onSelectTable(table.id)`. Inline-edit disabled. |
| `web/components/document/table-drawer.tsx` | Tab strip continues to accept all tables. Optional visual differentiation between Layout and Synthesized tabs (different icon color or a subtle "structured" badge on synth tabs). |
| `web/components/document/bounding-box-overlay.tsx` | `TableOutline` skips when `activeTable.source === "Synthesized"`. `CellHighlight` keeps working for both. |

**Tabular row → drawer linkage:** match top-level synth tables to their
parent field by name (`field.name === table.name`). The synthesizer's
disambiguation suffix (`[1]`, `[2]`, …) makes names unique within a
document, so the match is unambiguous.

**Open question for next session — nested synth tables:** bank-statement
`Accounts[i].Transactions` becomes a synth table named `"Transactions"`
(or `"Transactions [1]"` / `"Transactions [2]"` for multi-account
statements). There's no top-level `Transactions` field for it to attach
to as a tabular row. Two reasonable options:

- (a) Surface them as their own tabular field rows under a "Records"
  sub-header in the field section. The "field name" of the row is the
  synth table's `name`. **Friendlier; lean toward this.**
- (b) Surface them only via the drawer tab strip (the user opens the
  drawer for the layout `Transactions` table, then can switch tabs to
  the synth one). Simpler; harder to discover.

User to confirm before implementation. Don't ship without picking one.

#### Phase G — verification matrix

When implementing, smoke-test against real samples:

- **Invoice** (`samples/sample-invoice.pdf`) — should show: layout's
  Items table in "Tables" section, plus a synth `Items` tabular row in
  the field section. Both editable via the drawer.
- **Bank statement** (the user's example PDF) — layout fallback fires
  (chosen model returned empty `result.Tables`); the layout call should
  produce a `Tables` entry covering the **full** 29-row, 5-column
  transaction table including the Balance column. Synth `Accounts` and
  `Transactions` rows surface in the field section as tabular rows.
- **Receipt / W-2 / paystub** — confirm `result.Tables` is non-empty
  (no fallback fires). Synth rows for any `Array<Dictionary>` fields
  surface in the field section. If W-2 or paystub turn out to also have
  empty `result.Tables` empirically, the fallback handles them
  automatically.

#### Phase G — estimated effort

~half-day backend + ~half-day frontend = **~1 day total**. The
synthesizer algorithm, the migration shape, and the frontend grid /
drawer / overlay code are all already designed (and most exist in the
reverted commit's history).

---

### #3.1 Additional Table Extraction features
**Goal:** In addition to extracting tables from documents, allow the user to draw
bounding boxes to extract future tables (for the template feature). Another nice
quality-of-life feature could be to allow the user to highlight a column of a table
to apply automatic calculations (e.g. "sum all values in this column and output to a 
field called 'Balance Sum,'" or "get average of values in this column", etc.). 

**Frontend sketch:**
- Will need to thoroughly plan out the UI for these table features so that 
the page will not feel cluttered or unintuitive
---


### #4 AI-assisted transformation rules

**Goal:** user types a natural-language transformation ("add '+1' to every
email", "normalize phone numbers to E.164") → LLM converts to a
regex+replacement → applied on every future parse for that field.

**Backend sketch:**

- Add `TransformDescription` (string, ≤200 chars) and `TransformPattern` /
  `TransformReplacement` to `TemplateFieldRule`. Migration: additive.
- New endpoint `POST /api/voice/transform` (or rename to `POST /api/llm/...`
  since it's no longer voice-specific) — takes `{description, sampleValue}`,
  returns `{pattern, replacement, previewValue}`. Reuses the **existing
  OpenAI SDK plumbing** from Voice-Fill (`OpenAIClient`, `gpt-4o-mini`,
  strict JSON schema output).
- ⚠ User uses **OpenAI direct** (their own dev-portal API key), not Azure
  OpenAI — the existing `OpenAIOptions` is already pointed there.
- `ApplyTemplateRules` runs the transform after extracting the value: if
  `TransformPattern` is set, `value = Regex.Replace(value, pattern,
  replacement)`.

**Frontend sketch:**

- In the template rule row (edit page), add a "Transform" expandable section
  alongside the existing voice hint / aliases.
- User types description → debounced call to backend → preview
  before/after side-by-side → Save commits pattern+replacement.
- Optional: skip the LLM and let the user paste a regex directly (advanced
  mode toggle).

**Why ship this:** best AI-flavored demo moment of the remaining items.
"Watch — I tell it 'capitalize every vendor name' and it just works."

**Estimated effort:** ~2 days.

---

### #5 Aggregations / Combining Fields

**Goal:** allow users to combine fields. This could be custom fields or functions
for example, a document could have a first name and last name field, but we want
both those names to be concatenated together. We could have a custom field/function
that combines that and adds a space between them.

**Backend sketch:**

- Add `TransformDescription` (string, ≤200 chars) and `TransformPattern` /
  `TransformReplacement` to `TemplateFieldRule`. Migration: additive.
- New endpoint `POST /api/voice/transform` (or rename to `POST /api/llm/...`
  since it's no longer voice-specific) — takes `{description, sampleValue}`,
  returns `{pattern, replacement, previewValue}`. Reuses the **existing
  OpenAI SDK plumbing** from Voice-Fill (`OpenAIClient`, `gpt-4o-mini`,
  strict JSON schema output).
- ⚠ User uses **OpenAI direct** (their own dev-portal API key), not Azure
  OpenAI — the existing `OpenAIOptions` is already pointed there.
- `ApplyTemplateRules` runs the transform after extracting the value: if
  `TransformPattern` is set, `value = Regex.Replace(value, pattern,
  replacement)`.

**Frontend sketch:**

- In the template rule row (edit page), add a "Transform" expandable section
  alongside the existing voice hint / aliases.
- User types description → debounced call to backend → preview
  before/after side-by-side → Save commits pattern+replacement.
- Optional: skip the LLM and let the user paste a regex directly (advanced
  mode toggle).

**Why ship this:** best AI-flavored demo moment of the remaining items.
"Watch — I tell it 'capitalize every vendor name' and it just works."

**Estimated effort:** ~2 days.

---

## Follow-ups from #1 (multi-document-type)

Items deferred or open after the feature shipped — small, easy to fold into
later sub-phases or polish passes.

- **Verify identifier field paths** for Pay Stub and Bank Statement against
  real samples. Catalog entries (`api/Catalog/DocumentTypeCatalog.cs`) have
  TODO comments. Currently:
  - `prebuilt-paystub` → `EmployerName` (best guess, unverified)
  - `prebuilt-bankStatement.us` → `AccountHolderName` (best guess, unverified)
  - If wrong, matching will silently never fire for that type.
- **Refine field groupings** for paystub and bank statement after a real
  parse shows what fields actually come back. The groupings in
  `web/lib/field-groups.ts` were sketched from public schema docs, not from
  real output.
- **Sample documents** for receipt + paystub. The user has invoice, W-2,
  bank statement samples. Microsoft hosts public ones at
  `Azure-Samples/cognitive-services-REST-api-samples`.
- **Per-model icons** in sidebar template cards + documents list. Skipped
  from 1D as polish; subjective design choice. Suggested mapping:
  - Invoice → `FileText`
  - Receipt → `Receipt`
  - W-2 → `BadgeDollarSign`
  - Pay Stub → `Wallet`
  - Bank Statement → `Landmark`
- **Documents-list type column** — same logic as icons; topbar already covers
  it for the active doc, so this is decoration.
- **Auto-classify document type** — currently a manual picker (Azure DI
  doesn't ship a free out-of-the-box classifier). Two future options:
  1. Train a custom Azure DI classifier on a few samples per type.
  2. Use OpenAI on `prebuilt-read` extracted text to pick the model — easy
     but adds ~1s latency per upload.

---

## Open questions for the user

- **`LastUsedAt` on templates** — sidebar currently caps "top 6 recent" by
  `CreatedAt`. As the template library grows, heavily-used older templates
  fall off. Migration is cheap (one nullable column + a write in
  `TemplateFillLoader`); decision was deferred in PROJECT_CONTEXT.md §6.
- **Mortgage 1003 / 1099 / 1098 support** — Azure DI prebuilts exist;
  adding them is one catalog entry + one grouping definition each. Check
  with Markus / demo audience whether any of these are wanted before the
  demo. ~30 minutes per added type.
- **Production seed documents** — PROJECT_CONTEXT.md §6 item 2 still
  outstanding. The cross-vendor template-matching story lands better with
  at least one vendor appearing twice in seed data.

---

## Original idea capture (preserved for reference)

The brainstorm that drove this roadmap, captured during the project review
with Markus on ~2026-04-26.

### My ideas (Joey)
- Support for other types of documents like tax forms, bank statements,
  pay stubs, mortgage forms, etc. → **Tier 1 #1, shipped**
- Extract table data → **Tier 1 #3, planned**

### Markus's ideas
- Improve the schema aspect:
  - Side popout / secondary screen for easy data manipulation
    → **Tier 2, vague — needs Markus follow-up before building**
  - AI-applied regex transformations on fields → **Tier 1 #4, planned**
- Refine exports:
  - Easy mode for regular users → **Tier 2**
  - In-depth JSON for technical users → **Tier 2**
- Teams Tab app or Message Extension → **Tier 3**
- Additional table support:
  - Tables → Excel/tabular data → **Tier 1 #3 (CSV first), Excel deferred**
  - Drop structured text to autofill table on PDF → **Tier 3 (novel UX)**
  - Drag-drop picture of table → CSV/Excel → **Folds into Tier 1 #3**

### Claude's ideas
- Conditional fields (show/require based on another field's value)
  → **Tier 3**
- Field validation rules (regex / date range / numeric range)
  → **Tier 1 #2, planned — small surface, high demo value**
- Webhook / API output for downstream integration → **Tier 3**
