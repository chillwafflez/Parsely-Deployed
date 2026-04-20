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
                d.ExtractedFields.Count))
            .ToListAsync(ct);

        return Ok(summaries);
    }

    [HttpGet("{id:guid}")]
    public async Task<ActionResult<DocumentResponse>> Get(Guid id, CancellationToken ct)
    {
        var doc = await db.Documents
            .Include(d => d.ExtractedFields)
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
            var fields = await intelligence.AnalyzeAsync(storagePath, document.ModelId, ct);

            foreach (var f in fields)
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

    private static string GuessContentType(string fileName) => Path.GetExtension(fileName).ToLowerInvariant() switch
    {
        ".pdf" => "application/pdf",
        ".png" => "image/png",
        ".jpg" or ".jpeg" => "image/jpeg",
        ".tif" or ".tiff" => "image/tiff",
        _ => "application/octet-stream",
    };
}
