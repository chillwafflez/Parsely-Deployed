# Feature Ideas — Roadmap

> Last updated **2026-04-27** after the multi-document-type feature shipped.
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
| 3 | Table extraction + CSV export | 🔲 Not started |
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

**Verified via context7:** `result.Tables` is populated by **all** prebuilt
models that build on the layout substrate, including `prebuilt-invoice`. Each
cell has `RowIndex`, `ColumnIndex`, `Kind` (`columnHeader` / `content`),
`Content`, and bounding regions. So we get table data for free across every
existing supported model.

**Backend sketch:**

- `DocumentExtractionResult` gains a `Tables` collection (list of
  `(rowCount, columnCount, cells, boundingRegions)`).
- Persist as a new `ExtractedTable` entity? Or store as JSON on `Document`?
  - Recommend separate entity for queryability + smaller per-row payload.
  - Schema: `Id`, `DocumentId`, `Index` (table # in doc), `RowCount`,
    `ColumnCount`, `CellsJson` (denormalized).
- Migration: additive.

**Frontend sketch:**

- New "Tables" section in the Inspector below the field groups, expandable.
- `TableViewer` component — read-only mini-grid with header row, scrollable.
  Cells highlight on hover; clicking selects the bbox in the PDF (mirrors
  the existing field-bbox interaction).
- New CSV exporter: `lib/exporters/table-exporter.ts` — RFC 4180-compliant
  per the existing field-exporter pattern. One CSV per table, `{filename}-
  table-{n}.csv`.
- "Picture-of-table → CSV" flow (Markus's #6.3): a separate upload mode
  using `prebuilt-layout` directly. Could be a Tier-2 stretch.

**Excel deferred:** user explicitly chose CSV-only for V1. If/when Excel is
added, use **ExcelJS** (MIT, ~1 MB, lazy-imported). **Do not use SheetJS** —
it switched to SSPL at v0.18.5, legally murky for commercial SaaS (see
PROJECT_CONTEXT.md §13 / Day 13 Part A).

**Estimated effort:** ~3 days.

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
