# Voice-Fill Feature — Implementation Context

> **Purpose of this file:** self-contained context for a fresh Claude session to implement the voice-fill-from-template feature end to end. Read this, then `context/PROJECT_CONTEXT.md` for the broader product + tech stack, then `memory/MEMORY.md` for user preferences, then code.
>
> **Status:** design locked-in 2026-04-22. Not yet implemented. No schema migration applied. No new routes or endpoints exist yet.

---

## 1. What we're building

A **"Create from template" workflow** that lets users fill out document templates by voice, review the preview, edit anything, and export the completed document as a PDF.

### The core user story

1. User navigates to `/templates/[id]/new` from the sidebar template library.
2. The page renders the template's source PDF **ghosted** (low opacity) with prominent field-slot rectangles overlaid at each rule's bounding region.
3. User clicks the **mic button** and says something like: *"For my invoice, put Jane Doe for the name field, PO-2302 for the P.O. number, and 100 dollars for the sales tax."*
4. Speech recognition transcribes the audio. An LLM maps the transcript to structured field patches using the template's rules as the allowed field schema.
5. **Proposed values appear directly inside the bbox slots** on the rendered PDF, visually marked as pending (subtle pulse, different border). A thin confirmation bar at the bottom reads: *"Set 3 fields · Confirm / Edit / Undo"*.
6. User clicks **Confirm** → pending styling is dropped; values commit. OR the user clicks any individual slot to edit inline (click → inline input → Enter commits, Esc reverts). OR the user says more to add/override more fields. OR hits **Undo** to clear all pending.
7. User can also type values directly into any slot without ever using voice — voice is *an* input method, not the only one.
8. When the user is happy, they click **Export PDF**. A client-side pdf-lib pipeline reads the source PDF, draws an opaque white rectangle over each filled bbox (hiding the original vendor's text), then draws the user's value on top. The new PDF is downloaded to the user's machine.

### Out of scope (explicit non-goals)

- Voice navigation commands ("next field", "save", "discard"). Only voice *fill*.
- Offline / fully-local speech-to-text. Azure Speech requires network. Accept that.
- Streaming / partial-transcript UI. One utterance → wait → transcript → LLM → preview is fine.
- Server-side PDF export. Client-side pdf-lib only.
- Persisting the voice-filled document as a `Document` entity in SQLite. Voice-fill creates a **transient** in-browser document. If the user exports, they export. If they close the tab, it's gone.
- Training/fine-tuning the LLM on the user's templates. Prompt-only structured extraction.
- Multilingual. English (`en-US`) only.
- Revert to the original-template values after editing. No history per field.

---

## 2. UX decisions — locked in

| Decision | Choice | Rationale |
|---|---|---|
| Entry point | New route `/templates/[id]/new` | Clean narrative: templates become fillable artifacts, not just parse-correction memory. |
| Template-on-screen look | **Ghost the source PDF** (opacity ~0.2) with prominent filled bbox rectangles as "field slots" | Reuses 80% of `PdfDocumentView` + `BoundingBoxOverlay`. Ghost text behind slots hints "this is what a PO number looks like" without overwhelming the user. |
| Where preview values appear | **Directly inside the bbox slots**, marked as pending (pulse animation + distinct border) until user confirms | Feels magical, demos well. Pending marker keeps it honest — user sees what the LLM inferred before accepting. |
| Confirmation model | Bottom **confirmation bar** (thin, non-blocking). Buttons: Confirm / Edit / Undo | Modal blocks the document; bar lets the user see the result while deciding. |
| Edit after fill | Click any slot → inline `<input>` (Enter commits, Esc reverts), same pattern as `inspector/inspector-field.tsx` | Reuses a known-good interaction; no new primitives. |
| Voice scope per utterance | User can speak multiple fields in one utterance; LLM handles mapping | Matches how users naturally batch intent ("put X for Y and Z for W"). |
| Typing vs voice | Both always available. Click any slot anytime to type without invoking voice at all | Voice is an accelerator, not a gatekeeper. Keyboard-first users get full functionality. |
| Export format | **PDF** (source PDF + white mask + user values baked in), client-side via pdf-lib | No backend round trip; user gets an instant download. Good enough for prototype + demo. |
| Confidence visualization | Voice-filled values show no confidence badge (they came from the user, not the AI). Bbox slot itself has a neutral color | Distinct from parse-correct flow where confidence is a first-class citizen. |

---

## 3. Schema changes

One migration, applied once.

### `TemplateFieldRule` — add two nullable columns

| Column | Type | Purpose |
|---|---|---|
| `Hint` | `string?` (≤ 200 chars) | Free-text description the LLM sees for disambiguation. Example: "the billing contact's full name" or "purchase order number, may contain dashes". |
| `Aliases` | `string?` (JSON-serialized `string[]`) | Alternative phrasings the user might say. Example: `["PO", "P.O.", "purchase order"]` for a rule named `poNumber`. |

Both are **optional** — existing rules work fine without them. The LLM falls back to the rule's `Name` and `DataType` if Hint/Aliases are null.

### Storage pattern for `Aliases`

Same pattern as `BoundingRegionsJson` elsewhere — a JSON-serialized string in a single column. Reason: SQLite doesn't cleanly model `string[]` as a relational column, we never query *by* alias (only read them), and serializing keeps the rule self-contained.

Helpers on the model:

```csharp
// api/Models/TemplateFieldRule.cs
public string? Aliases { get; set; }  // JSON: ["PO","P.O.","purchase order"]

public IReadOnlyList<string> GetAliases() =>
    string.IsNullOrWhiteSpace(Aliases)
        ? Array.Empty<string>()
        : JsonSerializer.Deserialize<List<string>>(Aliases) ?? new();

public void SetAliases(IEnumerable<string> aliases)
    => Aliases = JsonSerializer.Serialize(aliases.Where(a => !string.IsNullOrWhiteSpace(a)).ToArray());
```

### UI surface for editing Hint/Aliases

Add two optional inputs to `web/components/modal/save-template-modal.tsx` — one text field for Hint, one comma-separated or pill-style list for Aliases, per captured field rule. Users can ignore both and still save the template.

### Migration cost

Per `PROJECT_CONTEXT.md` §7, there are no EF Core migrations yet — schema changes use `Database.EnsureCreated()`. So the change requires:

```bash
cd api
rm app.db app.db-shm app.db-wal
dotnet run
```

Any previously saved templates are gone. Users will need to re-save. Accept that.

---

## 4. Backend plan

### New controller: `VoiceController.cs`

```
api/Controllers/VoiceController.cs

GET  /api/voice/token                           → short-lived Azure Speech token + region
POST /api/voice/fill                            → transcript + templateId → structured patches
```

### `GET /api/voice/token`

Returns a JWT authorization token that the browser uses to authenticate with Azure Speech. Never expose `Speech:Key` to the browser.

```csharp
// Pseudo-shape
public record SpeechTokenResponse(string Token, string Region, DateTime ExpiresAt);

[HttpGet("token")]
public async Task<ActionResult<SpeechTokenResponse>> GetToken(CancellationToken ct)
{
    // POST https://<region>.api.cognitive.microsoft.com/sts/v1.0/issueToken
    // Header: Ocp-Apim-Subscription-Key: <Speech:Key>
    // Returns: JWT string (10-minute validity)
    // Return { Token, Region, ExpiresAt = now + 9 minutes }
}
```

Cache tokens for ~9 minutes (tokens expire at 10). Frontend re-fetches when within 1 minute of expiry.

### `POST /api/voice/fill`

Takes the final transcript + template context + optional existing field values. Calls Azure OpenAI (or OpenAI-direct per config), returns structured patches.

```csharp
public record VoiceFillRequest(
    Guid TemplateId,
    string Transcript,
    Dictionary<string, string?>? CurrentValues);  // field-name → current value

public record VoiceFillResponse(
    IReadOnlyList<FieldPatch> Patches,
    IReadOnlyList<string> UnmatchedPhrases,
    string Transcript);  // echo back for debugging

public record FieldPatch(string Field, string Value, string DataType);

[HttpPost("fill")]
public async Task<ActionResult<VoiceFillResponse>> Fill(VoiceFillRequest req, CancellationToken ct)
{
    var template = await db.Templates.Include(t => t.Rules).FirstOrDefaultAsync(t => t.Id == req.TemplateId, ct);
    if (template is null) return NotFound();

    // Build JSON schema dynamically from template.Rules (field names, types, hints, aliases)
    // Call OpenAI ChatClient with structured output
    // Parse response, return patches + unmatched
}
```

### New service: `IVoiceFillService` / `VoiceFillService.cs`

Wraps the LLM call. Single method:

```csharp
Task<VoiceFillResult> ExtractPatchesAsync(
    Template template,
    string transcript,
    IReadOnlyDictionary<string, string?> currentValues,
    CancellationToken ct);
```

Key decisions inside this service:

- **LLM library:** `OpenAI` NuGet package, v2.8.0+ (verified via Context7, 2026-04-22). Same package works for both OpenAI-direct and Azure OpenAI — swap via `OpenAIClientOptions.Endpoint`. One NuGet dependency, two backends.
- **Model:** `gpt-4o-mini` (cheap, fast, supports structured outputs).
- **Structured output:** `ChatResponseFormat.CreateJsonSchemaFormat(..., jsonSchemaIsStrict: true)` — strict mode guarantees JSON conformance.
- **JSON schema generated per template:** field names become an enum of allowed values in the patch's `field` property. Example:

  ```json
  {
    "type": "object",
    "properties": {
      "patches": {
        "type": "array",
        "items": {
          "type": "object",
          "properties": {
            "field": { "enum": ["customerName","poNumber","salesTax","invoiceDate"] },
            "value": { "type": "string" }
          },
          "required": ["field","value"],
          "additionalProperties": false
        }
      },
      "unmatched": { "type": "array", "items": { "type": "string" } }
    },
    "required": ["patches","unmatched"],
    "additionalProperties": false
  }
  ```

  The LLM is **physically prevented** from inventing new field names — anything it couldn't place lands in `unmatched`.

- **System prompt template:**

  ```
  You map spoken intent to form-field assignments. You receive:
  1. A list of available fields (name, data type, optional hint, optional aliases).
  2. The current value of each field (if already filled).
  3. A transcript of what the user said.

  For each field the user clearly referenced, emit a patch with the field's
  canonical name and the value the user specified. Coerce values to match
  the field's data type (numbers for currency/number fields, dates in
  ISO format for date fields, strings otherwise).

  If the user says a phrase that doesn't clearly match any field, add it
  to "unmatched" instead of guessing. Do not invent fields. Do not patch
  fields the user did not mention.
  ```

  Followed by JSON-formatted field schema + current values + transcript.

- **Never include full secrets in prompts.** The transcript is the only user-supplied text. Template rules and current values are our data.

### New config section: `OpenAI`

In `appsettings.json` (placeholders only):

```json
"OpenAI": {
  "Endpoint": "",
  "Key": "",
  "Model": "gpt-4o-mini"
}
```

Real values go in `dotnet user-secrets`:

- Azure OpenAI path: `Endpoint = https://<resource>.openai.azure.com/openai/v1/`, `Key = <azure-key>`
- OpenAI-direct fallback: `Endpoint = null` (SDK defaults to api.openai.com), `Key = <openai-key>`

Bind via an `OpenAIOptions` class mirroring `DocumentIntelligenceOptions`.

### New config section: `Speech`

```json
"Speech": {
  "Key": "",
  "Region": "eastus"
}
```

Key and region both come from the Azure Speech resource. Region here is used for the token mint call AND returned to the browser.

---

## 5. Frontend plan

### New route: `/templates/[id]/new`

```
web/app/templates/[id]/new/
├── page.tsx          unwrap params Promise via React 19 use(), render TemplateFillStage
├── loading.tsx       full skeleton (ghost PDF placeholder + bar)
└── not-found.tsx     NotFoundPanel
```

### New component: `components/document/template-fill-stage.tsx`

Composes existing pieces. Mirrors `review-stage.tsx` but without the Inspector panel and with the ghost + slots variant.

```tsx
<TemplateFillStage templateId={...}>
  <PdfDocumentView
    fileUrl={template.sourceDocumentFileUrl}
    ghost={true}                         // new prop: opacity 0.2 on canvas
    fields={slotFields}                  // derived from template.rules + currentValues
    renderMode="fillSlots"               // new: renders FieldSlotOverlay instead of BoundingBoxOverlay
    onSelectField={...}
    onEditField={...}
  />
  <VoiceBar
    state={voiceState}                   // idle | listening | processing | preview | error
    pendingPatches={pendingPatches}
    unmatchedPhrases={unmatchedPhrases}
    onStart={startVoice}
    onConfirm={commitPatches}
    onUndo={clearPatches}
  />
</TemplateFillStage>
```

### Extend `PdfDocumentView` and `BoundingBoxOverlay`

Two new props, both with backwards-compatible defaults:

- `ghost?: boolean` — when true, renders the react-pdf Page with `className` that applies `opacity: 0.2` via CSS Module. Zero change to the existing flow.
- `renderMode?: 'viewBBoxes' | 'fillSlots'` — `'viewBBoxes'` is today's behavior. `'fillSlots'` renders a new overlay variant (`FieldSlotOverlay`) that looks like a filled rectangle with the current value rendered inside it, or a placeholder + field name if empty.

### New component: `components/document/field-slot.tsx`

A variant of BoundingBoxOverlay's item renderer. Per slot:

- Renders a rectangle at the rule's bbox (percent-based, same math as `lib/bbox.ts`).
- Fill state:
  - **Empty, idle** — neutral background (`--color-surface-2`), field name as placeholder text ("Customer Name")
  - **Filled (committed)** — accent background, value rendered in ink color
  - **Filled (pending from voice)** — pulse animation, dashed border, distinct border color (`--color-accent-weak`)
- Click → renders an `<input>` in place; Enter commits, Esc reverts. This is identical logic to `inspector-field.tsx` — extract the click-to-edit behavior into a shared hook `lib/hooks/use-inline-edit.ts` and reuse from both.
- Editing state doesn't animate (user committed to editing; don't distract).

### New component: `components/document/voice-bar.tsx`

Thin bar at the bottom of the TemplateFillStage. State-driven:

- `idle` — "Hold mic to dictate" + mic button
- `listening` — "Listening…" + pulsing red dot + stop button
- `processing` — "Understanding…" + spinner
- `preview` — "Set N fields · [Confirm] [Edit] [Undo]" + list of pending patches + unmatched phrases (if any) as pill warnings
- `error` — "Couldn't hear that" / "Couldn't match any fields" + retry button

### New lib: `lib/voice-fill.ts`

Coordinates the browser Speech SDK + backend calls.

```ts
export async function startVoiceSession(
  onTranscript: (final: string) => Promise<void>,
  onError: (err: Error) => void
): Promise<() => void>  // returns stop function

export async function fillFromTranscript(
  templateId: string,
  transcript: string,
  currentValues: Record<string, string | null>
): Promise<VoiceFillResponse>
```

Under the hood:

1. Fetch Azure Speech token from `GET /api/voice/token` (cache 9 minutes).
2. Create `SpeechConfig.fromAuthorizationToken(token, region)` (NOT `fromSubscription` — would leak key).
3. Create `AudioConfig.fromDefaultMicrophoneInput()`.
4. Create `SpeechRecognizer`, call `recognizeOnceAsync` for one-utterance recognition.
5. On final transcript, hand off to `fillFromTranscript` → `POST /api/voice/fill`.

### New lib: `lib/pdf-export.ts`

Client-side PDF export via pdf-lib.

```ts
export async function exportFilledPdf(
  sourceFileUrl: string,
  filledFields: Array<{
    rule: TemplateFieldRule;   // provides bbox polygon in inches
    value: string;
  }>,
  pageSizesInches: Array<{ pageNumber: number; widthIn: number; heightIn: number }>
): Promise<void>  // triggers download
```

Implementation outline:

```typescript
import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';

const existingBytes = await fetch(sourceFileUrl).then(r => r.arrayBuffer());
const pdfDoc = await PDFDocument.load(existingBytes);
const font = await pdfDoc.embedFont(StandardFonts.Helvetica);

for (const filled of filledFields) {
  const region = filled.rule.boundingRegions[0];
  if (!region) continue;
  const page = pdfDoc.getPage(region.pageNumber - 1);
  const { width: pagePointsWidth, height: pagePointsHeight } = page.getSize();

  // Convert Azure polygon (inches, top-left origin) to pdf-lib coords (points, bottom-left origin)
  const bbox = polygonInchesToPoints(region.polygon, pagePointsHeight);
  // bbox = { x, y (bottom-left), width, height }

  // 1. Mask the original value with white rectangle
  page.drawRectangle({
    x: bbox.x,
    y: bbox.y,
    width: bbox.width,
    height: bbox.height,
    color: rgb(1, 1, 1),
    opacity: 1,
  });

  // 2. Draw user's value inside the masked region
  const fontSize = Math.min(bbox.height * 0.7, 12);
  page.drawText(filled.value, {
    x: bbox.x + 2,
    y: bbox.y + (bbox.height - fontSize) / 2 + fontSize * 0.2,
    size: fontSize,
    font,
    color: rgb(0, 0, 0),
  });
}

const outBytes = await pdfDoc.save();
const blob = new Blob([outBytes], { type: 'application/pdf' });
const url = URL.createObjectURL(blob);
const a = document.createElement('a');
a.href = url;
a.download = `${template.name}-filled.pdf`;
a.click();
URL.revokeObjectURL(url);
```

Helper lives in `lib/bbox.ts`:

```ts
export function polygonInchesToPoints(
  polygon: number[],  // [x1,y1,x2,y2,x3,y3,x4,y4] top-left inches (from Azure DI)
  pagePointsHeight: number  // pdf-lib page height in points, = inches * 72
): { x: number; y: number; width: number; height: number }
```

Two gotchas to note in the implementation:

- **Azure DI returns inches; pdf-lib uses points** (1 inch = 72 points). Multiply.
- **Azure's Y axis grows downward from the top-left** of the page. **pdf-lib's Y axis grows upward from the bottom-left**. Formula:
  ```
  y_pdflib = pagePointsHeight - (y_azureTopInches * 72) - heightPoints
  ```

---

## 6. Libraries to add

### Frontend

```bash
cd web
pnpm add microsoft-cognitiveservices-speech-sdk pdf-lib
```

- `microsoft-cognitiveservices-speech-sdk` — Azure Speech SDK for browser. Used as ES module.
- `pdf-lib` — client-side PDF modification. MIT license, no peer deps, works in browser.

### Backend

In `api/DocParsing.Api.csproj`:

```xml
<PackageReference Include="OpenAI" Version="2.8.0" />
```

The `OpenAI` package covers both OpenAI-direct and Azure OpenAI via `OpenAIClientOptions.Endpoint`. No separate `Azure.AI.OpenAI` package needed.

---

## 7. Configuration / secrets checklist

Before first run of voice feature, `dotnet user-secrets list` in `api/` should show:

```
DocumentIntelligence:Endpoint    https://taia-ams-docai.cognitiveservices.azure.com/
DocumentIntelligence:Key         <rotated>
Speech:Key                       <speech-resource-key>
Speech:Region                    eastus
OpenAI:Endpoint                  <https://<aoai>.openai.azure.com/openai/v1/  OR  empty for openai-direct>
OpenAI:Key                       <azure-openai-key OR openai-api-key>
OpenAI:Model                     gpt-4o-mini
```

**Do NOT read `.env*` files or echo any of these values in chat.** See `memory/feedback_no_env_reads.md`.

If user needs to switch between Azure OpenAI and OpenAI-direct, it's two `dotnet user-secrets set` calls. No code changes.

---

## 8. Implementation phases

Demo date is no longer a constraint — user confirmed 2026-04-22 they have plenty of time. Phasing is sequential, not time-boxed.

### Phase 0 — schema change (do first)

1. Add `Hint` (nullable string, ≤200) and `Aliases` (nullable string, JSON-serialized `string[]`) columns to `TemplateFieldRule`.
2. Update `AppDbContext.OnModelCreating` for column config.
3. Add `Hint` + `Aliases` getters/setters on the model (JSON helpers).
4. Expose both in `TemplateFieldRuleResponse` (contracts) and `CreateTemplateRequest`.
5. Surface optional inputs in `save-template-modal.tsx` — a text input for Hint, a chip-input or comma-separated field for Aliases.
6. Delete `app.db*`, restart API, save a template to verify end-to-end roundtrip.

### Phase 1 — backend voice endpoints (no frontend yet)

1. Add `Speech:*` and `OpenAI:*` options classes + bind in `Program.cs`.
2. Implement `VoiceController.GetToken` — POST to Azure token endpoint, return `{Token, Region, ExpiresAt}`.
3. Implement `IVoiceFillService` + `VoiceFillService`:
   - Build JSON schema from template rules dynamically.
   - Build system prompt + user message.
   - Call `ChatClient.CompleteChat` with `ChatResponseFormat.CreateJsonSchemaFormat`.
   - Parse structured JSON, return patches + unmatched.
4. Implement `VoiceController.Fill` — load template, call service, return.
5. Test via `.http` file or curl: POST a fake transcript + templateId → expect real patches.

### Phase 2 — frontend stage (no voice yet)

Build the `/templates/[id]/new` route with typing-only field slots first.

1. New route files (page, loading, not-found).
2. `TemplateFillStage` component that fetches the template and renders ghost PDF + field slots.
3. `PdfDocumentView` gains `ghost` + `renderMode` props. `renderMode === 'fillSlots'` swaps in `FieldSlotOverlay`.
4. `FieldSlot` component with three visual states: empty / committed / pending (leave pending dormant until Phase 3).
5. Click a slot → inline edit. Extract shared behavior into `lib/hooks/use-inline-edit.ts` and refactor `inspector-field.tsx` to use it.
6. Wire up **Export PDF** button in the toolbar — uses `lib/pdf-export.ts`.
7. Verify full typing + export flow works. Voice button is grayed out with "Coming next."

### Phase 3 — voice wiring

1. Install browser SDK (`microsoft-cognitiveservices-speech-sdk`).
2. `lib/voice-fill.ts` — token fetch, recognizer setup, one-utterance recognition.
3. `VoiceBar` component with five states.
4. Connect mic button on `TemplateFillStage` → voice session → `/api/voice/fill` → pending patches → slots render in pending state.
5. Confirm button → commit (flip slots from pending to committed). Undo → clear. Edit → same inline-edit (individual slot).
6. Unmatched phrases appear as dismissible pills in `VoiceBar`.

### Phase 4 — polish

1. Mic permission denied → helpful error + link to browser permission docs.
2. No speech detected (Azure returns `NoMatch`) → retry affordance.
3. Network error on token / fill → error banner, not a crash.
4. Loading skeleton for the whole fill stage while template + source PDF load.
5. Mobile: touch target sizes on bbox slots, large mic button.
6. Keyboard shortcut: space-bar to toggle mic (with typical input-field guarding from Day 5 pattern).
7. Accessibility: `role="region"` on stage, `aria-live` on voice state changes, focus management.

---

## 9. Known gotchas

### Azure Speech SDK in browser

- **MUST use `SpeechConfig.fromAuthorizationToken(token, region)`, never `fromSubscription(key, region)`.** Direct key usage exposes the subscription key to anyone with devtools. Token is short-lived (10 min) and scoped. See Context7 `/azure-samples/cognitive-services-speech-sdk` sample.
- **Microphone permission prompt happens on first `AudioConfig.fromDefaultMicrophoneInput()` call.** Browser blocks it unless user gesture triggered the call. Tie the mic startup to the button's `onClick` handler, not a `useEffect`.
- **Dev cert on localhost is fine — browsers treat `http://localhost` as a secure context** so `getUserMedia` / microphone works. If someone moves this to a non-localhost HTTP origin, it will silently fail with "NotAllowedError: Permission denied." HTTPS required off-localhost.
- **One `recognizeOnceAsync` call per utterance.** The SDK supports continuous recognition but the UX we're building is single-shot. Dispose the recognizer after each recognition.

### Azure OpenAI structured outputs

- `ChatResponseFormat.CreateJsonSchemaFormat(..., jsonSchemaIsStrict: true)` is the strict-mode form — model output is guaranteed-valid JSON matching the schema. Requires `gpt-4o-mini` or newer.
- The schema supports `enum` on string properties, which we use to constrain `field` to the template's allowed field names. This is the mechanism that prevents the LLM from inventing fields.
- `additionalProperties: false` is required throughout the schema for strict mode. Don't forget on nested objects.

### pdf-lib

- **PDF coordinate origin is bottom-left, not top-left.** Azure DI returns polygons with top-left-origin inches. Convert: `y_pdflib = pageHeight - y_azureInches*72 - boxHeight`. This is the single most common bug when overlaying on a PDF.
- **Units are points (1/72 inch) in pdf-lib**, inches in Azure DI. Multiply by 72.
- **Font embedding required for non-standard fonts.** `pdfDoc.embedFont(StandardFonts.Helvetica)` works without any font file. For exact visual match to the source invoice, that's overkill; stick with Helvetica/TimesRoman for the prototype.
- **Text overflow in small bboxes.** If the user's value is longer than the bbox width at the default font size, pdf-lib does NOT auto-wrap. Calculate width with `font.widthOfTextAtSize(text, fontSize)` and either truncate or shrink the font. For the prototype, shrink font down to 6pt before truncating with ellipsis.
- **Client-side memory.** Loading a multi-MB PDF into a browser's heap is fine; loading a 50-MB scanned PDF will lag. No users hit this at prototype scale. Note for future.

### Template data shape

- `TemplateFieldRule.BoundingRegionsJson` is a JSON array of `{pageNumber, polygon: number[]}`. Polygon is 8 floats `[x1,y1,x2,y2,x3,y3,x4,y4]` in inches (for PDF source docs). **Axis-aligned math assumes the bbox is roughly rectangular** — take `min/max` of the polygon's x's and y's to get the bounding box. That's already what `AxisAlignedBounds` does in `DocumentsController.cs`.
- `Template.SourceDocumentId` points to the original `Document` used to create the template. The PDF still lives at `api/uploads/<guid>-filename` (unless someone deleted the original doc) and is accessible via `GET /api/documents/:sourceDocumentId/file`. **Delete protection**: if the source document is deleted, the template points at a dead file. The prototype doesn't guard this — consider it a known gap.

### Data type coercion

The LLM is told to coerce based on the rule's `DataType`, but it's a best-effort. Post-process patches server-side before returning:

- `currency` — strip `$`, `,`, `USD`, etc. Parse to decimal. If fails, keep as string and mark a warning.
- `date` — parse to ISO 8601 `YYYY-MM-DD`. If fails, keep raw.
- `number` — parse to number. If fails, keep raw.
- `string` — pass through.

If a coerce fails, still return the patch — just flag it so the UI can show a warning chip on the slot. Don't throw.

### Backend logging

Log the transcript + returned patches + unmatched at info level. Do NOT log user-supplied current values (they may contain user data). Do NOT log OpenAI API key. Do NOT log audio bytes.

---

## 10. Decisions log

- **2026-04-22** — Feature green-lit. Scope: voice-fill only (no voice navigation). Entry point: `/templates/[id]/new`. Ghost-PDF visual. Preview values appear directly in bbox slots with pending styling. Client-side PDF export via pdf-lib. Azure OpenAI primary with OpenAI-direct as same-package fallback. Schema change approved: `Hint` + `Aliases` on `TemplateFieldRule`. Demo date no longer a constraint.
- **2026-04-22** — Rejected Option A (synthesize a true blank form from template metadata) as too much work. Chose Option B (ghost source PDF + overlay field slots). Rationale: reuses 80% of existing components.
- **2026-04-22** — Rejected voice navigation commands for V1. Rationale: scope creep; voice-fill alone is the product differentiator.
- **2026-04-22** — Rejected server-side PDF export for V1. Rationale: client-side pdf-lib is simpler and works offline once the PDF is loaded.
- **2026-04-22** — Rejected persisting voice-filled documents as `Document` entities. Rationale: voice-fill is a "create new instance" flow, not a "parse and store" flow. User exports what they want, closes the tab, done. Revisit when users ask to save drafts.

---

## 11. Open questions for user before implementation

None currently blocking. These can be answered during Phase 4 (polish) or post-V1:

1. **Draft saving.** Should voice-filled documents persist across browser reloads? Currently no — tab close = lost. Could persist in `localStorage` keyed by templateId (no backend change). Easy add if users ask.
2. **Multi-template dictation.** Can one utterance span multiple templates? Currently no — one fill session = one template. Probably stays that way.
3. **Field validation on export.** If required fields are empty at export time, warn? block? Currently: don't block, let the user ship an incomplete PDF. They drove.
4. **History / analytics.** Track how many voice fills vs typed fills, unmatched phrases aggregated? Requires a new analytics table. Phase 2+ concern.

---

## 12. Pointers to existing code

Files most relevant when implementing this feature (do NOT re-derive patterns they already show):

- `context/PROJECT_CONTEXT.md` — full product + tech context
- `api/Controllers/DocumentsController.cs` — PATCH field endpoint, optimistic update pattern, axis-aligned bbox math (`AxisAlignedBounds`, `WordCenterInside`)
- `api/Controllers/TemplatesController.cs` — template CRUD, snapshot-from-doc logic
- `api/Services/DocumentIntelligenceService.cs` — Azure SDK integration pattern; mirror the init-with-options + fail-fast-on-missing-secrets shape
- `api/Models/TemplateFieldRule.cs` — the model getting new columns
- `api/Data/AppDbContext.cs` — where the column config goes
- `web/components/document/pdf-document-view.tsx` — where `ghost` and `renderMode` props land
- `web/components/document/bounding-box-overlay.tsx` — reference for FieldSlotOverlay
- `web/components/inspector/inspector-field.tsx` — inline-edit pattern to lift into `use-inline-edit.ts`
- `web/components/document/review-stage.tsx` — optimistic update + rollback pattern (mirror for voice-fill commit)
- `web/components/modal/save-template-modal.tsx` — where Hint/Aliases inputs go
- `web/lib/bbox.ts` — polygon/percent math; add `polygonInchesToPoints` here
- `web/lib/api-client.ts` — pattern for typed fetch wrappers; add `fetchSpeechToken`, `postVoiceFill`

---

_Last updated: 2026-04-22. Pre-implementation design doc. Update as phases complete._
