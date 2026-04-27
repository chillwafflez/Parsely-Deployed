using System.Text.Json;
using DocParsing.Api.Catalog;
using DocParsing.Api.Contracts;
using DocParsing.Api.Data;
using DocParsing.Api.Models;
using DocParsing.Api.Services;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace DocParsing.Api.Controllers;

[ApiController]
[Route("api/[controller]")]
public class DocumentsController(
    IDocumentIntelligenceService intelligence,
    IBlobStorageService blobs,
    AppDbContext db,
    ILogger<DocumentsController> logger) : ControllerBase
{
    private const long MaxUploadBytes = 20 * 1024 * 1024;
    private const string DefaultModelId = "prebuilt-invoice";

    [HttpGet]
    public async Task<ActionResult<IReadOnlyList<DocumentSummary>>> List(CancellationToken ct)
    {
        var summaries = await db.Documents
            .OrderByDescending(d => d.CreatedAt)
            .Take(50)
            .Select(d => new DocumentSummary(
                d.Id,
                d.OriginalFileName,
                d.Status.ToString(),
                d.CreatedAt,
                d.ExtractedFields.Count,
                d.Template != null ? d.Template.Name : null))
            .ToListAsync(ct);

        return Ok(summaries);
    }

    [HttpGet("{id:guid}")]
    public async Task<ActionResult<DocumentResponse>> Get(Guid id, CancellationToken ct)
    {
        var doc = await db.Documents
            .Include(d => d.ExtractedFields)
            .Include(d => d.ExtractedTables)
            .Include(d => d.Template)
            .FirstOrDefaultAsync(d => d.Id == id, ct);

        if (doc is null) return NotFound();
        return Ok(DocumentResponse.FromEntity(doc));
    }

    [HttpGet("{id:guid}/file")]
    public async Task<IActionResult> GetFile(Guid id, CancellationToken ct)
    {
        var doc = await db.Documents.AsNoTracking().FirstOrDefaultAsync(d => d.Id == id, ct);
        if (doc is null) return NotFound();

        var stream = await blobs.TryOpenReadAsync(doc.StoragePath, ct);
        if (stream is null) return NotFound();

        var contentType = GuessContentType(doc.OriginalFileName);
        return File(stream, contentType, doc.OriginalFileName);
    }

    [HttpPost("upload")]
    [RequestSizeLimit(MaxUploadBytes)]
    public async Task<ActionResult<DocumentResponse>> Upload(
        IFormFile file,
        [FromForm] string? modelId,
        [FromForm] string? templateMode,
        [FromForm] Guid? templateId,
        CancellationToken ct)
    {
        if (file is null || file.Length == 0)
            return BadRequest(new { error = "No file provided." });

        // Validate the template-mode contract before doing expensive work
        // (file save, Azure DI call). Fail-fast keeps bad requests cheap.
        var mode = TemplateApplyMode.Auto;
        if (!string.IsNullOrWhiteSpace(templateMode)
            && !Enum.TryParse(templateMode, ignoreCase: true, out mode))
        {
            return BadRequest(new { error = "Invalid templateMode. Use: auto, manual, none." });
        }

        Template? manualTemplate = null;
        if (mode == TemplateApplyMode.Manual)
        {
            if (templateId is null)
                return BadRequest(new { error = "templateId is required when templateMode=manual." });

            manualTemplate = await db.Templates
                .Include(t => t.Rules)
                .FirstOrDefaultAsync(t => t.Id == templateId, ct);

            if (manualTemplate is null)
                return NotFound(new { error = "Template not found." });
        }

        var id = Guid.NewGuid();
        var safeName = Path.GetFileName(file.FileName);
        var blobName = $"{id:N}-{safeName}";
        var contentType = string.IsNullOrWhiteSpace(file.ContentType)
            ? GuessContentType(safeName)
            : file.ContentType;

        // Buffer once so we can both upload to blob storage and feed the same
        // bytes into Azure DI without a second network round-trip.
        await using var buffer = new MemoryStream();
        await file.CopyToAsync(buffer, ct);

        buffer.Position = 0;
        await blobs.UploadAsync(blobName, buffer, contentType, ct);

        var document = new Document
        {
            Id = id,
            OriginalFileName = safeName,
            StoragePath = blobName,
            ModelId = string.IsNullOrWhiteSpace(modelId) ? DefaultModelId : modelId,
            Status = DocumentStatus.Analyzing,
            CreatedAt = DateTime.UtcNow,
        };

        try
        {
            buffer.Position = 0;
            var extraction = await intelligence.AnalyzeAsync(buffer, document.ModelId, ct);

            foreach (var f in extraction.Fields)
            {
                document.ExtractedFields.Add(new ExtractedField
                {
                    Id = Guid.NewGuid(),
                    DocumentId = document.Id,
                    Name = f.Name,
                    Value = f.Value,
                    DataType = f.DataType,
                    Confidence = f.Confidence,
                    BoundingRegionsJson = f.BoundingRegions.Count == 0
                        ? null
                        : JsonSerializer.Serialize(f.BoundingRegions),
                });
            }

            foreach (var t in extraction.Tables)
            {
                document.ExtractedTables.Add(new ExtractedTable
                {
                    Id = Guid.NewGuid(),
                    DocumentId = document.Id,
                    Index = t.Index,
                    PageNumber = t.PageNumber,
                    RowCount = t.RowCount,
                    ColumnCount = t.ColumnCount,
                    BoundingRegionsJson = t.BoundingRegions.Count == 0
                        ? null
                        : JsonSerializer.Serialize(ToRegionResponses(t.BoundingRegions)),
                    // Project service-layer cells into the wire/storage shape so
                    // TableResponse.FromEntity round-trips cleanly. IsCorrected
                    // starts false and flips on the first user edit.
                    CellsJson = JsonSerializer.Serialize(
                        t.Cells.Select(c => new TableCellResponse(
                            RowIndex: c.RowIndex,
                            ColumnIndex: c.ColumnIndex,
                            RowSpan: c.RowSpan,
                            ColumnSpan: c.ColumnSpan,
                            Kind: c.Kind,
                            Content: c.Content,
                            IsCorrected: false,
                            BoundingRegions: ToRegionResponses(c.BoundingRegions))).ToList()),
                });
            }

            document.Status = DocumentStatus.Completed;
            document.CompletedAt = DateTime.UtcNow;

            switch (mode)
            {
                case TemplateApplyMode.Auto:
                    await TryMatchTemplateAsync(document, extraction.Pages, ct);
                    break;

                case TemplateApplyMode.Manual when manualTemplate is not null:
                    document.Template = manualTemplate;
                    ApplyTemplateRules(document, manualTemplate, extraction.Pages);
                    break;

                case TemplateApplyMode.None:
                    // User opted out — skip all template logic.
                    break;
            }
        }
        catch (Exception ex)
        {
            logger.LogError(ex, "Analysis failed for document {Id}", document.Id);
            document.Status = DocumentStatus.Failed;
            document.ErrorMessage = ex.Message;
        }

        db.Documents.Add(document);
        await db.SaveChangesAsync(ct);

        return Ok(DocumentResponse.FromEntity(document));
    }

    /// <summary>
    /// Stopgap template matching: pulls the model's identifier field
    /// (VendorName for invoices, Employer.Name for W-2s, etc., resolved via
    /// <see cref="DocumentTypeCatalog"/>) and finds the most recent template
    /// for the same model whose VendorHint matches case-insensitively.
    /// Phase 2 will replace this heuristic with layout-fingerprint matching.
    /// </summary>
    private async Task TryMatchTemplateAsync(
        Document document,
        IReadOnlyList<PageExtraction> pages,
        CancellationToken ct)
    {
        var typeDef = DocumentTypeCatalog.Find(document.ModelId);
        if (typeDef is null) return;

        var identifierValue = document.ExtractedFields
            .FirstOrDefault(f =>
                f.Name.Equals(typeDef.IdentifierFieldPath, StringComparison.OrdinalIgnoreCase) &&
                !string.IsNullOrWhiteSpace(f.Value))
            ?.Value?.Trim();

        if (string.IsNullOrWhiteSpace(identifierValue)) return;

        var normalized = identifierValue.ToLowerInvariant();
        var modelId = document.ModelId;

        // Scope by ModelId so a W-2 upload never picks up an invoice template
        // even if their identifier strings happen to collide.
        var match = await db.Templates
            .Include(t => t.Rules)
            .Where(t => t.ModelId == modelId
                        && t.VendorHint != null
                        && t.VendorHint.ToLower() == normalized)
            .OrderByDescending(t => t.CreatedAt)
            .FirstOrDefaultAsync(ct);

        if (match is not null)
        {
            document.Template = match;
            ApplyTemplateRules(document, match, pages);
        }
    }

    /// <summary>
    /// Applies a matched template's rules to a freshly-extracted document.
    /// For fields Azure DI already extracted (matched by name, case-insensitive),
    /// overrides <see cref="ExtractedField.DataType"/> and
    /// <see cref="ExtractedField.IsRequired"/> from the rule. For rules that
    /// weren't extracted at all, runs a region-based word pickup against the
    /// layout results and injects a field with the extracted value (or an
    /// empty placeholder with zero confidence if no words fell inside).
    /// </summary>
    private static void ApplyTemplateRules(
        Document document,
        Template template,
        IReadOnlyList<PageExtraction> pages)
    {
        foreach (var rule in template.Rules)
        {
            var existing = document.ExtractedFields
                .FirstOrDefault(f => f.Name.Equals(rule.Name, StringComparison.OrdinalIgnoreCase));

            if (existing is not null)
            {
                // Override type + required flag; leave AI-extracted value,
                // confidence, and bounding regions untouched.
                existing.DataType = rule.DataType;
                existing.IsRequired = rule.IsRequired;
                continue;
            }

            // AI didn't extract this field — attempt to pull text from the
            // layout words inside the rule's saved region.
            var (value, confidence) = ExtractTextFromRule(rule, pages);

            document.ExtractedFields.Add(new ExtractedField
            {
                Id = Guid.NewGuid(),
                DocumentId = document.Id,
                Name = rule.Name,
                Value = value,
                DataType = rule.DataType,
                Confidence = confidence,
                IsRequired = rule.IsRequired,
                IsCorrected = false,
                IsUserAdded = true,
                BoundingRegionsJson = rule.BoundingRegionsJson,
            });
        }
    }

    [HttpPost("{documentId:guid}/fields")]
    public async Task<ActionResult<ExtractedFieldResponse>> CreateField(
        Guid documentId,
        [FromBody] CreateFieldRequest request,
        CancellationToken ct)
    {
        if (!ModelState.IsValid) return ValidationProblem(ModelState);

        var documentExists = await db.Documents.AnyAsync(d => d.Id == documentId, ct);
        if (!documentExists) return NotFound();

        var boundingRegions = new[]
        {
            new BoundingRegionResponse(request.PageNumber, request.Polygon.ToArray()),
        };

        var field = new ExtractedField
        {
            Id = Guid.NewGuid(),
            DocumentId = documentId,
            Name = request.Name.Trim(),
            Value = null,
            DataType = request.DataType,
            Confidence = 1.0f,
            IsRequired = request.IsRequired,
            IsCorrected = true,
            CorrectedAt = DateTime.UtcNow,
            IsUserAdded = true,
            BoundingRegionsJson = JsonSerializer.Serialize(boundingRegions),
        };

        db.ExtractedFields.Add(field);
        await db.SaveChangesAsync(ct);

        return CreatedAtAction(
            actionName: nameof(Get),
            routeValues: new { id = documentId },
            value: ExtractedFieldResponse.FromEntity(field));
    }

    [HttpDelete("{documentId:guid}/fields/{fieldId:guid}")]
    public async Task<IActionResult> DeleteField(
        Guid documentId,
        Guid fieldId,
        CancellationToken ct)
    {
        var field = await db.ExtractedFields
            .FirstOrDefaultAsync(f => f.Id == fieldId && f.DocumentId == documentId, ct);

        if (field is null) return NotFound();

        db.ExtractedFields.Remove(field);
        await db.SaveChangesAsync(ct);

        return NoContent();
    }

    [HttpPatch("{documentId:guid}/fields/{fieldId:guid}")]
    public async Task<ActionResult<ExtractedFieldResponse>> UpdateField(
        Guid documentId,
        Guid fieldId,
        [FromBody] UpdateFieldRequest update,
        CancellationToken ct)
    {
        var field = await db.ExtractedFields
            .FirstOrDefaultAsync(f => f.Id == fieldId && f.DocumentId == documentId, ct);

        if (field is null) return NotFound();

        var changed = false;

        if (update.Value is not null && update.Value != field.Value)
        {
            field.Value = update.Value;
            changed = true;
        }

        if (!string.IsNullOrWhiteSpace(update.DataType) && update.DataType != field.DataType)
        {
            field.DataType = update.DataType;
            changed = true;
        }

        if (update.IsRequired is bool required && required != field.IsRequired)
        {
            field.IsRequired = required;
            changed = true;
        }

        if (changed)
        {
            field.IsCorrected = true;
            field.CorrectedAt = DateTime.UtcNow;
            await db.SaveChangesAsync(ct);
        }

        return Ok(ExtractedFieldResponse.FromEntity(field));
    }

    [HttpPatch("{documentId:guid}/tables/{tableId:guid}/cells")]
    public async Task<ActionResult<TableCellResponse>> UpdateTableCell(
        Guid documentId,
        Guid tableId,
        [FromBody] UpdateTableCellRequest request,
        CancellationToken ct)
    {
        var table = await db.ExtractedTables
            .FirstOrDefaultAsync(t => t.Id == tableId && t.DocumentId == documentId, ct);

        if (table is null) return NotFound();

        if (request.RowIndex < 0 || request.RowIndex >= table.RowCount ||
            request.ColumnIndex < 0 || request.ColumnIndex >= table.ColumnCount)
        {
            return BadRequest(new { error = "Cell coordinates out of range." });
        }

        var cells = JsonSerializer.Deserialize<List<TableCellResponse>>(table.CellsJson)
                    ?? new List<TableCellResponse>();

        // Cells are addressed by (row, col) — for merged cells, that's the
        // top-left position (Azure's convention; the frontend resolves clicks
        // anywhere in the merged region back to top-left before sending).
        var index = cells.FindIndex(c =>
            c.RowIndex == request.RowIndex && c.ColumnIndex == request.ColumnIndex);

        if (index < 0)
        {
            return NotFound(new { error = "Cell not found at the given coordinates." });
        }

        var existing = cells[index];

        // No-op when content is unchanged — preserves IsCorrected as-is so a
        // re-save of the original value doesn't visually flag a clean cell.
        if (existing.Content == request.Content)
        {
            return Ok(existing);
        }

        var updated = existing with
        {
            Content = request.Content,
            IsCorrected = true,
        };

        cells[index] = updated;
        table.CellsJson = JsonSerializer.Serialize(cells);

        await db.SaveChangesAsync(ct);

        return Ok(updated);
    }

    /// <summary>
    /// Picks layout words whose center point falls inside the rule's
    /// axis-aligned bounding region, concatenates them, and averages their
    /// confidence. Returns <c>(null, 0)</c> when the region is missing, the
    /// page isn't in the layout, or no words fell inside.
    /// </summary>
    private static (string? Value, float Confidence) ExtractTextFromRule(
        TemplateFieldRule rule,
        IReadOnlyList<PageExtraction> pages)
    {
        if (string.IsNullOrWhiteSpace(rule.BoundingRegionsJson))
            return (null, 0f);

        var regions = JsonSerializer.Deserialize<List<BoundingRegionResponse>>(rule.BoundingRegionsJson);
        if (regions is null || regions.Count == 0) return (null, 0f);

        var region = regions[0];
        var page = pages.FirstOrDefault(p => p.PageNumber == region.PageNumber);
        if (page is null) return (null, 0f);

        var bounds = AxisAlignedBounds(region.Polygon);
        if (!bounds.HasValue) return (null, 0f);

        var matched = page.Words
            .Where(w => WordCenterInside(w.Polygon, bounds.Value))
            .ToList();

        if (matched.Count == 0) return (null, 0f);

        var value = string.Join(" ", matched.Select(w => w.Content)).Trim();
        var confidence = matched.Average(w => w.Confidence);

        return (string.IsNullOrWhiteSpace(value) ? null : value, confidence);
    }

    private static (float MinX, float MinY, float MaxX, float MaxY)? AxisAlignedBounds(
        IReadOnlyList<float> polygon)
    {
        if (polygon is null || polygon.Count < 2) return null;

        float minX = float.MaxValue, minY = float.MaxValue;
        float maxX = float.MinValue, maxY = float.MinValue;

        for (int i = 0; i + 1 < polygon.Count; i += 2)
        {
            var x = polygon[i];
            var y = polygon[i + 1];
            if (x < minX) minX = x;
            if (x > maxX) maxX = x;
            if (y < minY) minY = y;
            if (y > maxY) maxY = y;
        }

        return (minX, minY, maxX, maxY);
    }

    private static bool WordCenterInside(
        IReadOnlyList<float> wordPolygon,
        (float MinX, float MinY, float MaxX, float MaxY) bounds)
    {
        if (wordPolygon is null || wordPolygon.Count < 2) return false;

        float sumX = 0, sumY = 0;
        int count = 0;
        for (int i = 0; i + 1 < wordPolygon.Count; i += 2)
        {
            sumX += wordPolygon[i];
            sumY += wordPolygon[i + 1];
            count++;
        }
        if (count == 0) return false;

        var cx = sumX / count;
        var cy = sumY / count;

        return cx >= bounds.MinX && cx <= bounds.MaxX && cy >= bounds.MinY && cy <= bounds.MaxY;
    }

    private static List<BoundingRegionResponse> ToRegionResponses(
        IReadOnlyList<BoundingRegionData> regions) =>
        regions
            .Select(r => new BoundingRegionResponse(r.PageNumber, r.Polygon.ToArray()))
            .ToList();

    private static string GuessContentType(string fileName) => Path.GetExtension(fileName).ToLowerInvariant() switch
    {
        ".pdf" => "application/pdf",
        ".png" => "image/png",
        ".jpg" or ".jpeg" => "image/jpeg",
        ".tif" or ".tiff" => "image/tiff",
        _ => "application/octet-stream",
    };
}
