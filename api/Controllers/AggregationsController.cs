using System.Text.Json;
using DocParsing.Api.Aggregations;
using DocParsing.Api.Contracts;
using DocParsing.Api.Data;
using DocParsing.Api.Models;
using DocParsing.Api.Services;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace DocParsing.Api.Controllers;

[ApiController]
[Route("api/documents/{documentId:guid}/aggregations")]
public class AggregationsController(
    AppDbContext db,
    ILayoutStorageService layoutStorage) : ControllerBase
{
    /// <summary>
    /// Filters the document's layout words to the drawn polygon, parses
    /// numeric tokens, and returns them so the aggregation modal can render
    /// a live preview. Triggers the lazy-backfill path when a legacy
    /// document has no persisted layout blob yet.
    /// </summary>
    [HttpPost("preview")]
    public async Task<ActionResult<AggregationPreviewResponse>> Preview(
        Guid documentId,
        [FromBody] AggregationPreviewRequest request,
        CancellationToken ct)
    {
        if (!ModelState.IsValid) return ValidationProblem(ModelState);

        var doc = await db.Documents
            .AsNoTracking()
            .FirstOrDefaultAsync(d => d.Id == documentId, ct);

        if (doc is null) return NotFound();

        var pages = await layoutStorage.GetOrBackfillAsync(documentId, doc.StoragePath, ct);
        if (pages is null)
        {
            // Original PDF blob is missing — broken document, can't recover.
            return NotFound(new { error = "Document layout is unavailable." });
        }

        var page = pages.FirstOrDefault(p => p.PageNumber == request.PageNumber);
        if (page is null)
        {
            // Frontend asked for a page outside the document's range. Soft
            // failure (empty token list) rather than 400 — the modal can
            // surface "no numbers detected" gracefully.
            return Ok(new AggregationPreviewResponse(Array.Empty<AggregationTokenResponse>()));
        }

        var matched = PolygonGeometry.WordsInsideRegion(page.Words, request.Polygon);

        var tokens = NumberTokenParser.ParseWords(matched)
            .Select(t => new AggregationTokenResponse(
                Text: t.Source.Content,
                Value: t.Value,
                Confidence: t.Source.Confidence,
                Polygon: t.Source.Polygon.ToArray()))
            .ToList();

        return Ok(new AggregationPreviewResponse(tokens));
    }

    /// <summary>
    /// Commits an aggregation field on the document and — when the document
    /// is matched to a template — auto-promotes it to a
    /// <see cref="TemplateAggregationRule"/> so future uploads replay it.
    /// Recomputes the result server-side from the layout (rather than
    /// trusting a client-side number) so the persisted value is always the
    /// canonical answer.
    /// </summary>
    [HttpPost]
    public async Task<ActionResult<ExtractedFieldResponse>> Create(
        Guid documentId,
        [FromBody] CreateAggregationRequest request,
        CancellationToken ct)
    {
        if (!ModelState.IsValid) return ValidationProblem(ModelState);

        if (!AggregationCompute.TryParseOperation(request.Operation, out var operation))
        {
            return BadRequest(new { error = "Invalid operation. Use: Sum, Average, Count, Min, Max." });
        }

        var doc = await db.Documents
            .Include(d => d.Template)
            .ThenInclude(t => t!.AggregationRules)
            .FirstOrDefaultAsync(d => d.Id == documentId, ct);

        if (doc is null) return NotFound();

        var pages = await layoutStorage.GetOrBackfillAsync(documentId, doc.StoragePath, ct);
        if (pages is null)
        {
            return NotFound(new { error = "Document layout is unavailable." });
        }

        var evaluatedAt = DateTime.UtcNow;
        var evaluation = AggregationEvaluator.Evaluate(
            operation, request.Polygon, request.PageNumber, pages, evaluatedAt);

        var name = request.Name.Trim();
        var regions = new[] { new BoundingRegionResponse(request.PageNumber, request.Polygon.ToArray()) };
        var regionsJson = JsonSerializer.Serialize(regions);
        var configJson = JsonSerializer.Serialize(evaluation.Config);

        var field = new ExtractedField
        {
            Id = Guid.NewGuid(),
            DocumentId = documentId,
            Name = name,
            Value = evaluation.Value,
            DataType = "Number",
            Confidence = evaluation.Confidence,
            IsRequired = request.IsRequired,
            IsCorrected = true,
            CorrectedAt = evaluatedAt,
            IsUserAdded = true,
            BoundingRegionsJson = regionsJson,
            AggregationConfigJson = configJson,
        };

        db.ExtractedFields.Add(field);

        // Auto-promote to a template rule so future matching uploads replay
        // the aggregation. Templateless documents keep the aggregation as a
        // local field only; promotion happens automatically when the user
        // later saves the document as a new template.
        if (doc.Template is not null)
        {
            doc.Template.AggregationRules.Add(new TemplateAggregationRule
            {
                Id = Guid.NewGuid(),
                TemplateId = doc.Template.Id,
                Name = name,
                Operation = operation.ToString(),
                IsRequired = request.IsRequired,
                BoundingRegionsJson = regionsJson,
            });
        }

        await db.SaveChangesAsync(ct);

        return CreatedAtAction(
            actionName: nameof(DocumentsController.Get),
            controllerName: "Documents",
            routeValues: new { id = documentId },
            value: ExtractedFieldResponse.FromEntity(field));
    }
}
