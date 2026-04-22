using DocParsing.Api.Contracts;
using DocParsing.Api.Data;
using DocParsing.Api.Models;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace DocParsing.Api.Controllers;

[ApiController]
[Route("api/[controller]")]
public class TemplatesController(AppDbContext db, ILogger<TemplatesController> logger) : ControllerBase
{
    [HttpGet]
    public async Task<ActionResult<IReadOnlyList<TemplateSummary>>> List(CancellationToken ct)
    {
        var templates = await db.Templates
            .AsNoTracking()
            .OrderByDescending(t => t.CreatedAt)
            .Select(t => new TemplateSummary(
                t.Id,
                t.Name,
                t.Kind,
                t.Description,
                t.ApplyTo,
                t.CreatedAt,
                t.Rules.Count,
                db.Documents.Count(d => d.TemplateId == t.Id)))
            .ToListAsync(ct);

        return Ok(templates);
    }

    [HttpGet("{id:guid}")]
    public async Task<ActionResult<TemplateResponse>> Get(Guid id, CancellationToken ct)
    {
        var template = await db.Templates
            .Include(t => t.Rules)
            .AsNoTracking()
            .FirstOrDefaultAsync(t => t.Id == id, ct);

        if (template is null) return NotFound();

        var runs = await db.Documents.CountAsync(d => d.TemplateId == id, ct);
        return Ok(TemplateResponse.FromEntity(template, runs));
    }

    [HttpPost]
    public async Task<ActionResult<TemplateResponse>> Create(
        [FromBody] CreateTemplateRequest request,
        CancellationToken ct)
    {
        if (!ModelState.IsValid) return ValidationProblem(ModelState);

        var sourceDoc = await db.Documents
            .Include(d => d.ExtractedFields)
            .FirstOrDefaultAsync(d => d.Id == request.SourceDocumentId, ct);

        if (sourceDoc is null)
        {
            return BadRequest(new { error = "Source document not found." });
        }

        var vendorHint = sourceDoc.ExtractedFields
            .FirstOrDefault(f =>
                f.Name.Equals("VendorName", StringComparison.OrdinalIgnoreCase) &&
                !string.IsNullOrWhiteSpace(f.Value))
            ?.Value?.Trim();

        // Overrides arrive keyed by field name; swap to a case-insensitive
        // lookup so minor casing drift (e.g. "vendorname" vs "VendorName")
        // doesn't silently drop the user's hint/aliases.
        var overrides = request.RuleOverrides is null
            ? new Dictionary<string, RuleOverride>(StringComparer.OrdinalIgnoreCase)
            : new Dictionary<string, RuleOverride>(request.RuleOverrides, StringComparer.OrdinalIgnoreCase);

        var template = new Template
        {
            Id = Guid.NewGuid(),
            Name = request.Name.Trim(),
            Kind = request.Kind.Trim(),
            Description = string.IsNullOrWhiteSpace(request.Description) ? null : request.Description.Trim(),
            ApplyTo = request.ApplyTo,
            VendorHint = vendorHint,
            SourceDocumentId = sourceDoc.Id,
            CreatedAt = DateTime.UtcNow,
            Rules = sourceDoc.ExtractedFields
                .Select(f =>
                {
                    var rule = new TemplateFieldRule
                    {
                        Id = Guid.NewGuid(),
                        Name = f.Name,
                        DataType = f.DataType,
                        IsRequired = f.IsRequired,
                        BoundingRegionsJson = f.BoundingRegionsJson,
                    };

                    if (overrides.TryGetValue(f.Name, out var ovr))
                    {
                        rule.Hint = string.IsNullOrWhiteSpace(ovr.Hint) ? null : ovr.Hint.Trim();
                        rule.SetAliases(ovr.Aliases);
                    }

                    return rule;
                })
                .ToList(),
        };

        db.Templates.Add(template);

        // Link the source document to its newly-created template so the
        // Inspector header reflects "Template: X" on reload without a
        // separate round-trip.
        sourceDoc.TemplateId = template.Id;

        await db.SaveChangesAsync(ct);

        logger.LogInformation(
            "Created template {TemplateId} ({Name}) with {RuleCount} rules from document {DocumentId}",
            template.Id, template.Name, template.Rules.Count, sourceDoc.Id);

        return CreatedAtAction(
            actionName: nameof(Get),
            routeValues: new { id = template.Id },
            value: TemplateResponse.FromEntity(template, runs: 1));
    }

    [HttpDelete("{id:guid}")]
    public async Task<IActionResult> Delete(Guid id, CancellationToken ct)
    {
        var template = await db.Templates.FirstOrDefaultAsync(t => t.Id == id, ct);
        if (template is null) return NotFound();

        db.Templates.Remove(template);
        await db.SaveChangesAsync(ct);

        return NoContent();
    }
}
