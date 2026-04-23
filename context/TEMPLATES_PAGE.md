# Templates Page — Implementation Context

> **Purpose of this file:** self-contained context for a fresh Claude session to implement the Templates management surface end to end (index page + edit page + duplicate action + sidebar/topbar wiring). Read this, then `context/PROJECT_CONTEXT.md` for the broader product + tech stack, then `memory/MEMORY.md` for user preferences, then code.
>
> **Status:** design locked-in 2026-04-23. Not yet implemented. No schema migration required.

---

## 1. What we're building

A first-class **Templates management surface** so users can see, edit, duplicate, and delete templates from a dedicated page instead of just the sidebar. Today the sidebar is the only template affordance: it lists all templates and lets you click-to-fill or hover-to-delete. That doesn't scale past ~10 templates and exposes no way to *edit* a saved template without deleting + re-saving.

### Core user stories

1. **Browse** — user clicks sidebar `Templates` nav → lands on `/templates` → sees a table of every saved template with metadata (name, vendor, kind, rule count, runs, created).
2. **Use** — row click on `/templates` opens the existing fill flow at `/templates/[id]/new`. Sidebar cards continue to work the same way.
3. **Edit** — row kebab menu → Edit → `/templates/[id]/edit`. User can change name/description/kind/vendor hint, tweak per-rule data type / required flag / hint / aliases, or delete individual rules. Bounding regions are *not* editable in this flow (see §2).
4. **Duplicate** — row kebab menu → Duplicate → creates a copy with name `"{original} (copy)"` and lands the user on the copy's edit page so they can rename immediately.
5. **Delete** — row kebab menu → Delete → existing `DeleteTemplateModal` confirms and deletes, same backend semantics as the sidebar trash (cascade to rules, SetNull on Document.TemplateId).

### Out of scope (explicit non-goals)

- **Editing bounding regions.** Rules keep their original bbox; if the user needs a different region, they save a new template from a fresh parse. Scope decision on 2026-04-23 — the draw-to-resize UX would multiply the testable surface (re-fetching source doc, re-running layout extraction, handling deleted-source-doc cases) for a modest usability win.
- **Adding new rules** on the edit page. Same reason as above: adding a rule requires a bounding region, which requires the full PDF + draw tooling.
- **Bulk actions** (multi-select, bulk delete). One-at-a-time is fine for the prototype.
- **Required-field warnings on the fill stage** when the user exports with required rules empty. Noted as a separate future task; users confirmed they want this eventually but want it scoped separately.
- **Cross-device "last used" tracking.** See §7 open question — sidebar's "top 6 recent" may mean "last-created" for V1 unless we add a `LastUsedAt` column.

---

## 2. UX decisions — locked in

| Decision | Choice | Rationale |
|---|---|---|
| Entry point for management | New route `/templates`, separate from sidebar | Sidebar is navigation, not CRUD. Matches DocuSign / Jotform / HubSpot / Adobe Acrobat patterns. |
| Row click on `/templates` | Opens fill flow | The product's core value prop is *reusing* templates; fast path beats safe path. Secondary actions (Edit/Duplicate/Delete) sit in a kebab menu. |
| Edit scope | Metadata + per-rule properties, NO bbox editing | Covers ~90% of real edits; avoids the heavy draw-on-PDF engineering. |
| Edit page layout | Two-pane: metadata form left, rules editor right, ghosted-PDF preview below | Preview is read-only orientation aid, not an editor. Reuses `PdfDocumentView` + `BoundingBoxOverlay` with new read-only props. |
| Save semantics | Pessimistic (user waits on success; rollback on error) | Matches `save-template-modal.tsx`'s pattern; editing affects potentially many downstream artifacts, so optimistic-update + rollback isn't worth the complexity. |
| Duplicate UX | Available from day one; lands user on edit page of the copy | Edit page is the natural follow-up — duplicate-then-rename is the common flow. |
| Sidebar list cap | Top 6 recent + "View all →" link to `/templates` | Prevents sidebar scroll for users with many templates without hiding the affordance. |
| Sidebar nav `Templates` entry | Enabled, links to `/templates` | Disabled placeholder today (`NavButtonPlaceholder` in sidebar.tsx). |
| Bounding-region preview on edit page | Yes, ghosted PDF with bboxes labeled by rule name | Helps users orient "which rule is this?" even though they can't change the region. |

---

## 3. Schema changes

**None required for V1.** The `Template` + `TemplateFieldRule` tables already have every column the edit page needs: Name, Description, Kind, VendorHint, and per-rule Name, DataType, IsRequired, Hint, Aliases, BoundingRegionsJson.

### Optional schema change (open question — see §7)

If we want "top 6 *recently used*" rather than "top 6 *most recently created*", add:

```csharp
// Models/Template.cs
public DateTime? LastUsedAt { get; set; }
```

Updated from `TemplateFillLoader` on successful template load. Requires `rm api/app.db*` again. Deferred pending user decision.

---

## 4. Backend plan

### `PUT /api/templates/:id` — update metadata + rules atomically

```csharp
public record UpdateTemplateRequest(
    string Name,
    string? Description,
    string Kind,
    string? VendorHint,
    IReadOnlyList<UpdateTemplateRuleRequest> Rules);

public record UpdateTemplateRuleRequest(
    string Id,              // existing rule id; server verifies ownership
    string Name,
    string DataType,
    bool IsRequired,
    string? Hint,
    string[]? Aliases);
```

**Reconciliation semantics on the server**:

1. Load the template + rules by id.
2. Apply metadata changes (Name, Description, Kind, VendorHint).
3. For each incoming rule: find by id, update in place. If id isn't in the existing rules, return 400 (client shouldn't send IDs we don't own).
4. Any existing rule whose id isn't in the incoming list → delete it (cascade is fine; no FKs point at `TemplateFieldRule` except the parent `Template`).
5. Single `SaveChangesAsync` (see Gotchas in PROJECT_CONTEXT.md §7 — never double-save).

Return the updated `TemplateResponse` (same shape `GET /api/templates/:id` returns).

**Why `PUT` not `PATCH`**: the payload *replaces* the rules collection (missing rules = deleted). That's a full-replace semantic, which is `PUT`-shaped. Metadata also goes along for the ride because the client batches on Save. If we were exposing partial rule updates on their own endpoint, those would be `PATCH`.

### `POST /api/templates/:id/duplicate` — clone template + rules

```csharp
// No request body — the existing template id in the path is enough.
public record DuplicateTemplateResponse(TemplateResponse Template);
```

Server clones the template and all rules, setting:
- `Template.Id = Guid.NewGuid()`
- `Template.Name = $"{source.Name} (copy)"` — suffix with " (copy)", " (copy 2)", etc. if a name collision exists
- `Template.CreatedAt = DateTime.UtcNow`
- `Template.SourceDocumentId = source.SourceDocumentId` — both templates reference the same source doc (the shared region metadata is still valid)
- `TemplateFieldRule.Id = Guid.NewGuid()` per rule
- `TemplateFieldRule.TemplateId = <new template id>`
- All other rule fields copied verbatim

Return the new template so the client can navigate to `/templates/:newId/edit`.

### Existing endpoints (no change)

- `GET /api/templates` — list (already returns TemplateSummary with RuleCount + CreatedAt)
- `GET /api/templates/:id` — full Template with Rules (used by edit loader)
- `DELETE /api/templates/:id` — unchanged
- `POST /api/templates` — create (save-from-review, unchanged)

### Contracts file additions

Add to `api/Contracts/TemplateResponse.cs`:
- `UpdateTemplateRequest` + `UpdateTemplateRuleRequest`
- `DuplicateTemplateResponse` (or return `TemplateResponse` directly)

---

## 5. Frontend plan

### New routes

```
web/app/templates/
├── page.tsx                unwraps nothing; renders <TemplatesPage>
├── loading.tsx             TemplatesLoadingSkeleton (table-shaped)
└── [id]/
    ├── new/                existing — fill flow, untouched by this work
    └── edit/
        ├── page.tsx        React 19 use() on params, renders <TemplateEditLoader>
        ├── loading.tsx     TemplateEditLoadingSkeleton (two-pane shape)
        └── not-found.tsx   TemplateEditNotFoundPanel (link back to /templates)
```

### New components

All live in `components/templates/` — a new subfolder, since the feature has enough surface area to warrant it (table + loader + stage + metadata form + rules editor + preview + row-actions menu).

```
web/components/templates/
├── templates-table.tsx         table layout, row click → fill flow, kebab → actions
├── template-row-actions.tsx    kebab menu with Edit/Duplicate/Delete
├── template-edit-loader.tsx    state-machine (loading|ready|not-found|error); mirrors TemplateFillLoader
├── template-edit-stage.tsx     two-pane composition; owns dirty-state + save
├── template-metadata-form.tsx  left pane: Name/Description/Kind/VendorHint
├── template-rules-editor.tsx   right pane: rules list with inline edit + delete
├── template-rule-row.tsx       one row in the rules editor (reuses use-inline-edit)
├── template-preview-pane.tsx   ghosted PDF with read-only bboxes labeled by rule name
└── templates-placeholder.tsx   TemplatesLoadingSkeleton + TemplatesEmptyState + TemplateEditNotFoundPanel + TemplateEditErrorPanel
```

### `/templates` index page shape

Mirrors `DocumentList`'s aesthetic for consistency:

- **Header**: "Templates" title + "{n} saved" subtitle + `New template` button (disabled with tooltip "Save from a parsed document — head to Parse") to reinforce the save-path
- **Table columns**: Name · Vendor · Kind · Rules · Runs · Created · (kebab)
- **Row interaction**: whole row clickable (Enter/Space keyboard) → navigates to `/templates/[id]/new`
- **Kebab menu**: Edit (→ `/templates/:id/edit`), Duplicate (server call → navigate to copy's edit page), Delete (opens `DeleteTemplateModal`)
- **Empty state**: icon + "No templates yet" + "Save one after reviewing a parse" + CTA link to `/`
- **Error/loading**: same `ErrorBanner` + `Skeleton` primitives the rest of the app uses

### `/templates/[id]/edit` page shape

```tsx
<TemplateEditStage template={...}>
  <div className="two-pane-top">
    <TemplateMetadataForm />    {/* left */}
    <TemplateRulesEditor />     {/* right */}
  </div>
  <TemplatePreviewPane />       {/* below, ghosted PDF with labeled bboxes */}
  <StickyFooter />              {/* Cancel + Save + dirty-state indicator */}
</TemplateEditStage>
```

- **Dirty-state tracking**: `isDirty` derived from comparing current form state to initial snapshot. `beforeunload` listener + Next.js App Router `useRouter().beforeNavigate` pattern (if available; otherwise a plain in-app confirm before changing routes).
- **Save**: PUT to backend, rollback to initial snapshot on error + toast. On success, update initial snapshot + toast "Template updated".
- **Delete rule**: strikes the row visually and marks pending removal — doesn't hit backend until Save (keeps PUT atomic).
- **Preview pane**: uses existing `PdfDocumentView` with a new `readOnly` flag on `BoundingBoxOverlay` (or a new `renderPageOverlay` that produces labeled-bbox-only markup). Bboxes are labeled with the rule's Name; clicking a bbox scrolls the corresponding rule row into view (nice-to-have).

### Sidebar updates

- Enable the disabled `Templates` `NavButtonPlaceholder` → replace with a real `NavLink` pointing to `/templates`. Count = `templates.length`.
- Template list in sidebar: slice to top 6 (by CreatedAt desc, or LastUsedAt if we land that change). Add a "View all →" link below the list pointing to `/templates`. Link styled minimally — light text, no bullet.
- Keep hover-reveal trash; keep card-click-to-fill behavior.

### API client additions (`lib/api-client.ts`)

```ts
export async function updateTemplate(
  id: string,
  payload: UpdateTemplateRequest
): Promise<Template>;

export async function duplicateTemplate(id: string): Promise<Template>;
```

Types in `lib/types.ts`: `UpdateTemplateRequest`, `UpdateTemplateRuleRequest`.

---

## 6. Implementation phases

Each phase ends in a committable, buildable state. Suggested commit messages in each phase title.

### Phase A — backend `PUT` + duplicate endpoints

`feat(templates): add PUT update + POST duplicate endpoints`

1. Contracts: `UpdateTemplateRequest`, `UpdateTemplateRuleRequest`.
2. `TemplatesController.Update(Guid id, UpdateTemplateRequest body)`:
   - Load template + rules.
   - 404 if not found.
   - Apply metadata.
   - Diff rules by id: update existing, delete missing. 400 if incoming id isn't owned.
   - Single `SaveChangesAsync`.
   - Return refreshed `TemplateResponse`.
3. `TemplatesController.Duplicate(Guid id)`:
   - Load source.
   - 404 if not found.
   - Resolve name collision with `" (copy)"` / `" (copy 2)"` suffix loop.
   - Build new Template + Rules graph; single `SaveChangesAsync`.
   - Return `TemplateResponse`.
4. Smoke-test via `DocParsing.Api.http`.

### Phase B — API client + types

`feat(templates): add updateTemplate + duplicateTemplate client calls`

1. Add `UpdateTemplateRequest` + `UpdateTemplateRuleRequest` to `lib/types.ts`.
2. Add `updateTemplate` + `duplicateTemplate` to `lib/api-client.ts`.
3. No UI yet — verify in devtools network tab or via a quick one-off page.

### Phase C — `/templates` index page

`feat(templates): add /templates index page with table + row kebab actions`

1. `app/templates/{page,loading}.tsx`.
2. `components/templates/templates-table.tsx` + `templates-placeholder.tsx` (skeleton + empty state).
3. `components/templates/template-row-actions.tsx` (kebab menu using a `type-popover`-style portal for consistency with the Inspector's type popover).
4. Wire Edit/Duplicate/Delete:
   - Edit → `router.push('/templates/:id/edit')` (edit page is Phase D; link works, destination is 404 until then).
   - Duplicate → `duplicateTemplate(id)` → `router.push('/templates/:newId/edit')` + toast.
   - Delete → reuse existing `DeleteTemplateModal`.
5. Sidebar nav: enable the `Templates` entry → links to `/templates`.

### Phase D — `/templates/[id]/edit` page

`feat(templates): add /templates/:id/edit with metadata + rule editor + preview`

1. `app/templates/[id]/edit/{page,loading,not-found}.tsx`.
2. `components/templates/template-edit-loader.tsx` — mirror of `template-fill-loader.tsx`.
3. `components/templates/template-edit-stage.tsx` — owns state, dirty tracking, save.
4. `components/templates/template-metadata-form.tsx`.
5. `components/templates/template-rules-editor.tsx` + `template-rule-row.tsx`.
6. `components/templates/template-preview-pane.tsx` — ghosted PDF with read-only labeled bboxes.
7. `beforeunload` guard for unsaved changes.
8. Save button: pessimistic, rollback on error + toast.

### Phase E — sidebar "top 6 + View all"

`feat(templates): cap sidebar list at 6 with "View all" link`

1. Slice `templates` to top 6 by CreatedAt desc (or LastUsedAt if §7 lands).
2. Add "View all →" link under the list → `/templates`.
3. Keep everything else intact.

### Phase F — polish + final verification

`chore(templates): polish + build verification`

1. Empty states, error states for every panel.
2. Keyboard nav (Enter/Space on row, Esc to cancel edit, etc.).
3. `prefers-reduced-motion` for any new animations.
4. `pnpm build` + `pnpm lint` clean.
5. Smoke test: create → duplicate → edit rule → save → use → delete.

---

## 7. Open questions

1. **Sidebar "top 6 recent" — by what metric?**
   - **Option A (V1 default):** CreatedAt desc. Simple; matches current data model. "Recent" = "recently saved".
   - **Option B:** Add `LastUsedAt` column updated from `TemplateFillLoader` on template load. Requires `rm api/app.db*`. More accurate for the user-intuitive meaning of "recent".
   - **Recommendation:** Option A for V1, upgrade to B if usage patterns show it matters.

2. **Name-collision suffix for Duplicate — do we loop?**
   - `" (copy)"`, `" (copy 2)"`, `" (copy 3)"`, ...? Or fail with 409 Conflict after the first collision?
   - **Recommendation:** loop — matches Finder/Explorer behavior; users won't hit a wall.

3. **Preview pane — scrollable or fit-to-viewport?**
   - PDFs are often tall. If the preview is full-page it'll dominate the edit view.
   - **Recommendation:** max-height capped with inner scroll; acts as "glance to confirm rule positions" rather than a full viewer.

4. **Rule row ordering in the editor.**
   - Current `Template.Rules` has no explicit sort column — EF returns them in insertion order by default, usually fine.
   - If users want drag-to-reorder: Phase 2.

5. **Should the `TemplateFillStage` get an "Edit template" button?**
   - Would let users jump from fill flow into edit without going back to the index.
   - **Recommendation:** yes, small addition — put it in the fill stage's toolbar next to Export. Trivial.

---

## 8. Known gotchas

### Backend

- **Never double-save** (PROJECT_CONTEXT.md §7): build the full update graph first, then one `SaveChangesAsync`. The Update handler must NOT save after metadata changes and again after rule diffing.
- **Rule id ownership check**: if a client sends a rule id that exists but belongs to a different template, 400. Don't accidentally let a caller mutate rules on another template by guessing ids.
- **Schema change if LastUsedAt lands**: `rm api/app.db*` wipes all saved templates + uploaded docs. Already-documented pain; flag it if we decide to add the column.
- **Duplicate referencing a deleted source document**: `Template.SourceDocumentId` may point at a deleted `Document` (SetNull on the Document→Template FK, but Templates→Document is a plain FK). The duplicate keeps the same pointer, which may already be null. No new concern introduced.

### Frontend

- **Dirty-state comparison**: JSON.stringify of a canonicalized snapshot is the simplest correct approach. Don't rely on individual `useState` dirty flags — too easy to miss one.
- **`beforeunload` only fires on tab close, not route change**. For in-app navigation, intercept `router.push` or use a custom navigation guard hook. Next.js App Router doesn't have first-class "block nav" — need a hack via `useEffect` + event listener or a confirmation modal on the Cancel button.
- **Kebab menu portals**: use the existing `type-popover.tsx` portal pattern or a new tiny popover primitive. Don't CSS-position a raw `<div>` — Firefox/Safari layering differences bite.
- **`PdfDocumentView` currently requires the source doc's file URL**. If the source Document was deleted, `apiFileUrl(template.sourceDocumentId)` resolves to a 404. Guard the preview pane with a "Source document unavailable" fallback (same pattern used in `TemplateFillStage` today).
- **Sidebar refresh after duplicate**: call `refreshTemplates()` from `useAppShell()` so the new template appears in the sidebar list immediately. Already the pattern used elsewhere (Save, Delete).

### Next.js / React

- **Dynamic params are a Promise** (Next 15): both `/templates/[id]/new/page.tsx` and `/templates/[id]/edit/page.tsx` use React 19 `use()` to unwrap. Don't destructure directly — that throws.
- **`usePathname()` requires `"use client"`**: sidebar already handles this; edit loader too.
- **`notFound()` must be called during render, not in an effect.** The existing `TemplateFillLoader` gets this right; copy it.

---

## 9. Pointers to existing code

Files to read/reuse when implementing this feature — do NOT re-derive patterns they already establish:

- `api/Controllers/TemplatesController.cs` — existing CRUD; Update + Duplicate go here.
- `api/Models/Template.cs`, `TemplateFieldRule.cs` — already have every column we need (Hint + Aliases added in Voice Feature Phase 0).
- `api/Contracts/TemplateResponse.cs` — where new DTOs go.
- `api/Controllers/DocumentsController.cs` — reference for name-collision handling + single-SaveChanges + 404 pattern.
- `web/components/document/template-fill-loader.tsx` — mirror for `TemplateEditLoader` (state machine).
- `web/components/document/template-fill-stage.tsx` — reference for dirty-state + pessimistic save patterns.
- `web/components/modal/save-template-modal.tsx` — input class constants (`LABEL_CLASS`, `INPUT_CLASS`, `SEG_BASE/ACTIVE/INACTIVE`, `TEXTAREA_CLASS`) to reuse on the metadata form.
- `web/components/inspector/inspector-field.tsx` — inline-edit pattern via `use-inline-edit` hook. Rule row reuses this.
- `web/components/document/document-list.tsx` — table aesthetic to mirror on `/templates`.
- `web/components/modal/delete-template-modal.tsx` — reuse as-is for delete confirmation.
- `web/components/layout/sidebar.tsx` — where to enable the `Templates` nav + cap template list.
- `web/lib/api-client.ts` — pattern for typed fetch wrappers.
- `web/lib/hooks/use-inline-edit.ts` — extracted from InspectorField; reuse for rule rows.
- `web/components/document/pdf-document-view.tsx` — has `renderPageOverlay` prop (used by TemplateFillStage). New read-only preview uses the same extension point.

---

## 10. Decisions log

- **2026-04-23** — Feature green-lit. Edit scope = metadata + rule properties only (no bbox editing). Fill-flow entry priorities: sidebar card click + `/templates` row click, skipping a "new from template" button on the landing page. Sidebar cap = top 6 + "View all". Duplicate ships in V1. Bbox preview on edit page = yes, read-only. Required-field export warning = separate future task.
- **2026-04-23** — Rejected per-rule PATCH endpoints in favor of PUT with full rule collection. Rationale: edit page batches on Save, and the full-replace semantic is simpler + atomic.
- **2026-04-23** — Rejected letting the edit page add new rules. Adding a rule requires a bounding region, which requires PDF render + draw tooling. If users need a new region, they save a new template from a fresh parse.
- **2026-04-23** — Rejected bulk actions (multi-select, bulk delete) for V1. Prototype scope.

---

_Last updated: 2026-04-23. Pre-implementation design doc. Update as phases complete._
