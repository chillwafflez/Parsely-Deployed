# Document Parsing Service — Project Context

> **Purpose of this file:** full handoff context for a future Claude session so it can pick up where we left off without asking the user to re-explain. Read this, then `memory/MEMORY.md` for persisted user + project memories, then the code.

---

## 1. Product vision

An **all-in-one document parsing SaaS** for multiple industries with a **correction + save-as-template workflow** as the differentiator. The user upload flow:

1. Drop a document (PDF/image) → AI extracts structured fields.
2. Review a side-by-side view (document on left, fields on right), with bounding boxes showing what was detected.
3. Correct mistakes inline, change data types, mark fields required/optional, draw a box over a missed region to "teach" the AI.
4. Save those corrections as a **template** — future uploads from the same vendor auto-apply the corrections (type overrides, required flags, custom-field injection with layout-based text extraction).

Stretch features under consideration (post-demo): Microsoft Teams app integration, e-signature routing via Teams, compliance verification layer (insurance / mortgage verticals).

**Target demo date:** ~2026-04-27, external audience from other companies → UI polish matters.

---

## 2. User profile

- Email: `marketing@taia.us` (product/marketing-adjacent, but actively planning implementation)
- Prefers **Microsoft ecosystem** (C#/.NET, Azure) but open to right-tool-for-the-job (we're on Next.js for the frontend)
- Wants **clean, readable, well-structured code** following industry best practices — not just something that works
- Treats this as a prototype; is fine accepting prototype-level tradeoffs (progressive enhancement, stopgaps documented as TODOs)
- Uses **pnpm** on the frontend (not npm), Windows + Git Bash + VS Code
- **Security preference:** secrets must never reach chat context. Use `.env` (gitignored) for frontend, `dotnet user-secrets` for backend. See "Security notes" below.
- Frequently says `use context7` — prefers verified library docs over trained knowledge for library-specific code.
- Commits at natural milestones; expects us to suggest commit points rather than auto-committing.

---

## 3. Tech stack (locked in)

### Backend — `api/`
| Layer | Choice |
|---|---|
| Runtime | **.NET 10** (SDK 10.0.201) |
| Framework | **ASP.NET Core 10 Web API**, Controllers (not Minimal APIs) |
| AI | **Azure AI Document Intelligence v4** (`Azure.AI.DocumentIntelligence` 1.0.0 SDK), prebuilt-invoice model. The same `AnalyzeDocumentAsync` call returns both structured fields AND the word-level layout — we use the layout for template-driven text extraction (Day 6b). |
| ORM | **EF Core 10** with `Microsoft.EntityFrameworkCore.Sqlite` |
| DB | **SQLite** at `api/app.db` via `Database.EnsureCreated()` (no migrations yet — fine for prototype) |
| File storage | Local FS at `api/uploads/` (gitignored) |
| Config/Secrets | `appsettings.json` (tracked) + `dotnet user-secrets` for dev keys (override) |
| API docs | `Microsoft.AspNetCore.OpenApi` — `/openapi` endpoint in dev |

### Frontend — `web/`
| Layer | Choice |
|---|---|
| Framework | **Next.js 15** (App Router) + **React 19** |
| Language | TypeScript (strict) |
| Styling | **Tailwind CSS v4** (`@theme` directive in `globals.css`, no `tailwind.config.ts`) + **CSS Modules** for component-scoped complex styles (bbox color-mix, keyframes, popovers, modals) |
| Icons | `lucide-react` |
| PDF rendering | **`react-pdf` 9.2.1** + **`pdfjs-dist` 4.x** (NOT 10.x — see "Known gotchas") |
| Utility | `clsx` via `lib/cn.ts` |
| Fonts | Inter + JetBrains Mono via `next/font/google` (CSS vars wired through `@theme`) |
| Package manager | **pnpm** (`pnpm-lock.yaml` is source of truth) |
| Data fetching | Plain `useEffect` + custom hooks (no SWR/React Query — prototype scope) |

### Azure resources
- **Document Intelligence resource**: `taia-ams-docai` in East US (shared org resource — provisioned by user's lead dev)
- Endpoint: `https://taia-ams-docai.cognitiveservices.azure.com/`
- Key stored via `dotnet user-secrets set "DocumentIntelligence:Key" "..."` — **never in `appsettings.json`**
- **Note:** KEY 1 was leaked into chat context on 2026-04-20 twice (once in a message, once via `appsettings.json`). Both times the user rotated. If a future session sees a key in chat, treat it as compromised and ask them to rotate.

---

## 4. Architecture

```
document-parsing/
├── api/                               ASP.NET Core 10 Web API (HTTP on :5180)
│   ├── Contracts/                     Request/response DTOs
│   │   ├── CreateFieldRequest.cs      POST /api/documents/:id/fields
│   │   ├── CreateTemplateRequest.cs   (in TemplateResponse.cs)
│   │   ├── DocumentResponse.cs        Document + Field DTOs, BoundingRegionResponse
│   │   ├── TemplateResponse.cs        Template, TemplateSummary, TemplateFieldRuleResponse, Create
│   │   └── UpdateFieldRequest.cs      PATCH body (all fields nullable)
│   ├── Controllers/
│   │   ├── DocumentsController.cs     CRUD + upload + field CRUD + template matching + rule application
│   │   └── TemplatesController.cs     GET list/:id, POST, DELETE
│   ├── Data/
│   │   └── AppDbContext.cs            EF Core context — 4 DbSets, relationship + cascade config
│   ├── Models/
│   │   ├── Document.cs                TemplateId nullable FK, Template navigation
│   │   ├── ExtractedField.cs          Value, DataType, IsRequired, IsCorrected, IsUserAdded
│   │   ├── Template.cs                VendorHint + SourceDocumentId + Rules
│   │   └── TemplateFieldRule.cs       Name, DataType, IsRequired, BoundingRegionsJson
│   ├── Services/
│   │   ├── IDocumentIntelligenceService.cs  Interface + result records (ExtractedFieldData,
│   │   │                                     PageExtraction, WordData, DocumentExtractionResult)
│   │   ├── DocumentIntelligenceService.cs   Azure DI wrapper — returns fields + pages/words
│   │   └── DocumentIntelligenceOptions.cs   Config binding
│   ├── Properties/launchSettings.json        HTTP on :5180
│   ├── appsettings.json                      Placeholders (empty endpoint/key)
│   ├── appsettings.Development.json.example
│   ├── DocParsing.Api.csproj                 Contains UserSecretsId
│   ├── DocParsing.Api.http                   Manual test requests
│   ├── Program.cs                            Composition root, CORS, OpenAPI, EnsureCreated
│   ├── app.db                                (gitignored) SQLite file
│   └── uploads/                              (gitignored) uploaded originals
│
├── web/                               Next.js 15 (:3000)
│   ├── .npmrc                         pnpm hoist-pattern for pdfjs-dist — REQUIRED
│   ├── app/
│   │   ├── app.module.css             shell grid layout
│   │   ├── globals.css                Tailwind v4 @theme tokens (OKLCH)
│   │   ├── layout.tsx                 next/font loaders for Inter + JetBrains Mono
│   │   └── page.tsx                   phase state machine (upload | parsing | review), useTemplates
│   ├── components/
│   │   ├── bounding-box-overlay.{tsx,module.css}  Confidence-colored bboxes w/ hover tags
│   │   ├── button.{tsx,module.css}                Reusable btn (4 variants) + Kbd
│   │   ├── document-pane.{tsx,module.css}         Toolbar + zoom + dynamic import boundary + draw mode
│   │   ├── drawing-layer.{tsx,module.css}         Full-page mouse capture for rectangle draw
│   │   ├── inspector-field.{tsx,module.css}       Individual field row with inline edit + popover
│   │   ├── inspector.{tsx,module.css}             Composed right-pane: header, stats, search, pills,
│   │   │                                           grouped fields, footer
│   │   ├── name-field-modal.{tsx,module.css}      Naming modal after drawing (autofocus, Esc/backdrop)
│   │   ├── parsing-overlay.{tsx,module.css}       Progress card
│   │   ├── pdf-document-view.{tsx,module.css}     react-pdf integration (SSR-skipped via next/dynamic)
│   │   ├── review-stage.{tsx,module.css}          Composes DocumentPane + Inspector, owns doc mutations
│   │   ├── save-template-modal.{tsx,module.css}   Template save UI (name, kind, desc, applyTo, rules)
│   │   ├── sidebar.{tsx,module.css}               Nav + template library (real API-fed list)
│   │   ├── toast.{tsx,module.css}
│   │   ├── topbar.{tsx,module.css}
│   │   ├── type-popover.{tsx,module.css}          Portal menu for data-type selection
│   │   └── upload-stage.{tsx,module.css}          Dropzone w/ drag-drop
│   ├── lib/
│   │   ├── api-client.ts              upload/list/get doc, PATCH/POST/DELETE field, template CRUD
│   │   ├── bbox.ts                    polygon→percent + percent→polygon math, confidenceLevel
│   │   ├── cn.ts                      clsx wrapper
│   │   ├── constants.ts               FIELD_TYPES, CONFIDENCE_THRESHOLDS
│   │   ├── field-groups.ts            inferFieldGroup(name, isUserAdded?), groupFields
│   │   ├── format.ts                  formatRelativeTime ("2h ago")
│   │   ├── hooks/
│   │   │   └── use-templates.ts       Fetch templates on mount + refresh callback
│   │   └── types.ts                   All DTOs + view models
│   ├── next.config.ts                 Minimal (reactStrictMode only — user stripped earlier helpers)
│   ├── postcss.config.mjs             @tailwindcss/postcss
│   └── package.json                   Pinned versions per "Tech stack"
│
├── context/                           (this folder)
│   └── PROJECT_CONTEXT.md
├── memory/                            Claude's persisted user/project memories (separate from context)
├── samples/                           (gitignored) Microsoft's public sample invoice PDF
├── Document Parsing Service Prototype-handoff/  (gitignored) Claude Design export, visual reference
├── document-parsing.sln
├── README.md
└── .gitignore
```

### Runtime request flow

1. User drops PDF → `web/components/upload-stage.tsx`
2. `POST http://localhost:5180/api/documents/upload` (multipart)
3. API saves file to `uploads/<guid>-<filename>`, calls `DocumentIntelligenceService.AnalyzeAsync` which returns **both** fields and pages (with per-word polygons + confidence)
4. Fields become `ExtractedField` rows; `TryMatchTemplateAsync` searches `Templates.VendorHint` against the extracted `VendorName`
5. If a template matches → `ApplyTemplateRules(document, template, pages)`:
   - Existing fields matched by name (case-insensitive): override `DataType` + `IsRequired` only
   - Rules with no matching extracted field: `ExtractTextFromRule(rule, pages)` pulls layout words whose **center** falls inside the rule's axis-aligned polygon bounds, concatenates them, averages confidence. New `ExtractedField` injected with `IsUserAdded=true`, `IsCorrected=false`
   - No words found → `Value = null`, `Confidence = 0` (red flag, counts toward Missing Req.)
6. Document saved with all fields in a single transaction; `DocumentResponse` returns with `templateName` attached
7. Client renders review stage: PDF on left with colored bboxes, Inspector on right with grouped fields

### Coordinate math (in `web/lib/bbox.ts`)

Azure DI polygon unit for PDFs is **inches**. pdf.js viewport at scale 1 returns **PDF points** (72/inch).

- Display (`polygonToPercentBBox`): convert Azure polygon → percentage of page for absolute positioning on any zoom/scale
- Drawing (`percentBBoxToPolygonInches`): convert user-drawn percentage rectangle → 4-corner polygon in inches to match Azure's storage format
- Both helpers must use the same `pageWidthPoints / 72` conversion. Any change happens in one place.

**Always get native page dimensions via `page.getViewport({ scale: 1 })`.** The react-pdf `onLoadSuccess` callback's `page.width` / `page.height` are the *rendered pixel* dimensions, not native. Using them breaks bbox alignment (close-but-not-quite).

---

## 5. Build progress — what's done

### Day 1 ✅ — Backend round-trip
- ASP.NET Core API scaffolded, Azure DI integrated
- `POST /api/documents/upload` works end-to-end (upload → Azure DI → SQLite → response)
- Initial Fluent UI frontend (later replaced)

### Day 2 ✅ — Design system + UI shell
- **Dropped Fluent UI** (Griffel shorthand pain, didn't fit the custom design)
- Adopted Claude Design's mock 1:1 (`Document Parsing Service Prototype-handoff/`)
- Ported OKLCH color tokens into Tailwind v4 `@theme` block in `app/globals.css`
- Built: Topbar, Sidebar (nav + template library), UploadStage (dropzone), ParsingOverlay (progress card), Toast
- `next/font/google` for Inter + JetBrains Mono

### Day 3 ✅ — PDF viewer + bounding-box overlay
- Installed `react-pdf` + `pdfjs-dist`
- Built: `DocumentPane` (toolbar + zoom + dynamic-import boundary), `PdfDocumentView` (react-pdf wrapper, SSR-skipped via `next/dynamic`), `BoundingBoxOverlay` (color-coded bboxes w/ hover tags + click-select), `ReviewStage`
- Confidence coloring: green ≥90%, amber 70–89%, red <70% (+ `!` badge)
- Click-to-select sync both ways; hover tag shows label + confidence
- Fixed initial bbox misalignment by switching from `page.width` to `page.getViewport({ scale: 1 }).width`

### Day 4 ✅ — Inspector + inline editing
- Backend: `IsRequired` column added, `PATCH /api/documents/:id/fields/:fieldId` endpoint with nullable partial DTO
- Frontend: Full `Inspector` (replaces interim `FieldListSimple`): title + template badge, 3-up stat boxes (Fields / To Review / Missing Req.), status dots, search input, filter pills (All/Issues/Required), grouped fields, footer
- `InspectorField`: click-to-edit value (Enter commit / Esc cancel / blur commit), type popover (portal-rendered), required toggle (lock ↔ pin icons), delete icon
- **Optimistic updates** in `ReviewStage` — per-field rollback on PATCH error, `showToast`
- Field grouping via `lib/field-groups.ts` pattern matching (Parties / Totals / Document / Line Items / Custom)
- Schema change required `rm app.db*`

### Day 5 ✅ — Draw-to-add fields + deletion
- Backend: `IsUserAdded` column, `POST /api/documents/:id/fields` + `DELETE /api/documents/:id/fields/:fieldId`, `CreateFieldRequest` with DataAnnotations validation
- Frontend:
  - `DrawingLayer`: full-page absolute overlay, mouse event capture, live dashed preview, axis-aligned min-size threshold (1.5%×1%)
  - `NameFieldModal`: portal-rendered, autofocus, Esc/backdrop close, name + data type + required toggle + region preview
  - `DocumentPane`: `drawMode` state, toolbar toggle button (active state), `B` keyboard shortcut (guarded against input/textarea/contentEditable), `Esc` exits
  - `PdfDocumentView`: conditionally renders `BoundingBoxOverlay` OR `DrawingLayer` per page (not stacked — cleaner event handling)
  - `InspectorField` trash wired to real DELETE with optimistic remove + rollback
  - `ReviewStage`: pessimistic create (user is already waiting on modal), optimistic delete with index-preserving rollback
- `field-groups.ts`: `inferFieldGroup(name, isUserAdded=true)` → always "Custom"
- `lib/bbox.ts` gained `percentBBoxToPolygonInches` — inverse of the display math
- Schema change required `rm app.db*`

### Day 6 ✅ — Save as Template + template matching + rule application (Day 6b)

**Day 6 (matching + label):**
- Backend: Two new models (`Template`, `TemplateFieldRule`) with cascade delete between them and SetNull between Document→Template; Document gained nullable `TemplateId` + `Template` navigation
- New `TemplatesController` with `GET` list/:id (with rules), `POST` (snapshots the source doc's current fields into rules + captures VendorName as `VendorHint`), `DELETE`
- `DocumentsController.TryMatchTemplateAsync`: case-insensitive VendorName → VendorHint match, attaches `Template` navigation so the response includes `templateName`
- Frontend:
  - `SaveTemplateModal` (portal): name (auto-suggested from VendorName), kind, description, Apply-to segmented, captured rules preview
  - `useTemplates()` hook — fetch on mount + manual refresh
  - `Sidebar` now fetches real templates, shows loading state, "created" time formatted via `formatRelativeTime`
  - `ReviewStage.handleSubmitSaveTemplate`: pessimistic create, optimistically updates local `document.templateName` on success, calls `onTemplatesChanged` to refresh sidebar
  - Toast on upload differentiates: failed / matched-to-X / N fields extracted

**Day 6b (rule application):**
- Discovered on test: matching was cosmetic only; user's corrections didn't actually carry forward to next upload. Small bolt-on fix, no schema change.
- `DocumentIntelligenceService.AnalyzeAsync` return type broadened to `DocumentExtractionResult(Fields, Pages)` where `Pages[].Words[]` has content + polygon + confidence (same Azure call, no extra cost)
- `ApplyTemplateRules(document, template, pages)` now:
  - **Name match** → override `DataType` + `IsRequired` on the existing field (leave value/confidence/regions alone)
  - **No match** → `ExtractTextFromRule` picks layout words whose centers fall inside the rule's polygon bounds, concatenates them, averages confidence. Injects an `IsUserAdded` field with the real extracted value (or null + confidence=0 if nothing falls inside)
- Helpers in `DocumentsController.cs`: `AxisAlignedBounds`, `WordCenterInside`, `ExtractTextFromRule`
- Toast enhanced: "Parsed · matched to X · N required missing" (red tone) when template match + required fields empty
- **Key correctness property:** confidence = 0 for unfound regions → Inspector shows red flag + Missing Req. counter, honest signaling vs. the earlier misleading "100% green empty" state
- Verified end-to-end: custom ThankYouMessage field gets real text extracted on next upload; an edited PDF with erased PurchaseOrder correctly shows as required + empty + red

**Current committed state: Days 1–5 on main via single commit `"feat: Day 1-3 — upload, parse, PDF viewer with bboxes"` + a Day 4-5 commit user made. Days 6 + 6b are working but uncommitted at session end.**

---

## 6. What's next — Day 7

Demo is ~2026-04-27. All three core value props are functional: parse, correct, teach-via-template. Day 7 is about making the existing flow feel professional enough for external stakeholders.

### Day 7 scope (session split recommended)

**Session A — URL routing + polish:**
1. **URL-based routing (HIGH PRIORITY).** Add `/documents/[id]` route as a dynamic segment. `ReviewStage` becomes the page for that route; fetches document by id on mount. `/` becomes upload + list. This fixes the "refresh sends me back to upload" issue flagged during Day 4 testing — currently the phase state machine is React state only. **Demo-critical because live-demo reloads currently break the flow.**
2. **Polish pass:**
   - Better empty states ("No documents yet — drop one to parse")
   - Error banners inline (not just toasts) for upload failures
   - Consistent loading skeletons on Inspector / Sidebar
   - One toast root at the app level — currently `HomePage` and `ReviewStage` each own one; they can overlap visually
   - Topbar shows the matched template name inline when in review

**Session B — history + seed:**
3. **Documents list / history page.** Table at `/` showing previously-uploaded docs (filename, createdAt, template match, field count). Click to open `/documents/[id]`. Backend already has `GET /api/documents` (lists summaries).
4. **Seed 2–3 demo documents.** Real-looking redacted invoices with different vendors (or variants of Microsoft's sample). Demonstrates template matching across vendors, not just Contoso re-uploads.

### Deferred to Phase 2 (post-demo)

- **Revert button.** Proper implementation needs either re-running Azure DI (expensive + discards user-drawn fields) or storing original values per field (schema change + per-field history). Neither is cheap. The demo never needs to revert.
- **Microsoft Teams tab wrapper.** Re-skin with Fluent UI likely required. ~1 day.
- **E-signature routing via Teams.** Adobe Sign / Microsoft Syntex integration.
- **Azure custom-model training.** Once a template accumulates 5+ samples, trigger background training. Replaces our current stopgap rule application with a proper trained model.
- **Layout-fingerprint template matching.** Today's VendorHint substring match is brittle. Layout hash would match across vendors with similar invoice structure.
- **Move storage to cloud.** SQLite → Azure SQL; local filesystem → Azure Blob. Docker-compose for prod packaging.
- **Compliance verification layer.** See `memory/project_compliance_doc_idea.md`.
- **Auth.** Microsoft Entra ID.

---

## 7. Known gotchas & their fixes (DO NOT re-encounter)

### Backend

**`DocumentFieldType` is not a C# enum.** Azure DI SDK exposes it as an extensible-enum struct. Can't be used in `switch` case labels. Use `if (type == DocumentFieldType.X)` chain. Don't try `ValueLong` or `DocumentFieldType.Long` — use `ValueString`, `ValueCurrency`, or fall back to `field.Content`.

**`DbUpdateConcurrencyException` on double-save.** EF Core's change tracker gets confused when you `SaveChangesAsync`, then replace a collection navigation by reference, then `SaveChangesAsync` again. **Fix:** build the entity graph fully before any DB work, then single `Add` + single `SaveChangesAsync` inside a try/catch.

**Secrets rotation.** User Secrets is the canonical path. `dotnet user-secrets set "DocumentIntelligence:Key" "..."` in `api/`. `appsettings.json` stays with empty strings. Two key leaks happened on 2026-04-20; user rotated each time.

**Schema changes require `rm api/app.db*` (no migrations).** Every backend schema change so far (`IsRequired`, `IsUserAdded`, `Templates` + `TemplateFieldRules` + `Document.TemplateId`) required a dev DB reset. Uploaded docs are lost. Files in `api/uploads/` become orphaned.

**Azure DI prebuilt models include layout for free.** `prebuilt-invoice`, `prebuilt-receipt`, etc. all return both structured `Documents` and word-level `Pages` in a single `AnalyzeDocumentAsync` call. We use this in Day 6b for template-region text extraction — no extra Azure call, no cost increase.

**Polygon units depend on page unit.** For PDFs, Azure DI returns polygons in inches. For images, pixels. Field bounding regions AND word polygons on the same page share the same unit, so they can be compared directly without conversion. Template rules saved from PDFs (inches) won't cleanly apply to image uploads (pixels) — not handled in prototype.

**Template rule matching is name-based, case-insensitive.** `StringComparison.OrdinalIgnoreCase` throughout. If two Azure DI fields happen to share a name (shouldn't but possible), only the first matches.

### Frontend

**Dropped Fluent UI entirely.** Griffel (Fluent's styling engine) rejects CSS shorthands (`border`, `padding`, `gap`, `overflow`, `transition`, `borderColor`, etc.). Also didn't fit the custom design. Replaced with Tailwind v4 + CSS Modules. **Do not reintroduce Fluent UI** — if Teams demo is needed, Fluent-skin that app only at the Teams boundary, not here.

**pnpm needs `.npmrc` hoist for pdfjs-dist.** Without `public-hoist-pattern[]=*pdfjs-dist*` in `web/.npmrc`, pnpm's isolated module store puts pdfjs-dist where Webpack can't cleanly resolve it. File already exists — do not remove.

**react-pdf 10.x + pdfjs-dist 5.x breaks under Next.js 15 + Webpack.** Symptom: `Object.defineProperty called on non-object` at `pdf.mjs` module load. Fix that works: stay on `react-pdf: ^9.2.1` + `pdfjs-dist: ^4.8.69`. The documented "`devtool != eval-*`" Webpack workaround is flaky in practice. Don't "upgrade" back to 10.x without verifying the upstream fix.

**pdfjs worker path — use CDN for stability.** `pdf-document-view.tsx` uses `https://unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`. The `import.meta.url`-based path is brittle under Next.js. If a future session wants to self-host for prod, copy the worker to `public/` and point at `/pdf.worker.min.mjs`.

**Bbox alignment — always use `getViewport({ scale: 1 })`.** The `page.width`/`page.height` properties in react-pdf's `onLoadSuccess` callback are the **rendered** (scaled) dimensions, not native. Must use `page.getViewport({ scale: 1 }).width` for PDF points. See `pdf-document-view.tsx` `handlePageLoad`.

**API response casing.** ASP.NET Core's default `JsonNamingPolicy.CamelCase` applies to response properties. Frontend types are camelCase. Internal DB JSON blobs (e.g., `BoundingRegionsJson`) preserve PascalCase but get case-insensitively deserialized, then re-serialized camelCase on the wire. Don't mix.

**Next.js config cache.** `next.config.ts` changes don't hot-reload. Stop dev server AND `rm -rf .next` (webpack cache).

**Optimistic update rollback pattern** (used for edit + delete in `review-stage.tsx`): capture previous state inside the `setDocument` updater, return a rollback closure, call it in the catch branch. Per-field rollback avoids reverting unrelated concurrent edits. Create is *pessimistic* because the user is already waiting on a modal submission — no flicker.

**`file-name` prop on react-pdf `Page.className`.** We use the `className` prop directly; CSS Modules work but the `react-pdf__Page__canvas` child needs a `:global()` selector if you need to style it. We avoid this by controlling the canvas display with wrapper styles.

### Environment

**Mixed lockfiles.** pnpm is the source of truth. If `package-lock.json` ever reappears in `web/`, delete it — it means someone ran `npm install` by mistake. Confirm via `ls web/node_modules/.pnpm` (should exist).

---

## 8. Security notes

- **Never read `.env*` files** in this project. User said so explicitly; see `memory/feedback_no_env_reads.md`.
- Secrets go in `dotnet user-secrets` (backend) or `.env.local` (frontend, only `NEXT_PUBLIC_*` vars, which are non-secret).
- Azure DI endpoint is non-secret (URL). The KEY is secret.
- No authentication yet — anyone with network access to port 5180 can upload, edit, delete, create templates. Add Entra ID auth in Phase 2.

---

## 9. How to run

### First-time setup (if node_modules missing)

```bash
cd api && dotnet restore

cd ../web && pnpm install           # NOT npm install
```

### Configure API secrets (first time only)

```bash
cd api
dotnet user-secrets list            # verify both are set:
                                    #   DocumentIntelligence:Endpoint = https://taia-ams-docai.cognitiveservices.azure.com/
                                    #   DocumentIntelligence:Key      = <rotated value>
```

If missing, ask user to set them (don't request the key value in chat).

### Start both services

```bash
# Terminal 1
cd api && dotnet run                # http://localhost:5180

# Terminal 2
cd web && pnpm dev                  # http://localhost:3000
```

### Verify full flow

1. Upload a PDF (sample at `samples/sample-invoice.pdf` — Microsoft's official sample)
2. Review stage opens with bboxes aligned
3. Click a value → edit inline → Enter → persists
4. Press B or click "Draw field" → drag a rectangle → modal → Save → new field appears with bbox
5. Click trash on any field → removes
6. "Save as template" → modal → Save → sidebar shows new template + Inspector header shows "Template: X"
7. Refresh page (loses document state — Day 7 fixes this), re-upload same PDF → toast "matched to X"
8. Template-overridden fields have new types/required flags; custom fields are injected with real extracted values or flagged red-empty

---

## 10. Design reference

The UI draws 1:1 from the Claude Design mock exported to `Document Parsing Service Prototype-handoff/document-parsing-service-prototype/`. Key files:

- `project/Parser.html` — full mock (massive file — read via grep, not full read)
- `project/styles.css` — source of OKLCH design tokens now in `web/app/globals.css`
- `project/app.jsx`, `sidebar.jsx`, `document.jsx`, `inspector.jsx`, `modals.jsx`, `data.jsx` — reference component structure
- `project/data.jsx` — sample data shape for fields (used as Day 4 Inspector design source)

**Don't modify the handoff bundle.** Treat it as read-only reference.

---

## 11. Where we left off

**2026-04-21 end of session:**

- Days 1–6 complete, plus Day 6b (template rule application with layout OCR) that resolved user-observed "template matching is cosmetic" and "100% green empty placeholder" concerns
- Full demo loop works end-to-end: upload → review with aligned bboxes → inline correct → draw to add missed field → save as template → re-upload → template rules auto-apply (type overrides, required flags, OCR-extracted custom field values)
- Last user message confirmed: "Everything works nicely! When testing with my edited PDF, it shows the PurchaseOrder field with the Required key and 0% confidence… ThankYouMessage also now has an actual value extracted from the region I drew in the template."
- Day 4–5 committed to main. Day 6 + 6b uncommitted at session end — **suggest user commits before next session starts work**, e.g., `git commit -m "feat: Day 6 — Save as Template + rule application with layout OCR"`
- `appsettings.json` still has empty `Key`; User Secrets holds the live key
- `.npmrc` in `web/` still enforces pnpm hoist

### First actions for the next session

1. Ask if they committed Day 6 + 6b. If not, suggest the commit.
2. Confirm Day 7 scope from §6. Default: start with URL routing (Session A).
3. Before changes: if any schema change surfaces, remember to tell user to `rm api/app.db*`. Day 7 as scoped has **no** schema changes expected.
4. `use context7` for any library-specific uncertainty (user consistently reminds).

### Open deferred items

- **URL routing** (Day 4 deferred → Day 7 scheduled) — this is the #1 next thing.
- **Unified toast** (Day 4 noted — HomePage + ReviewStage each own one; can visually stack).
- **Revert button** (Day 4 deferred → Phase 2 per Day 7 triage).
- **Line Items table special-render.** Azure DI's `Items` field returns a list-of-dictionaries; we currently show it as a single field with raw content. Design mock has a dedicated line-items mini-table in the Inspector — not ported. Phase 2.
- **Template deletion from sidebar UI.** Backend endpoint exists (`DELETE /api/templates/:id`). No UI for it yet. Day 7 polish nice-to-have.

---

## 12. Anti-patterns to avoid

- Don't re-add Fluent UI — explicitly rejected. If Teams demo is needed later, wrap the web app in a Teams tab and re-skin only the outermost boundary.
- Don't "upgrade" react-pdf to 10.x without an explicit ask + plan for the Next.js 15 compat issue.
- Don't read `.env*` files for any reason.
- Don't accept a credential in chat context — ask for rotation if one surfaces.
- Don't add features, abstractions, or tests beyond what the user asks for (from their global prefs: "keep it simple", "prototype").
- Don't auto-commit. User wants to review and run commits themselves unless they explicitly delegate.
- Don't use `.pnpm` internals in URLs — use the hoisted paths or CDN for workers.
- Don't store template-injected fields with `Confidence = 1.0` when the value is empty — use `Confidence = 0` so the red flag fires correctly. (Day 6b lesson.)
- Don't assume `onLoadSuccess.page.width` is native — use `page.getViewport({ scale: 1 })`. (Day 3 lesson.)
- Don't do two `SaveChangesAsync` calls with entity mutations in between — build graph, Add once, Save once. (Day 4 lesson.)
- Don't add `PLACEHOLDER_TEMPLATES` back — real templates come from the API now.
- Don't return `TemplateSummary.RuleCount` via a post-load loop — do it in the projection query like the current code does.
- Don't cascade-delete documents when a template is deleted — use `SetNull` on the Document→Template FK (protects history).
- Don't use CSS shorthands if Fluent UI ever returns. (Currently out of scope since Fluent is dropped.)

---

_Last updated: 2026-04-21 after Day 6b (template rule application with layout OCR) completed successfully. Session context at ~55% used; fresh session recommended for Day 7 work._
