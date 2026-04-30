# Feature Ideas — Roadmap

> Last updated **2026-04-28** — Phase G of #3 shipped: synthesised tables
> from `List<Dictionary>` structured fields, conditional-parallel layout
> fallback, per-row outlines with per-cell fallback, named drawer tabs.
> **#3.1** (draw-to-add tables for templates + column aggregations) is the
> next thing to build — see the expanded §3.1 below for backend / frontend
> sketches and recommended order.
>
> The full architecture / day-by-day history lives in
> `context/PROJECT_CONTEXT.md` — note that file is stale on Phase G and
> needs a refresh next session (no Day 16 entry yet for Phase G work).
> This file is the forward-looking backlog — read it first if you're
> picking up where we left off.

---

## Status snapshot

**Tier 1 — committed for the 2026-05-29 demo:**

| # | Feature | Status |
|---|---|---|
| 1 | Multi-document-type support | ✅ **Shipped** (sub-phases 1A → 1D) |
| 2 | Field validation rules | 🔲 Not started |
| 3 | Table extraction + CSV export | ✅ **Phases A–G shipped** — #3.1 follow-ups still open (next up) |
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

**Status (2026-04-28):** ✅ **Phases A–G shipped and committed.** Two
commits at end of session: `feat(api): synthesize tables from
List<Dictionary> structured fields (Phase G)` covers backend (schema
migration, TableSynthesizer, conditional-parallel layout fallback,
EmitFields tabular emission, AzureFieldMapping helper, TableSources
constants); `feat(web): tabular field rows + Records section + per-row
synth outlines` covers frontend (types, InspectorTabularRow,
RecordsSection, BoundingBoxOverlay synth-region rendering, named drawer
tabs).

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

#### Phase G — shipped (2026-04-28)

Two table channels, two surfaces — exactly as the locked architecture
called for, plus per-row outlines (with per-cell fallback) and named
drawer tabs added in a refinement pass after smoke-testing.

| Surface | Source | Contents |
|---|---|---|
| Inspector "Tables" section | `result.Tables` (Layout) | Visual tables. Layout fallback fires for receipt / W-2 / paystub / bank-statement (catalog `NeedsLayoutFallback=true`). |
| Inspector field row (Tabular DataType) | Synthesised from `List<Dictionary>` | Model's structured interpretation. Click → opens the bottom drawer. |
| Inspector "Records" sub-header | Orphan synthesised tables | Synth tables whose name matches no parent field (e.g., nested `Transactions` from `Accounts[i]`). |
| Bottom-drawer tab strip | Both | Tabs labelled by `table.name` (synth) or `Table N` (layout). |

**Decisions resolved during implementation:**

1. **Conditional-parallel layout fallback** — chosen over serial. Only
   models with `NeedsLayoutFallback = true` (receipt, W-2, paystub,
   bank-statement) trigger the second call. Both calls run via
   `Task.WhenAll` against the same `BinaryData`, so latency is
   `max(model, layout)` instead of `model + layout`. Invoice doesn't pay
   for layout it doesn't need.
2. **Nested synth tables** — option (a) shipped: orphan synth tables
   surface under a "Records" sub-header in the field section. Option (b)
   (drawer-only access) was rejected as harder to discover.
3. **Synth-table page outlines** — per-row outlines when Azure provides
   `item.BoundingRegions` (invoice Items, bank-statement Accounts);
   per-cell outlines as fallback when it doesn't (bank-statement
   Transactions). Mirrors DI Studio's behaviour for both shapes.
4. **Drawer tab labels** — `table.name ?? "Table N"`. Synth tabs read
   `Items`, `Transactions [2]`, etc.; Layout tabs keep detection-order
   labels.

**Files added:**

- `api/Models/TableSources.cs` — string constants for the `Source` column.
- `api/Services/AzureFieldMapping.cs` — shared SDK→DTO mappers
  (FormatValue, ToRegionData, IsArrayOfDictionaries) used by both the
  service and the synthesiser.
- `api/Services/TableSynthesizer.cs` — recursive walk over fields, emits
  one synth table per `List<Dictionary>` with `[N]` collision suffix on
  repeated leaf names.
- `api/Migrations/20260428204306_Add_ExtractedTable_Source_And_Name.cs` —
  additive migration, defaults pre-existing rows to `Source = "Layout"`.
- `web/components/inspector/inspector-tabular-row.tsx` — clickable
  opener for synth tables, used both inside field groups (parented to a
  Tabular field) and under "Records" (orphans).

**Verification matrix (status as of session end):**

- **Invoice** (`samples/sample-invoice.pdf`) — ✅ verified by user. Layout
  Items in "Tables" section, synth `Items` Tabular row in Line Items
  group, per-row outlines on the page.
- **Bank statement** — ✅ verified. Fallback fires; layout returns the
  full transaction table; synth `Accounts` row in the Account group;
  orphan `Transactions` under "Records"; per-row outlines on Accounts,
  per-cell fallback outlines on Transactions.
- **Receipt / W-2 / paystub** — ⚠️ not yet hand-tested by user. Should
  Just Work given the catalog flag is set, but worth a smoke run next
  session.

#### Known UX gaps in Phase G (deliberately deferred)

These came up during testing on a multi-account hypothetical and were
explicitly skipped — flag for revisit if/when the demo audience hits a
multi-account bank statement:

1. **Synth-table cells whose underlying field is itself `List<Dictionary>`
   render `—`.** `AzureFieldMapping.FormatValue` only handles scalars;
   nested arrays fall through to `field.Content` which is empty. Cleanest
   fix: synthesiser flags these cells as tabular and the table-grid
   renders them as `"{N} records →"` clickable links that switch the
   drawer tab to the corresponding nested synth table.
2. **Nested orphans use `[N]` suffix instead of parent context.** A
   multi-account statement produces `Transactions`, `Transactions [2]`,
   `Transactions [3]` — user has to mentally map "row 2 in Accounts" →
   "Transactions [2]". Cleaner naming would be `Transactions (Account
   ****1234)` using the parent's identifier field. Requires the
   synthesiser to track parent context during recursion.

---

### #3.1 Additional Table Extraction features — **next session pickup**

Two distinct sub-features. Recommended order: (b) first (smaller, cleaner
UX, demoable on its own; gives users something to *do* with the tables we
just shipped), then (a) (bigger lift, deserves UX sketching first).

#### (a) Draw-to-add tables for templates

**Goal:** Mirror the existing draw-to-add fields workflow but for tables.
User enters a "draw table" mode → drags a bbox on the source document →
modal names it → saved as a table-region rule on the template → on
future uploads matching that template, the region gets fed to layout to
extract a table from that area.

**Estimated effort:** ~2 days. Schema + service + UI all need work.

**Backend sketch:**

- New entity `TemplateTableRule` (or extend `TemplateFieldRule` with a
  `Kind` discriminator — call this out before coding, both have
  tradeoffs). Carries `Name`, `BoundingRegionsJson`, `TemplateId` FK.
- Single additive migration.
- `TemplatesController.Create` snapshots both field rules and table
  rules from the source document (table rules are user-drawn only;
  Azure-detected tables aren't auto-snapshotted into rules — the user
  explicitly draws them).
- `DocumentsController.ApplyTemplateRules` extends to also extract a
  table per table-rule. Two implementations possible:
  1. **Run layout in that region only.** Pass the bbox as a clip region
     to `prebuilt-layout`. Cleanest, but requires a per-region API call
     (cost adds up).
  2. **Filter result.Tables that fall inside the rule's bbox.** Cheaper
     (no extra API call), works when layout already ran (e.g., bank
     statement upload). Falls back to (1) when no layout tables overlap.
- Persist as `ExtractedTable` with `Source = "TemplateRegion"` (new
  third source value — extend `TableSources`) so the overlay can render
  it differently.

**Frontend sketch:**

- Toolbar: add `Draw table` mode toggle alongside the existing `Draw
  field`. Use a different visual for the drawing rectangle (table icon
  on the cursor, perhaps a different border color) so the user knows
  which mode they're in.
- Modal post-draw: `Name your table` input + region preview. Mirrors
  `NameFieldModal`.
- Template edit page (`/templates/[id]/edit`): new "Table rules"
  collapsible section below "Field rules". Each row = name + region
  preview + delete. Reuse the soft-delete pattern from field rules.
- `BoundingBoxOverlay`: render `TableRegion`s on the template preview
  pane (ghosted PDF view) so the user sees what they're saving.

**UX risk** — IDEAS.md flagged this from the start: "the page will not
feel cluttered or unintuitive." The toolbar grows from `Draw field` → 2
modes; the template edit page grows; needs design thinking before code.
Recommend a paper sketch / mock pass before implementation.

#### (b) Column aggregations

**Goal:** Let users select a column in any synth or layout table → pick
Sum / Average / Count / Min / Max → name the output → result becomes a
computed field on the document (e.g., `Balance Sum`, `Transaction Avg`).

**Estimated effort:** ~1–1.5 days. Smaller surface, contained UX.

**Backend sketch:**

- `AggregationService`: takes `(table, columnIndex, op, outputName)`,
  parses cell content (currency / number — reuse logic from
  `FormatValue` with a value-extraction inverse), computes aggregation,
  returns the value.
- New endpoint `POST /api/documents/{id}/tables/{tableId}/aggregate` →
  body `{ columnIndex, operation, outputName }` → returns the created
  `ExtractedField`. Persists as a regular `ExtractedField` with
  `IsUserAdded = true` and a marker (e.g. `DataType = "Aggregation"` or
  a dedicated `AggregationSource` JSON column on `ExtractedField`).
- Recompute on cell edit? Two options: (1) recompute server-side when
  the source column changes, (2) snapshot at creation time and require
  the user to re-aggregate after edits. (1) is more correct but
  requires tracking the source column; (2) is simpler. Recommend (2)
  for v1 with a TODO comment for (1).

**Frontend sketch:**

- `TableGrid` column header gets a small kebab/dropdown icon on hover.
  Menu items: `Sum`, `Average`, `Count`, `Min`, `Max`. Picking one
  opens a modal with `Name your aggregation field` input + computed
  preview.
- New `AggregateColumnModal` (small, mirrors `NameFieldModal`).
- POST → optimistic field add → result appears in Inspector under
  Custom (or a new "Computed" group if we want to differentiate).
- Edge case: non-numeric columns. Disable Sum/Average/Min/Max when the
  column has no parseable values; allow Count always.

**UX is contained** — dropdown lives on the column header, no toolbar
additions, no template-edit-page changes.

#### Recommended order + scoping

1. **(b) column aggregations** (~1–1.5 days) — ship first.
2. **Sketch (a) UX** before coding — toolbar + template edit page +
   modal flow. Get user sign-off on mocks.
3. **(a) draw-to-add tables** (~2 days) — implement after sketch sign-off.
4. **Then move to §2 field validation rules** (~1 day).

Total: ~4–5 days to close §3 + start §2. Demo is **2026-05-29** (~4
weeks from session end), plenty of runway.

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
- **Multi-account bank statement UX** — see "Known UX gaps in Phase G"
  above. Two small fixes that only matter if the demo includes a
  multi-account statement: (1) clickable cell links for nested
  `List<Dictionary>`, (2) parent-context naming for orphan synth tables.
  Skipped at session end pending demo-doc decision.

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
