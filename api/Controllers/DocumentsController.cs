using System.Text.Json;
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
    AppDbContext db,
    IHostEnvironment env,
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
            .Include(d => d.Template)
            .FirstOrDefaultAsync(d => d.Id == id, ct);

        if (doc is null) return NotFound();
        return Ok(DocumentResponse.FromEntity(doc));
    }

    [HttpGet("{id:guid}/file")]
    public IActionResult GetFile(Guid id)
    {
        var doc = db.Documents.AsNoTracking().FirstOrDefault(d => d.Id == id);
        if (doc is null || !System.IO.File.Exists(doc.StoragePath)) return NotFound();

        var stream = System.IO.File.OpenRead(doc.StoragePath);
        var contentType = GuessContentType(doc.OriginalFileName);
        return File(stream, contentType, doc.OriginalFileName);
    }

    [HttpPost("upload")]
    [RequestSizeLimit(MaxUploadBytes)]
    public async Task<ActionResult<DocumentResponse>> Upload(
        IFormFile file,
        [FromQuery] string? modelId,
        CancellationToken ct)
    {
        if (file is null || file.Length == 0)
            return BadRequest(new { error = "No file provided." });

        var uploadsDir = Path.Combine(env.ContentRootPath, "uploads");
        Directory.CreateDirectory(uploadsDir);

        var id = Guid.NewGuid();
        var safeName = Path.GetFileName(file.FileName);
        var storagePath = Path.Combine(uploadsDir, $"{id:N}-{safeName}");

        await using (var fs = System.IO.File.Create(storagePath))
        {
            await file.CopyToAsync(fs, ct);
        }

        var document = new Document
        {
            Id = id,
            OriginalFileName = safeName,
            StoragePath = storagePath,
            ModelId = string.IsNullOrWhiteSpace(modelId) ? DefaultModelId : modelId,
            Status = DocumentStatus.Analyzing,
            CreatedAt = DateTime.UtcNow,
        };

        try
        {
            var extraction = await intelligence.AnalyzeAsync(storagePath, document.ModelId, ct);

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

            document.Status = DocumentStatus.Completed;
            document.CompletedAt = DateTime.UtcNow;

            await TryMatchTemplateAsync(document, extraction.Pages, ct);
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
    /// Stopgap template matching: if Azure DI extracted a VendorName, find
    /// the most recent template whose VendorHint matches (case-insensitive),
    /// attach it to the document, and apply its field rules. Phase 2 will
    /// replace the vendor heuristic with layout-fingerprint matching.
    /// </summary>
    private async Task TryMatchTemplateAsync(
        Document document,
        IReadOnlyList<PageExtraction> pages,
        CancellationToken ct)
    {
        var vendorValue = document.ExtractedFields
            .FirstOrDefault(f =>
                f.Name.Equals("VendorName", StringComparison.OrdinalIgnoreCase) &&
                !string.IsNullOrWhiteSpace(f.Value))
            ?.Value?.Trim();

        if (string.IsNullOrWhiteSpace(vendorValue)) return;

        var normalized = vendorValue.ToLowerInvariant();

        var match = await db.Templates
            .Include(t => t.Rules)
            .Where(t => t.VendorHint != null && t.VendorHint.ToLower() == normalized)
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

    private static string GuessContentType(string fileName) => Path.GetExtension(fileName).ToLowerInvariant() switch
    {
        ".pdf" => "application/pdf",
        ".png" => "image/png",
        ".jpg" or ".jpeg" => "image/jpeg",
        ".tif" or ".tiff" => "image/tiff",
        _ => "application/octet-stream",
    };
}
