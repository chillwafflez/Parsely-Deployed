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
| Styling | **Tailwind CSS v4** (`@theme` directive in `globals.css`, no `tailwind.config.ts`) — primary styling system since Day 9 migration. Plain `cn()` wrapper over `clsx` (no `tailwind-merge`, no `tailwind-variants` — both were tried and rejected). CSS Modules only survive in `bounding-box-overlay.module.css` + `inspector/*.module.css` + `app/page.module.css` pending the remainder of the Day 9 migration (Sub-batch B). |
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
│   ├── global.d.ts                    Ambient `declare module "*.css";` so VS Code's TS
│   │                                  language server accepts the side-effect `./globals.css`
│   │                                  import. Next.js handles it at build time anyway.
│   ├── app/
│   │   ├── documents/
│   │   │   ├── [id]/
│   │   │   │   ├── loading.tsx        Route convention: renders DocumentLoadingSkeleton
│   │   │   │   ├── not-found.tsx      Route convention: renders DocumentNotFoundPanel
│   │   │   │   └── page.tsx           Unwraps `params` Promise via React 19 `use()`,
│   │   │   │                          then renders <DocumentLoader documentId>
│   │   │   └── page.tsx               Documents history list + upload orchestration
│   │   ├── globals.css                Tailwind v4 @theme tokens (OKLCH)
│   │   ├── layout.tsx                 Root layout (server) — wraps children in <AppShell>
│   │   ├── page.module.css            Thin home-page wrapper styles (banner slot)
│   │   └── page.tsx                   Landing route: UploadStage + parsing overlay +
│   │                                  inline upload-error banner, navigates to /documents/[id]
│   ├── components/                                Organized by domain/type since 2026-04-22.
│   │   │                                          Tailwind-migrated files listed as `.tsx` only;
│   │   │                                          remaining `.tsx + .module.css` pairs are pending
│   │   │                                          Day 9 Sub-batch B / inspector migration.
│   │   ├── ui/                                    Generic primitives, zero domain knowledge — MIGRATED
│   │   │   ├── button.tsx                         Reusable btn (4 variants) + Kbd. Variant-specific
│   │   │   │                                       classes inlined with ternaries in cn() (no
│   │   │   │                                       tailwind-variants — plain conditional arrays).
│   │   │   ├── error-banner.tsx                   Persistent inline banner w/ role="alert" + dismiss.
│   │   │   ├── skeleton.tsx                       Shimmer via `animate-skeleton-pulse` (@theme token);
│   │   │   │                                       honors `motion-reduce:` variant.
│   │   │   ├── toast.tsx                          Auto-dismissing notification; uses `animate-toast-in`.
│   │   │   └── type-popover.tsx                   Portal menu for data-type selection.
│   │   ├── layout/                                App chrome shared across all routes — MIGRATED
│   │   │   ├── app-shell.tsx                      Persistent chrome: Topbar + Sidebar + single Toast
│   │   │   │                                       root; owns useTemplates + activeDocument.
│   │   │   ├── sidebar.tsx                        Client component w/ next/link + usePathname active
│   │   │   │                                       states; hover-revealed template trash via Tailwind
│   │   │   │                                       `group` / `group-hover:` pattern.
│   │   │   └── topbar.tsx                         Matched-template badge pill. Brand mark gradient +
│   │   │                                          inset shadow kept as `MARK_STYLE` inline CSS (too
│   │   │                                          gnarly as a class list for a one-off element).
│   │   ├── document/                              Document viewing, uploading, and listing
│   │   │   ├── bounding-box-overlay.{tsx,module.css}  **NOT YET MIGRATED** — Sub-batch B. This is the
│   │   │   │                                       one file doing percentage-based absolute-positioned
│   │   │   │                                       overlay math (spatially load-bearing), so it was
│   │   │   │                                       intentionally isolated from the Sub-batch A pass.
│   │   │   ├── document-list.tsx                  Documents history table w/ drag-drop upload,
│   │   │   │                                       template badges, skeleton, empty state. Row hover
│   │   │   │                                       uses `group` + `group-hover:bg-accent-weak` on each
│   │   │   │                                       td; bottom-border collapses on last row via
│   │   │   │                                       `group-last:border-b-0`. Shared `BODY_CELL` const.
│   │   │   ├── document-loader.tsx                Owns `/documents/[id]` state machine
│   │   │   │                                       (loading|ready|not-found|error), syncs shell. No
│   │   │   │                                       styles of its own.
│   │   │   ├── document-pane.tsx                  Toolbar + zoom + dynamic import boundary + draw mode
│   │   │   ├── document-placeholder.tsx           DocumentLoadingSkeleton (matches ReviewStage layout)
│   │   │   │                                       + DocumentErrorPanel + NotFoundPanel. Shared
│   │   │   │                                       `PANEL_CLASS` / `LINK_CLASS` constants.
│   │   │   ├── drawing-layer.tsx                  Full-page mouse capture for rectangle draw. Preview
│   │   │   │                                       rect keeps inline `style` for percent positioning
│   │   │   │                                       (dynamic values); colors as arbitrary `color-mix`.
│   │   │   ├── parsing-overlay.tsx                Progress card. Step state (done|current|pending)
│   │   │   │                                       uses mutually exclusive ternaries so no conflicting
│   │   │   │                                       utilities land in the className. Uses
│   │   │   │                                       `animate-blink` @theme token.
│   │   │   ├── pdf-document-view.tsx              react-pdf integration (SSR-skipped via next/dynamic).
│   │   │   │                                       The `.react-pdf__Page__canvas` vendor override
│   │   │   │                                       moved to `globals.css` as a plain global rule
│   │   │   │                                       (consistent with the existing `::-webkit-scrollbar`
│   │   │   │                                       block). Idiomatic for third-party class overrides.
│   │   │   ├── review-stage.tsx                   Composes DocumentPane + Inspector, owns doc
│   │   │   │                                       mutations. Controlled — receives doc + updater
│   │   │   │                                       from DocumentLoader.
│   │   │   └── upload-stage.tsx                   Dropzone w/ drag-drop. Dot-grid `radial-gradient`
│   │   │                                          background kept as `STAGE_BG` inline style — too
│   │   │                                          verbose as a Tailwind arbitrary value.
│   │   ├── inspector/                             Right-pane field editor — **NOT YET MIGRATED**
│   │   │   ├── inspector.{tsx,module.css}         Composed pane: header, stats, search, pills,
│   │   │   │                                       grouped fields, rich empty states, footer.
│   │   │   └── inspector-field.{tsx,module.css}   Individual field row with inline edit + popover.
│   │   └── modal/                                 Portal dialogs — MIGRATED
│   │       ├── delete-template-modal.tsx          Destructive-action confirm modal (alertdialog).
│   │       │                                       Uses `animate-scrim-fade` + `animate-modal-pop`
│   │       │                                       @theme tokens; local `DANGER_BTN_CLASS` const.
│   │       ├── name-field-modal.tsx               Naming modal after drawing (autofocus, Esc/backdrop);
│   │       │                                       shared `LABEL_CLASS` / `INPUT_CLASS` / `SEG_*` consts.
│   │       └── save-template-modal.tsx            Template save UI (name, kind, desc, applyTo, rules);
│   │                                              shares the same const patterns + `TEXTAREA_CLASS`.
│   ├── lib/
│   │   ├── api-client.ts              upload/list/get doc, PATCH/POST/DELETE field, template CRUD
│   │   ├── app-shell-context.ts       React context exposing showToast, refreshTemplates,
│   │   │                              setActiveDocument via useAppShell() hook
│   │   ├── bbox.ts                    polygon→percent + percent→polygon math, confidenceLevel
│   │   ├── cn.ts                      clsx wrapper
│   │   ├── constants.ts               FIELD_TYPES, CONFIDENCE_THRESHOLDS
│   │   ├── field-groups.ts            inferFieldGroup(name, isUserAdded?), groupFields
│   │   ├── format.ts                  formatRelativeTime ("2h ago")
│   │   ├── hooks/
│   │   │   ├── use-documents.ts       Fetch document list on mount + refresh callback
│   │   │   └── use-templates.ts       Fetch templates on mount + refresh callback
│   │   └── types.ts                   All DTOs + view models (DocumentSummary now has
│   │                                  templateName; SidebarView removed)
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

**Committed state through Day 6b:** Day 6 + 6b committed after end-of-Day-6 session.

### Day 7 ✅ — URL routing, AppShell, history page, polish pass, template deletion

Done in three sub-sessions over 2026-04-21. All four core "demo polish" goals hit. No schema changes.

**Session 7A — URL routing + AppShell + centralized toast** *(commit `7da4ab0`)*
- New dynamic route `/documents/[id]` — `params` is now a `Promise` in Next.js 15, unwrapped in a client `page.tsx` via React 19 `use()`. Keys `<ReviewStage>` on `document.id` to force remount on navigation.
- `DocumentLoader` owns the canonical document state as a discriminated union (`loading | ready | not-found | error`). Calls `notFound()` during render (not in an effect) per Next.js docs. Uses a `cancelled` flag in the async `useEffect` to discard stale responses.
- `ReviewStage` became **controlled**: receives `document` + `onDocumentChange` updater from the loader rather than holding its own canonical state. Lets the shell stay in sync with every field edit / template save without a prop-drilling round-trip.
- New `AppShell` wraps every route (`app/layout.tsx`) with Topbar + Sidebar + a **single** Toast root. Exposes `showToast`, `refreshTemplates`, `setActiveDocument` via `AppShellContext` + `useAppShell()` hook. Fixes the Day 4-noted issue where `HomePage` and `ReviewStage` each owned their own Toast and could visually stack.
- Topbar gained a matched-template badge pill (LayoutTemplate icon + name) — renders when `activeDocument.templateName` is non-null.
- `/documents/[id]/loading.tsx` and `not-found.tsx` route conventions added for instant route-transition feedback.
- Two separate effects in DocumentLoader: one to **sync** the shell on every state change, one to **clear on unmount**. Prevents a brief `null` flash through the topbar during edit re-renders.
- VS Code TS language server error on `./globals.css` side-effect import fixed by adding `web/global.d.ts` with `declare module "*.css";`.
- Structural type workaround kept in `pdf-document-view.tsx` for pnpm's isolated-store duplicate-copy `#private` brand clash on `PDFPageProxy`.

**Session 7B — Documents history page (`/documents`) + route-based sidebar nav**
- Backend: `DocumentSummary` DTO now returns `TemplateName` (EF Core LEFT JOIN via `d.Template != null ? d.Template.Name : null`). No schema change.
- New `DocumentList` component: drag-drop upload anywhere on page, table with filename / status pill / template badge / field count / relative upload time; loading skeleton, empty state with CTA, inline fetch-error banner.
- `useDocuments()` hook mirrors `useTemplates()` pattern.
- **Routing refactor**: `/` reverted to the original UploadStage landing experience (dot-grid dropzone). `/documents` is the new history page. `/documents/[id]` is the existing detail page.
- Sidebar rewritten to use `next/link` + `usePathname()` for active state (industry-standard Next.js App Router pattern from the docs). Parse (→`/`) and Documents (→`/documents`) are real `<Link>`s with `aria-current="page"`. Queue / Templates / Settings became disabled placeholder buttons (Phase 2).
- Dead `view` / `onChangeView` / `SidebarView` state machine removed from AppShell, Sidebar, and `lib/types.ts` — the router is now the single source of truth for active-section highlighting.
- **Bug fix**: `.primary:hover` in `button.module.css` was only overriding `filter` + `color`, not `background`. The generic `.btn:hover` rule then set `background: var(--color-surface-2)` (near-white), producing white-on-white text. Fixed with an explicit darker `color-mix(in oklab, var(--color-accent) 88%, black)` background + `:not(:disabled)` guard.

**Session 7C — Polish pass: Skeleton + ErrorBanner primitives, richer empty states**
- Two new reusable primitives:
  - `<Skeleton>` — `width` / `height` / `radius` props, `aria-hidden`, respects `prefers-reduced-motion` (WCAG 2.3.3) by disabling the pulse and holding at 0.75 opacity.
  - `<ErrorBanner>` — `role="alert"`, optional bold title, optional `onDismiss` (renders `×` with `aria-label`), `focus-visible` outline.
- `/documents/[id]` loading state replaced the centered spinner with a **full layout skeleton** that mirrors ReviewStage: toolbar row, ~8.5:11 page placeholder on the left, Inspector header + 3-up stat cards + search + 5 field rows on the right. Used by both `DocumentLoader` state and the route convention `loading.tsx`.
- Sidebar template list "Loading templates…" text replaced with 3 shimmer cards sized to match real card dimensions (no reflow on swap-in).
- Inspector empty state split into two cases with distinct icons + copy:
  - `fields.length === 0` → accent pen icon + "No fields extracted" + actionable hint ("Draw a box on the page to add one manually")
  - Filtered to zero → muted search icon + "No matches" + instruction to clear the filter
- Upload failures swapped from transient toasts to persistent `<ErrorBanner>` above the dropzone (`/`) and above the documents table (`/documents`). Banners auto-clear when the user starts a new upload attempt, or the user can dismiss with `×`. Toasts kept for successful operations (field saved, template created, "matched to X").
- `DocumentList` refactored onto the shared primitives — removed ~35 lines of duplicated CSS (local shimmer keyframes + inline banner markup).
- `DocumentErrorPanel` / `DocumentNotFoundPanel` "Back to upload" link now points to `/documents` (more useful destination with the list page present).

**Session 7D — Template deletion UI**
- `components/delete-template-modal.tsx` — destructive-action confirmation modal. `role="alertdialog"` with `aria-labelledby` + `aria-describedby`, portal to `document.body`, scrim click / Escape to cancel (blocked while submitting), auto-focuses the destructive button via `queueMicrotask` to avoid stray Enter-key races, grammar-correct runs copy ("1 document was…" / "N documents were…"), explains the backend SetNull semantics ("fields stay intact, but lose the template badge").
- Template card refactored from `<button>` to `<div role="button" tabIndex={0}>` with an Enter/Space keyboard handler, so the nested trash `<button>` no longer produces invalid HTML (nested interactive content).
- Trash icon hidden by default (`opacity: 0`), revealed on `.tpl:hover` / `.tpl:focus-within`; `.tplDelete:hover` switches to red-weak bg for destructive affordance. Keyboard users get it as soon as they tab into the card.
- Sidebar uses `useAppShell()` for `refreshTemplates` + `showToast`. On confirm: disable button → call `deleteTemplate(id)` → close modal → refresh template list → toast "Template removed · X". Errors surface via toast, modal stays open so the user can retry.

**Known minor staleness (documented, not fixed):** if the user deletes a template while viewing an affected document on `/documents/[id]`, the topbar badge and Inspector "Template: X" label remain stale until navigation. `DocumentLoader` owns the canonical document state and has no "template changed" signal. Prototype-acceptable; Phase-2 fix would add a `refreshDocument` method to `AppShellContext`.

**All Day 7 work (7A–7D) committed to `main` by 2026-04-22 start of day.** User confirmed via `/context` at session start.

### Day 8 ✅ — components/ folder reorganization *(2026-04-22)*

Organizational refactor only — zero behavior changes, zero TS/ESLint errors. Split the flat 23-file `web/components/` directory into 5 semantic subfolders using `git mv` so history is preserved as renames (walk git blame/log --follow through any component to see its Day 2–7 lineage).

- **`components/ui/`** — 5 reusable primitives (button, error-banner, skeleton, toast, type-popover). Zero domain knowledge.
- **`components/layout/`** — 3 chrome components (app-shell, sidebar, topbar). Shared across all routes.
- **`components/document/`** — 10 components related to document viewing, uploading, and listing. `review-stage` lives here even though it composes Inspector, because the review experience is framed around the document.
- **`components/inspector/`** — 2 components (inspector + inspector-field). The right-pane field editor.
- **`components/modal/`** — 3 portal dialogs (delete-template, name-field, save-template).

Import path updates: 6 `@/components/*` imports across `app/**` + 13 cross-subfolder relative imports across components (mostly `./button` → `../ui/button`). Same-folder imports kept as `./<sibling>` to avoid noise.

**Consulted for planning**: [GitHub awesome-copilot Next.js instructions](https://github.com/github/awesome-copilot/blob/main/instructions/nextjs.instructions.md) + Next.js official App Router docs via context7. Both align on feature/type subfolder split with kebab-case folder names + CSS Module colocation. We explicitly skipped (per user preference): top-level `hooks/` and `contexts/` folders (too few files), `_components/` app-directory colocation (all components are cross-route), `index.ts` barrel files (tree-shaking + TS perf penalty), and renaming files to PascalCase (project-wide kebab-case consistency matters more).

**Committed state after Day 8:** pending user commit at end of session. Suggested message: `refactor: organize components/ into feature subfolders`.

### Day 9 🔄 *(in progress)* — CSS Modules → Tailwind v4 migration *(2026-04-22)*

Pulled forward from Phase-2 (deferred) to Phase-1 (pre-demo) after user flagged intermittent "random FOUC / broken styling" bugs during local dev — the HMR race between Next.js 15 + pnpm + CSS Modules was producing occasional missing-styles reloads. Moving to Tailwind compiles to a single deterministic stylesheet, eliminating the race. Demo date **moved from 2026-04-27 to 2026-04-29** to accommodate the migration.

**Constraints the user set:**
- UI must remain **pixel-identical** — user explicitly likes the current look. Visual regressions are unacceptable. Tailwind compiles to CSS; mechanical translation can preserve exact output, but requires discipline.
- Clean, readable, well-structured, industry-standard code.
- **Plain `cn()` only** — no `tailwind-variants`, no `tailwind-merge`. Tried both; user asked "are they necessary?" and we agreed they were not. `lib/cn.ts` stays as a pure `clsx` wrapper.
- **No shadcn/Radix.** Claude chose against it — forcing component structure changes through shadcn primitives risked visual drift on an app with a strong custom aesthetic. Plain Tailwind utilities against our existing component structure is safer.

**Migration order:** `ui/` → `layout/` → `modal/` → `document/` (split into Sub-batch A and B) → `inspector/` → full-app verification.

**Completed this session:**
- **`ui/` (5 files, 5 `.module.css` deleted)** — button, error-banner, skeleton, toast, type-popover. Established the base translation patterns: variant classes inlined via ternary conditionals in `cn()`, `hover:enabled:` for `:hover:not(:disabled)`, `motion-reduce:` variant for WCAG 2.3.3, arbitrary outline shorthand `outline-[2px_solid_var(--color-err)]`.
- **`layout/` (3 files, 3 `.module.css` deleted)** — app-shell, sidebar, topbar. Replaced `.parent:hover .child` descendant selectors with Tailwind `group` / `group-hover:` / `group-focus-within:` pattern. Brand mark (topbar) gradient + inset shadow extracted to a `MARK_STYLE` inline-style constant (too gnarly as arbitrary classes, rendered once).
- **`modal/` (3 files, 3 `.module.css` deleted)** — delete-template-modal, name-field-modal, save-template-modal. Promoted `scrim-fade` and `modal-pop` keyframes to `@theme` in `globals.css` as single-source `--animate-*` tokens. Established file-scoped class constants pattern (`LABEL_CLASS`, `INPUT_CLASS`, `SEG_BASE/ACTIVE/INACTIVE`, `TEXTAREA_CLASS`, `DANGER_BTN_CLASS`) for class lists repeated within one file.
- **`document/` Sub-batch A (9 files, 8 `.module.css` deleted — loader had none)** — upload-stage, document-list, document-placeholder, document-pane, review-stage, pdf-document-view, parsing-overlay, drawing-layer, document-loader (no-op). Most intricate move: the react-pdf `:global(.react-pdf__Page__canvas)` CSS Modules selector → plain global rule in `globals.css` (idiomatic vendor-class override). Row hover in document-list table uses `group` on `<tr>` + `group-hover:bg-accent-weak` on each `<td>` rather than stacking `hover:[&>td]:` arbitrary variants. `radial-gradient` dropzone background (upload-stage) kept as `STAGE_BG` inline style — the stacked shorthand was too ugly as a Tailwind arbitrary. `parsing-overlay` step states use mutually exclusive ternaries (`state === "done" ? "text-ink" : state === "current" ? "..." : "text-ink-3"`) to avoid CSS source-order conflicts from stacking conflicting utilities (we can't rely on twMerge to resolve them). `blink` keyframe promoted to `@theme` as `--animate-blink` for the current-step pulsing dot.

**Build + lint state after Sub-batch A:** `pnpm build` clean in 3.0s, `pnpm lint` zero warnings. All five migrated batches produced identical clean builds (2.5s–3.6s each).

**Still to migrate (Day 9 remaining work):**
- **`document/` Sub-batch B** — `bounding-box-overlay.tsx` + `.module.css`. Isolated intentionally because it's the one file doing spatial math (percent-based `top`/`left`/`width`/`height` absolute positioning derived from `polygonToPercentBBox`). Translation needs a side-by-side visual check of bbox alignment before and after — the rest of Sub-batch A was forgiving of minor class misses, but this one isn't. Inline `style` for positioning should stay; only the class-driven styling (border color, confidence tints, hover tag) migrates.
- **`inspector/` (2 files)** — inspector.tsx + inspector-field.tsx. Largest remaining surface area. Type popover + inline-edit styling interact with the already-migrated `ui/type-popover.tsx`, so patterns are established.
- **`app/page.module.css`** — thin home-page banner-slot wrapper. Check if still needed (may have become vestigial after Sub-batch A changes to `UploadStage`).
- **Final cleanup** — verify zero `.module.css` files remain in components/, confirm `global.d.ts`'s `declare module "*.css"` can be dropped (only needed for the `import styles from "./x.module.css"` pattern; the `./globals.css` side-effect import still requires it, so likely keep).

**Committed state through Day 9:** uncommitted. Suggested message for the current progress: `refactor: migrate ui/layout/modal + document sub-batch A to Tailwind v4`. Let user decide whether to commit now or hold for the full migration.

---

## 6. What's next — pre-demo runway

Demo is **2026-04-29** (7 days out as of 2026-04-22 — moved back from 2026-04-27 to accommodate the Day 9 styling migration). All three core value props are functional (parse, correct, teach-via-template), URL routing works, history page exists, template deletion works, polish pass done, components/ folder reorganized, Tailwind migration in progress.

### Demo-critical (do first)

1. **Seed 2–3 realistic demo documents.** Currently declined in favor of polish, but the history page now looks empty without prior uploads. The cross-vendor template-matching story lands better with at least one vendor appearing twice (first upload creates template, second auto-matches) plus a second vendor that doesn't match. Options discussed:
   - **Startup seeder** (recommended) — new `DatabaseSeeder` class that runs on `app.Start()`. If `Documents.Count == 0` and a `Seed:Enabled` config flag is true, reads PDFs from `api/samples/seed/`, runs each through `IDocumentIntelligenceService`, creates Document + Template records. One-time Azure DI cost (~$1–2), then cached forever in SQLite. Reuses the real pipeline.
   - **Pre-captured JSON snapshots** — zero Azure calls at seed time, more upfront setup. Bulletproof for demo-day outages.
   - **Shell script calling `/api/documents/upload`** — not idempotent, requires remembering to run it.

### Demo-nice-to-have (if time)

2. **Search / filter on the documents table.** Filename search, template-match filter, sortable columns. DocumentList is presentation-only today — the table rows are static.
3. **Fix template-delete staleness for the currently-viewed document.** Add `refreshDocument` to `AppShellContext`; DocumentLoader exposes it. Sidebar's delete handler calls it when `activeTemplateId === deletedId`.
4. **Line Items dedicated renderer.** Azure DI's `Items` field is a list-of-dictionaries currently shown as raw content. Design mock has a mini-table in the Inspector.

### Deferred to Phase 2 (post-demo)

- **~~Migrate CSS Modules → Tailwind.~~** Pulled into Phase 1 as Day 9 (in progress as of 2026-04-22 — see §5 Day 9 and §11 "Where we left off"). Decision against shadcn/Radix stands: forcing our custom components through shadcn primitives risked visual drift. Plain Tailwind v4 + `cn()` (clsx-only) is the final shape. `tailwind-variants` and `tailwind-merge` were both tried and rejected.
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

**Next.js 15 dynamic `params` are a Promise.** `/documents/[id]/page.tsx` receives `params: Promise<{ id: string }>` and must unwrap with React 19's `use()` — destructuring directly throws. Kept as a client component so `use()` works naturally; server components would need the same `use()` call with `await`.

**`usePathname()` requires `"use client"` at the top of the file that calls it.** Sidebar's active-state detection uses `usePathname()` + `next/link`. When rendered inside another client boundary (AppShell), it works only because the file itself is also marked client. Deriving active state from router state (not internal sidebar view state) is the industry-standard Next.js App Router pattern.

**Primary button hover must re-set `background`.** The generic `.btn:hover` rule sets `background: var(--color-surface-2)` (near-white) and `color: var(--color-ink)` (dark). A `.primary:hover` that only overrides `filter` + `color` leaks the white background through → white-on-white text. `.primary:hover` must set an explicit darker accent background. Bug fixed 2026-04-21.

**Nested `<button>` inside `<button>` is invalid HTML.** Template cards needed a hover-reveal trash inside a clickable card. Fix: make the outer a `<div role="button" tabIndex={0}>` with an Enter/Space keyboard handler, then nest a real `<button>` for the trash. Also applies to any future "card with multiple interactive actions" pattern.

**Skeleton primitives must respect `prefers-reduced-motion`.** `@media (prefers-reduced-motion: reduce) { .skeleton { animation: none; opacity: 0.75; } }` — holds visible placeholder without strobing. WCAG 2.3.3. Applied globally via `skeleton.module.css`.

**Inline error banner vs toast — pick one per error.** Toasts (`showToast`) are transient confirmations (field saved, template created, "matched to X"). Inline `<ErrorBanner>` (role="alert") is for persistent errors the user must acknowledge (upload failures, fetch errors). Never double-announce — it reads as noise.

### Tailwind v4 (Day 9 migration lessons)

**`cn()` is clsx-only — no twMerge.** `lib/cn.ts` wraps `clsx` directly. That means conflicting Tailwind utilities stacked in the same className (e.g., `text-ink-2 text-accent-ink`) both land in the output and resolve by CSS source order — which is unpredictable. **Fix pattern: mutually exclusive ternaries.** Write `active ? "text-accent-ink" : "text-ink-2"` so only one utility lands. Never stack conflicting width/color/bg utilities hoping twMerge will sort them — it won't, we don't use it.

**`outline-<N> outline-<color>` doesn't render an outline.** Tailwind v4 sets width and color but `outline-style` defaults to `none` — net effect is invisible. For focus-visible rings on destructive/form elements, use the arbitrary shorthand: `outline-[2px_solid_var(--color-err)]`, `outline-[2px_solid_var(--color-accent)]`. Discovered when the DeleteTemplateModal focus ring didn't render.

**Underscores in arbitrary values become spaces.** `text-[color-mix(in_oklab,var(--color-accent)_88%,black)]` — the `_` between tokens is compiled to a space. If a literal `_` is needed (e.g., a vendor class like `react-pdf__Page__canvas`), escape with `\_` inside the arbitrary, **or** sidestep by writing it as a plain global rule in `globals.css`. We chose the latter for `react-pdf__Page__canvas` — idiomatic for vendor overrides, consistent with `::-webkit-scrollbar` already there.

**`hover:enabled:` is the canonical `:hover:not(:disabled)`.** Use `hover:enabled:bg-surface-2` for interactive elements that can be disabled. Avoids needing a custom variant.

**`motion-reduce:` replaces the `@media (prefers-reduced-motion: reduce)` block.** `motion-reduce:animate-none motion-reduce:opacity-75` on the Skeleton. WCAG 2.3.3 behavior preserved without a bespoke CSS Modules rule.

**Animations live in `@theme` as `--animate-<name>`.** Pattern: add `--animate-foo: foo 0.2s ease;` inside `@theme { ... }`, declare the `@keyframes foo { ... }` nested in the same `@theme` block. Tailwind generates the `animate-foo` utility automatically. Used for `skeleton-pulse`, `toast-in`, `scrim-fade`, `modal-pop`, `blink`. Do not re-declare these keyframes per module — single source of truth.

**`group` / `group-hover:` / `group-focus-within:` replaces `.parent:hover .child` descendant selectors.** Sidebar template card's hover-reveal trash, document-list row hover tint, and nested-button reveals all use this. For "last in a list" styling (e.g., drop the bottom border on the final row), `group-last:` works on the child if the parent carries `group` — we use this for `BODY_CELL` in document-list.

**Complex one-off values stay as inline `style={...}`.** The dot-grid `radial-gradient` in upload-stage (`STAGE_BG`), the brand-mark gradient + inset shadow in topbar (`MARK_STYLE`), and the dynamic bbox/draw-preview percentages all use inline style. Cramming them into `bg-[...]` arbitraries makes the className unreadable. Rule of thumb: if the value has commas/parens and isn't reused, inline-style it as a module-scoped constant.

**Form elements need explicit `font-ui`.** Browsers apply UA default system fonts to `<input>` / `<select>` / `<button>` / `<textarea>`. The CSS Modules approach used `font: inherit`; the Tailwind equivalent is a class `font-ui` that sets `var(--font-ui)`. Forgetting this makes inputs render in system-ui while the rest of the app uses Inter.

**File-scoped class constants are the abstraction layer.** No shared cross-file "class library" (YAGNI). Per-file consts like `LABEL_CLASS`, `INPUT_CLASS`, `SEG_BASE/ACTIVE/INACTIVE`, `NAV_ITEM_BASE`, `DANGER_BTN_CLASS`, `BODY_CELL`, `CARD_WRAPPER`, `PANEL_CLASS` capture class lists that repeat within one component. If a pattern shows up in three files, consider lifting — otherwise keep local.

**Vendor class overrides live in `globals.css`, not Tailwind.** The `:global(.react-pdf__Page__canvas) { display: block }` rule moved out of CSS Modules into `globals.css` as a plain global. Same pattern used for `::-webkit-scrollbar`. Keeps third-party class names out of our component JSX.

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

**2026-04-22 end of Day 9 mid-migration session** (same calendar day as Day 8 — two sessions back-to-back):

- Days 1–8 complete. Day 9 (Tailwind migration) is **in progress**, not complete. Stopped mid-migration at user's explicit request to defer the remaining document/ + inspector/ work.
- **Demo moved to 2026-04-29** (was 2026-04-27) to absorb the migration's scope. Confirmed by user at start of Day 9 session.
- **Why the migration got pulled forward:** user reported occasional "weird HTML website with no styling" flashes during local dev — the HMR race between Next.js 15 + pnpm dev server + CSS Modules hash handling. Tailwind compiles to a single deterministic stylesheet, eliminating the race. Not a speculative refactor; a real stability fix.

### Day 9 migration status (as of this session end)

| Batch | Files | `.module.css` deleted | Status |
|---|---|---|---|
| `ui/` | button, error-banner, skeleton, toast, type-popover | 5 | ✅ |
| `layout/` | app-shell, sidebar, topbar | 3 | ✅ |
| `modal/` | delete-template-modal, name-field-modal, save-template-modal | 3 | ✅ |
| `document/` Sub-batch A (low-risk) | upload-stage, document-list, document-placeholder, document-pane, review-stage, pdf-document-view, parsing-overlay, drawing-layer, document-loader | 8 (loader had none) | ✅ |
| `document/` Sub-batch B | `bounding-box-overlay.tsx` + `.module.css` | — | ⏳ pending |
| `inspector/` | inspector, inspector-field | — | ⏳ pending |
| `app/` | `page.module.css` (home-page banner slot) | — | ⏳ pending — check if still referenced |
| Final cleanup | verify zero leftover `.module.css`, evaluate `global.d.ts` | — | ⏳ pending |

**Every completed batch passed clean `pnpm build` (2.5–3.6s) and `pnpm lint` (zero warnings).** No TypeScript errors. No user-reported visual regressions (user confirmed visual parity after each batch's review).

### Key Day 9 decisions + patterns (see also §7 Tailwind v4 section)

- **No shadcn/Radix.** Plain Tailwind utilities against our existing component structure.
- **No `tailwind-variants`, no `tailwind-merge`.** Plain `cn()` (`clsx` wrapper).
- **Mutually exclusive ternaries for conflicting utilities** (since we can't rely on twMerge to resolve conflicts).
- **Animations in `@theme` as `--animate-*` tokens** (skeleton-pulse, toast-in, scrim-fade, modal-pop, blink).
- **File-scoped class constants** for repeated class lists within one file (`LABEL_CLASS`, `INPUT_CLASS`, `SEG_BASE/ACTIVE/INACTIVE`, `TEXTAREA_CLASS`, `NAV_ITEM_BASE`, `DANGER_BTN_CLASS`, `BODY_CELL`, `CARD_WRAPPER`, `PANEL_CLASS`, `LINK_CLASS`, `MARK_STYLE`, `STAGE_BG`).
- **`group` / `group-hover:` / `group-last:` / `group-focus-within:`** replaces `.parent:hover .child` descendant selectors.
- **Complex single-use values stay as inline `style={...}` constants** — radial-gradient dot background, gradient brand mark, dynamic bbox percent positions.
- **Vendor class overrides in `globals.css`, not Tailwind** — `.react-pdf__Page__canvas` is a plain global rule alongside `::-webkit-scrollbar`.

### First actions for the next session

1. **Ask the user whether to commit current Day 9 progress now or wait for the full migration.** Suggested intermediate message: `refactor: migrate ui/layout/modal + document sub-batch A to Tailwind v4`.
2. **Tackle `document/` Sub-batch B next** (`bounding-box-overlay.tsx`). Isolate this change, build after, and visually verify bbox alignment against a real uploaded PDF before declaring done. The inline `style` percent positioning should stay; only class-driven styling migrates. Reference the file's existing use of `polygonToPercentBBox` to understand the position math before touching anything.
3. **Then `inspector/`** — largest remaining surface. Type popover interactions with `ui/type-popover.tsx` are already migrated, so the inspector-field popover glue should be straightforward.
4. **Then `app/page.module.css` check** — may have become vestigial after upload-stage's Sub-batch A change. If nothing references it, delete.
5. **After full migration: final sweep.** Verify zero `.module.css` under `components/`, check whether `global.d.ts`'s `declare module "*.css";` ambient can be narrowed or removed (the `./globals.css` side-effect import still needs it, so likely keep as-is but document why).
6. **Confirm UI pixel parity.** User will review after each batch — this has been the rhythm throughout Day 9. Keep doing it; don't batch multiple folders into a single review.
7. **Do NOT let the migration leak into feature work.** Seed data (§6 item 1) is still a real demo-runway gap. After Day 9 finishes, pivot to seeding before polishing more.
8. `use context7` for any Tailwind v4 / Next.js 15 / React 19 uncertainty (user consistently reminds).

### Open deferred items (for reference)

- **Finish Day 9 migration** — Sub-batch B + inspector/ + final cleanup. Highest priority; blocks any further styling work.
- **Seed demo documents** — §6 item 1, highest post-migration priority.
- **Search / filter on documents table** — §6 item 2.
- **Template-delete staleness** — §6 item 3; minor, affects only the open-document topbar badge.
- **Line Items table special-render** — Phase 2 per long-standing note.
- **Revert button** — Phase 2 per Day 7 triage; needs per-field history or re-run of Azure DI.

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
- Don't nest `<button>` inside `<button>`. Use `<div role="button" tabIndex={0}>` + Enter/Space handler when a card needs a nested interactive child (Day 7D lesson).
- Don't duplicate error announcements. Toast **or** banner — never both for the same failure (Day 7C lesson).
- Don't forget `prefers-reduced-motion` on animated skeletons. WCAG 2.3.3 (Day 7C lesson).
- Don't destructure Next.js 15 dynamic `params` directly — they're a Promise, use React 19 `use()` (Day 7A lesson).
- Don't derive active-sidebar state from internal component state when the route already tells you — use `usePathname()` + `next/link` (Day 7B lesson).
- Don't override only `color` + `filter` on a primary-button hover — must explicitly set `background` to beat the generic `.btn:hover` (Day 7B bug lesson).
- Don't double-dispatch `setActiveDocument(null)` across separate effects with the same deps — split sync-on-state and clear-on-unmount into two effects to avoid a null-flash through the topbar (Day 7A lesson).
- Don't call `notFound()` inside a `useEffect`. Call it during render from a client component — Next.js' App Router requires that (Day 7A lesson).
- Don't reintroduce `tailwind-variants` or `tailwind-merge`. Both were tried on 2026-04-22 and rejected — `cn()` stays as a pure `clsx` wrapper (Day 9 lesson).
- Don't adopt shadcn/ui or Radix primitives. Considered and declined — the custom aesthetic outweighs the reusability win, and forcing our components through shadcn structure risks visual drift (Day 9 decision).
- Don't stack conflicting Tailwind utilities in the same className (e.g., `text-ink-2` + `text-accent-ink`). Without twMerge, CSS source order decides the winner unpredictably. Use mutually exclusive ternaries (Day 9 lesson).
- Don't use `outline-<N> outline-<color>` alone for focus rings — `outline-style` defaults to `none` so nothing renders. Use `outline-[2px_solid_var(--color-x)]` arbitrary shorthand (Day 9 lesson).
- Don't re-declare keyframe animations inside individual CSS Modules. Promote them to `@theme` in `globals.css` as `--animate-<name>` tokens so they auto-generate a utility (Day 9 pattern).
- Don't cram long multi-value CSS (radial-gradient stacks, composite box-shadows) into `className="bg-[...]"` arbitraries. Extract to a module-scoped inline-style constant — readability wins (Day 9 pattern).

---

_Last updated: 2026-04-22 mid-Day-9 (Tailwind migration in progress). Completed batches: `ui/`, `layout/`, `modal/`, `document/` Sub-batch A (9/10 files). Pending: `document/` Sub-batch B (bounding-box-overlay), `inspector/`, `app/page.module.css`, final cleanup. Day 8 commit + Day 9 progress both uncommitted. shadcn/Radix and `tailwind-variants` / `tailwind-merge` all evaluated and rejected — plain Tailwind v4 + `cn()` (clsx) is the final shape. Demo moved to 2026-04-29 (7 days out)._
