# Document Parsing Service — Project Context

> **Purpose of this file:** full handoff context for a future Claude session so it can pick up where we left off without asking the user to re-explain. Read this, then `memory/MEMORY.md` for persisted user + project memories, then the code.

---

## 1. Product vision

An **all-in-one document parsing SaaS** for multiple industries with a **correction + save-as-template workflow** as the differentiator. The user upload flow:

1. Drop a document (PDF/image) → AI extracts structured fields.
2. Review a side-by-side view (document on left, fields on right), with bounding boxes showing what was detected.
3. Correct mistakes inline, change data types, mark fields required/optional, draw a box over a missed region to "teach" the AI.
4. Save those corrections as a **template** — future uploads of the same layout auto-apply the corrections.

Stretch features under consideration (post-demo): Microsoft Teams app integration, e-signature routing via Teams, compliance verification layer (insurance / mortgage verticals).

**Target demo date:** ~2026-04-27 (one week from project kickoff 2026-04-20), external audience from other companies → UI polish matters.

---

## 2. User profile

- Email: `marketing@taia.us` (product/marketing-adjacent, but actively planning implementation)
- Prefers **Microsoft ecosystem** (C#/.NET, Azure) but open to right-tool-for-the-job (we're on Next.js for the frontend)
- Wants **clean, readable, well-structured code** following industry best practices — not just something that works
- Treats this as a prototype; is fine accepting prototype-level tradeoffs (progressive enhancement, stopgaps documented as TODOs)
- Uses **pnpm** on the frontend (not npm), Windows + Git Bash + VS Code
- **Security preference:** secrets must never reach chat context. Use `.env` (gitignored) for frontend, `dotnet user-secrets` for backend. See "Security notes" below.
- Frequently says `use context7` — prefers verified library docs over trained knowledge for library-specific code.

---

## 3. Tech stack (locked in)

### Backend — `api/`
| Layer | Choice |
|---|---|
| Runtime | **.NET 10** (SDK 10.0.201) |
| Framework | **ASP.NET Core 10 Web API**, Controllers (not Minimal APIs) |
| AI | **Azure AI Document Intelligence v4** (`Azure.AI.DocumentIntelligence` 1.0.0 SDK), prebuilt-invoice model |
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
| Styling | **Tailwind CSS v4** (`@theme` directive, no `tailwind.config.ts`) + **CSS Modules** for component-scoped complex styles |
| Icons | `lucide-react` |
| PDF rendering | **`react-pdf` 9.2.1** + **`pdfjs-dist` 4.x** (NOT 10.x — see "Known gotchas") |
| Utility | `clsx` via `lib/cn.ts` |
| Fonts | Inter + JetBrains Mono via `next/font/google` |
| Package manager | **pnpm** (`pnpm-lock.yaml` is source of truth) |

### Azure resources
- **Document Intelligence resource**: `taia-ams-docai` in East US (shared org resource — provisioned by user's lead dev)
- Endpoint: `https://taia-ams-docai.cognitiveservices.azure.com/`
- Key stored via `dotnet user-secrets set "DocumentIntelligence:Key" "..."` — **never in `appsettings.json`**
- **Note:** KEY 1 was leaked into chat context on 2026-04-20 twice (once in a message, once via `appsettings.json`). Both times the user rotated. If a future session sees a key in chat, treat it as compromised and ask them to rotate.

---

## 4. Architecture

```
document-parsing/
├── api/                          ASP.NET Core 10 Web API (port 5180)
│   ├── Contracts/                Request/response DTOs
│   │   └── DocumentResponse.cs
│   ├── Controllers/
│   │   └── DocumentsController.cs  (POST /upload, GET, GET /:id, GET /:id/file)
│   ├── Data/
│   │   └── AppDbContext.cs       EF Core context (Documents, ExtractedFields)
│   ├── Models/
│   │   ├── Document.cs
│   │   └── ExtractedField.cs
│   ├── Services/
│   │   ├── IDocumentIntelligenceService.cs
│   │   ├── DocumentIntelligenceService.cs   Wraps Azure DI SDK
│   │   └── DocumentIntelligenceOptions.cs   Config binding
│   ├── Properties/launchSettings.json        HTTP on :5180
│   ├── appsettings.json                      Empty endpoint/key (placeholders)
│   ├── appsettings.Development.json.example
│   ├── DocParsing.Api.csproj                 Contains UserSecretsId
│   ├── DocParsing.Api.http                   Manual test requests
│   ├── Program.cs                            Composition root, CORS, OpenAPI, EnsureCreated
│   ├── app.db                                (gitignored) SQLite file
│   └── uploads/                              (gitignored) uploaded originals
│
├── web/                          Next.js 15 (port 3000)
│   ├── .npmrc                    pnpm hoist-pattern for pdfjs-dist — REQUIRED
│   ├── app/
│   │   ├── app.module.css        shell grid layout
│   │   ├── globals.css           Tailwind v4 @theme tokens (OKLCH)
│   │   ├── layout.tsx            next/font loaders for Inter + JetBrains Mono
│   │   └── page.tsx              phase state machine (upload | parsing | review)
│   ├── components/
│   │   ├── bounding-box-overlay.{tsx,module.css}  Confidence-colored bboxes w/ hover tags
│   │   ├── button.{tsx,module.css}                Reusable btn (4 variants) + Kbd
│   │   ├── document-pane.{tsx,module.css}         Toolbar + dynamic import boundary
│   │   ├── field-list-simple.{tsx,module.css}     Day-3 placeholder w/ selection sync
│   │   ├── parsing-overlay.{tsx,module.css}       Progress card
│   │   ├── pdf-document-view.{tsx,module.css}     react-pdf integration (SSR-skipped)
│   │   ├── review-stage.{tsx,module.css}          Composes DocumentPane + FieldList
│   │   ├── sidebar.{tsx,module.css}               Nav + template library
│   │   ├── toast.{tsx,module.css}
│   │   ├── topbar.{tsx,module.css}
│   │   └── upload-stage.{tsx,module.css}          Dropzone w/ drag-drop
│   ├── lib/
│   │   ├── api-client.ts         uploadDocument, listDocuments, getDocument, fileUrl
│   │   ├── bbox.ts               polygon→percent math, confidenceLevel
│   │   ├── cn.ts                 clsx wrapper
│   │   ├── constants.ts          FIELD_TYPES, CONFIDENCE_THRESHOLDS, PLACEHOLDER_TEMPLATES
│   │   └── types.ts              DocumentResponse, ExtractedField, etc.
│   ├── next.config.ts            Minimal (user stripped back to reactStrictMode only)
│   ├── postcss.config.mjs        @tailwindcss/postcss
│   └── package.json              See "Tech stack" for pinned versions
│
├── context/                      (this folder)
│   └── PROJECT_CONTEXT.md
├── memory/                       Claude's persisted user/project memories (separate from context)
├── samples/                      (gitignored) Microsoft's public sample invoice PDF
├── Document Parsing Service Prototype-handoff/  (gitignored) Claude Design export used as visual reference
├── document-parsing.sln
├── README.md
└── .gitignore
```

### Runtime request flow

1. User drops PDF → `web/components/upload-stage.tsx`
2. `POST http://localhost:5180/api/documents/upload` (multipart)
3. API saves file to `uploads/<guid>-<filename>`, records `Document(Analyzing)`, calls Azure DI with `prebuilt-invoice`
4. Azure DI returns `AnalyzeResult` with bounding polygons (in **inches** for PDFs) + confidence
5. Server persists `ExtractedField` rows with `BoundingRegionsJson`, sets `Document.Status=Completed`, returns `DocumentResponse` (camelCase JSON)
6. Client transitions `phase: parsing → review`, renders PDF + overlay + field list

### Coordinate math (get this right or bboxes misalign)

- Azure DI returns polygon as `number[]` of `[x1,y1,x2,y2,x3,y3,x4,y4]` — unit is **inches** for PDFs.
- pdf.js `page.getViewport({ scale: 1 }).width` returns **PDF points** (72 points = 1 inch).
- Convert to percentages of page size so bboxes stay aligned at any zoom: `percent = (polygon_inches / (viewport_points / 72)) × 100`.
- This lives in `web/lib/bbox.ts` (`polygonToPercentBBox`). Don't re-derive.
- **Gotcha:** react-pdf's `onLoadSuccess` callback passes `page.width`/`page.height` as the **rendered pixel** dimensions, not native. Use `page.getViewport({ scale: 1 })` for native.

---

## 5. Build progress — what's done

### Day 1 ✅ — Backend round-trip
- ASP.NET Core API scaffolded, Azure DI integrated
- `POST /api/documents/upload` works end-to-end (upload → Azure DI → SQLite → response)
- Basic Fluent UI frontend (later replaced)

### Day 2 ✅ — Design system + UI shell
- **Dropped Fluent UI** (Griffel shorthand pain, didn't fit the custom design)
- Adopted Claude Design's mock (in `Document Parsing Service Prototype-handoff/`) 1:1
- Ported OKLCH color tokens into Tailwind v4 `@theme` block in `app/globals.css`
- Built: Topbar, Sidebar (nav + template library), UploadStage (dropzone), ParsingOverlay (progress card), Toast
- Added `next/font/google` for Inter + JetBrains Mono

### Day 3 ✅ — PDF viewer + bounding-box overlay (JUST COMPLETED)
- Installed `react-pdf` + `pdfjs-dist`
- Built: `DocumentPane` (toolbar + zoom + dynamic-import boundary), `PdfDocumentView` (react-pdf wrapper, SSR-skipped via `next/dynamic`), `BoundingBoxOverlay` (color-coded bboxes w/ hover tags + click-select), `FieldListSimple` (interim right-pane w/ selection sync), `ReviewStage` (composes left + right, owns `selectedFieldId`)
- Confidence coloring: green ≥90%, amber 70–89%, red <70% (+ `!` badge)
- Low-confidence corner badge matches design mockup
- Click a bbox → field row scrolls into view + highlights
- Click a field row → bbox glows
- Zoom in/out, bboxes stay perfectly aligned (percent-based positioning)

**Current state: working end-to-end with accurate bbox placement. Natural commit checkpoint.**

---

## 6. What's next — Day 4+

### Day 4 — Inspector + inline editing (NEXT SESSION)
Replace `FieldListSimple` with the full Inspector from the mock (`inspector.jsx`):
- Header with "Parsed fields" title + template indicator
- 3-up stats (Total Fields / To Review / Missing Req.)
- Search box + filter pills (All / Issues / Required)
- Fields grouped by `group` (Document / Parties / Totals / Custom)
- Per-field row: label, REQ badge, type chip (popover → FIELD_TYPES), require/delete icons, click-to-edit value (inline input, Enter = commit, Esc = cancel), flag chips
- Line items mini-table
- Footer: Revert + Save-as-template buttons

**Backend needed:** `PATCH /api/documents/:id/fields/:fieldId` endpoint that updates value/type/required, sets `IsCorrected=true`, `CorrectedAt=utcnow`.

### Day 5 — Draw-a-box + NameFieldModal
- Enable the "Draw field" button in `DocumentPane` toolbar (currently disabled w/ "Coming in Day 4" tooltip — rename to Day 5)
- In draw mode: cursor: crosshair on page, click+drag to draw a rectangle (percent coords)
- On mouseup → `NameFieldModal` (from `modals.jsx`): field name input, data type dropdown, required toggle
- Save → `POST /api/documents/:id/fields` with name, type, required, bbox
- Backend: create `ExtractedField` with `IsCorrected=true`, no Azure DI regions

### Day 6 — Save-as-template
- `SaveTemplateModal` (from `modals.jsx`): name, kind, description, apply-to segment, field rules list
- Backend: new `Templates` table + `POST /api/templates`, `GET /api/templates`
- Sidebar template library reads from API (currently hardcoded `PLACEHOLDER_TEMPLATES`)
- Simple template matching on upload: filename heuristic or vendor match (prebuilt-invoice already extracts `VendorName`). Don't attempt Azure custom-model training yet (needs 5+ samples — stretch goal).

### Day 7 — Polish + demo
- Empty states, loading states, error banners
- Seed 2–3 demo invoices (either customer-supplied redacted real ones, or the Microsoft sample in `samples/`)
- Demo script walkthrough, fix rough edges
- Consider: swap out "Draw field" keyboard shortcut `B` for something more discoverable

### Post-demo (Phase 2)
- Microsoft Teams tab wrapper (Fluent UI re-skin likely needed)
- E-signature routing via Teams
- Compliance verification layer (see `memory/project_compliance_doc_idea.md`)
- Azure custom-model training once a template accumulates 5+ samples (background job)
- Move storage from SQLite/local FS to Azure SQL + Blob

---

## 7. Known gotchas & their fixes (DO NOT re-encounter)

### Backend

**`DocumentFieldType` is not a C# enum.**
Azure DI SDK exposes it as an extensible-enum struct. Can't be used in `switch` case labels. Use `if (type == DocumentFieldType.X)` chain. Don't try `ValueLong` or `DocumentFieldType.Long` — use `ValueString`, `ValueCurrency`, or fall back to `field.Content`.

**`DbUpdateConcurrencyException` on double-save.**
Original code called `SaveChangesAsync` once on insert (with Status=Analyzing), then again after Azure DI returned (with Status=Completed + added ExtractedFields). Replacing the navigation collection between saves confused EF's change tracker. **Fix:** build the entity graph fully before any DB work, then single `Add` + single `SaveChangesAsync`.

**Secrets rotation.**
User Secrets is the canonical path. `dotnet user-secrets set "DocumentIntelligence:Key" "..."` in `api/`. `appsettings.json` stays with empty strings. The first key leak (chat message) and second (`appsettings.json` edit) were both rotated.

### Frontend

**Dropped Fluent UI entirely.**
Griffel (Fluent's styling engine) rejects CSS shorthands (`border`, `padding`, `gap`, `overflow`, `transition`, `borderColor`, etc.). Also didn't fit the custom design. Replaced with Tailwind v4 + CSS Modules.

**pnpm needs `.npmrc` hoist for pdfjs-dist.**
Without `public-hoist-pattern[]=*pdfjs-dist*` in `web/.npmrc`, pnpm's isolated module store puts pdfjs-dist where Webpack can't cleanly resolve it. File already exists — do not remove.

**react-pdf 10.x + pdfjs-dist 5.x breaks under Next.js 15 + Webpack.**
Symptom: `Object.defineProperty called on non-object` at `pdf.mjs` module load. Fix (that works): downgrade to `react-pdf: ^9.2.1` + `pdfjs-dist: ^4.8.69`. The documented "`devtool != eval-*`" Webpack workaround is flaky in practice; the downgrade is the reliable path. Don't "upgrade" back to 10.x without verifying the upstream fix.

**pdfjs worker path — use CDN for stability.**
`pdf-document-view.tsx` uses `https://unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`. The `import.meta.url`-based path is brittle under Next.js. If a future session wants to self-host for prod, copy the worker to `public/` and point at `/pdf.worker.min.mjs`.

**Bbox alignment — always use `getViewport({ scale: 1 })`.**
The `page.width`/`page.height` properties in react-pdf's `onLoadSuccess` callback are the **rendered** (scaled) dimensions, not native. Must use `page.getViewport({ scale: 1 }).width` for PDF points. See `pdf-document-view.tsx` `handlePageLoad`.

**API response casing.**
ASP.NET Core's default `JsonNamingPolicy.CamelCase` applies to response properties. Frontend types are camelCase. If the DB stores JSON blobs (e.g. `BoundingRegionsJson`), those preserve PascalCase internally but get case-insensitively deserialized + re-serialized to camelCase on the wire. Don't mix.

**Next.js config cache.**
`next.config.ts` changes don't hot-reload. Stop dev server AND `rm -rf .next` (webpack cache).

### Environment

**Mixed lockfiles.**
pnpm is the source of truth. If `package-lock.json` ever reappears in `web/`, delete it — it means someone ran `npm install` by mistake. Confirm via `ls web/node_modules/.pnpm` (should exist).

**pdfjs-dist 5.4.296 vs 5.6.205 nested.**
You may see two `pdfjs-dist` versions in pnpm's `.pnpm/` store. Currently on the 4.x line after downgrade; if you see 5.x versions in node_modules, the downgrade didn't take — reinstall.

---

## 8. Security notes

- **Never read `.env*` files** in this project. User said so explicitly; see `memory/feedback_no_env_reads.md`.
- Secrets go in `dotnet user-secrets` (backend) or `.env.local` (frontend, only `NEXT_PUBLIC_*` vars, which are non-secret).
- Azure DI endpoint is non-secret (it's a URL). The KEY is secret.
- No authentication yet — anyone with network access to port 5180 can upload. Add Entra ID auth in Phase 2.

---

## 9. How to run (for a future Claude session)

### First-time setup (if node_modules missing)

```bash
# API — no install needed beyond restore
cd api
dotnet restore

# Web
cd ../web
pnpm install    # NOT npm install
```

### Configure API secrets (first time only)

```bash
cd api
dotnet user-secrets list    # verify both are set:
                            #   DocumentIntelligence:Endpoint = https://taia-ams-docai.cognitiveservices.azure.com/
                            #   DocumentIntelligence:Key      = <rotated value>
```

If missing, ask user to set them (don't request the key value in chat).

### Start both services

```bash
# Terminal 1
cd api && dotnet run          # http://localhost:5180

# Terminal 2
cd web && pnpm dev            # http://localhost:3000
```

### Verify

- Upload a PDF (sample at `samples/sample-invoice.pdf` — Microsoft's official sample)
- Expect: parsing overlay → review stage with PDF + colored bboxes + field list
- Bboxes should align exactly with text on page

---

## 10. Design reference

The UI draws 1:1 from the Claude Design mock exported to `Document Parsing Service Prototype-handoff/document-parsing-service-prototype/`. Key files:

- `project/Parser.html` — full mock
- `project/styles.css` — source of OKLCH design tokens now in `web/app/globals.css`
- `project/app.jsx`, `sidebar.jsx`, `document.jsx`, `inspector.jsx`, `modals.jsx`, `data.jsx` — reference component structure
- `project/data.jsx` — sample data shape for fields (useful for Day 4 Inspector design)

**Don't modify the handoff bundle.** Treat it as read-only reference.

---

## 11. Where we left off

**2026-04-20 end of session:**

- Day 3 complete, bboxes align perfectly with PDF content
- User said: "Yes, thank you that worked. The bounding boxes now sit exactly over their fields."
- Good checkpoint for a git commit
- No uncommitted Azure key leaks; `appsettings.json` has empty `Key`
- `.npmrc` in `web/` ensures pnpm hoist pattern

**First action for the next session:**

1. Ask if they committed the Day 1–3 work. If not, offer to run the commit flow in the previous turn.
2. Confirm which day to tackle — default Day 4 (Inspector + inline editing + PATCH endpoint).
3. `use context7` — user typically wants library docs verified before implementation. For Day 4 specifically, not much new library work needed; Day 5 and 6 have more (draw-rect math, modal patterns).

---

## 12. Anti-patterns to avoid

- Don't re-add Fluent UI — explicitly rejected.
- Don't "upgrade" react-pdf to 10.x without an explicit ask + plan for the Next.js 15 compat issue.
- Don't read `.env*` files for any reason.
- Don't accept a credential in chat context — ask for rotation if one surfaces.
- Don't add features, abstractions, or tests beyond what the user asks for (from their global prefs: "keep it simple", "prototype").
- Don't auto-commit. User wants to review and run commits themselves unless they explicitly delegate.
- Don't use `.pnpm` internals in URLs — use the hoisted paths or CDN for workers.
- Don't use CSS shorthands if Fluent UI ever returns. (Currently out of scope since Fluent is dropped.)
- Don't use the Inspector's complex popovers/modals as "use client" boundaries if they can be nested inside the already-client `ReviewStage` tree. Keep the SSR-skip boundary only for `PdfDocumentView`.

---

_Last updated: 2026-04-20 after Day 3 (PDF viewer + bboxes) completed successfully._
