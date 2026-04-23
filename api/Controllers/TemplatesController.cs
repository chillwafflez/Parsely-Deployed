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
                t.VendorHint,
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

    [HttpPut("{id:guid}")]
    public async Task<ActionResult<TemplateResponse>> Update(
        Guid id,
        [FromBody] UpdateTemplateRequest request,
        CancellationToken ct)
    {
        if (!ModelState.IsValid) return ValidationProblem(ModelState);

        var template = await db.Templates
            .Include(t => t.Rules)
            .FirstOrDefaultAsync(t => t.Id == id, ct);

        if (template is null) return NotFound();

        // Reject any incoming id that doesn't belong to this template — this
        // prevents a caller from guessing a rule id on another template and
        // mutating it through this endpoint.
        var existingById = template.Rules.ToDictionary(r => r.Id);
        foreach (var incoming in request.Rules)
        {
            if (!existingById.ContainsKey(incoming.Id))
            {
                return BadRequest(new { error = $"Rule {incoming.Id} does not belong to this template." });
            }
        }

        template.Name = request.Name.Trim();
        template.Description = string.IsNullOrWhiteSpace(request.Description) ? null : request.Description.Trim();
        template.Kind = request.Kind.Trim();
        template.VendorHint = string.IsNullOrWhiteSpace(request.VendorHint) ? null : request.VendorHint.Trim();

        var incomingIds = request.Rules.Select(r => r.Id).ToHashSet();

        // Build the full mutation graph before persisting so we only call
        // SaveChangesAsync once — double-save triggers DbUpdateConcurrencyException
        // on EF Core when the change tracker sees the collection replaced twice.
        foreach (var rule in template.Rules.ToList())
        {
            if (!incomingIds.Contains(rule.Id))
            {
                db.TemplateFieldRules.Remove(rule);
            }
        }

        foreach (var incoming in request.Rules)
        {
            var rule = existingById[incoming.Id];
            rule.Name = incoming.Name.Trim();
            rule.DataType = incoming.DataType.Trim();
            rule.IsRequired = incoming.IsRequired;
            rule.Hint = string.IsNullOrWhiteSpace(incoming.Hint) ? null : incoming.Hint.Trim();
            rule.SetAliases(incoming.Aliases);
        }

        await db.SaveChangesAsync(ct);

        var runs = await db.Documents.CountAsync(d => d.TemplateId == id, ct);

        // Re-read with AsNoTracking so the response reflects the canonical
        // persisted shape (FromEntity sorts rules by Name, and any deletes
        // above shouldn't leave stale tracked instances in the payload).
        var refreshed = await db.Templates
            .Include(t => t.Rules)
            .AsNoTracking()
            .FirstAsync(t => t.Id == id, ct);

        logger.LogInformation(
            "Updated template {TemplateId} ({Name}) — {RuleCount} rules after reconcile",
            refreshed.Id, refreshed.Name, refreshed.Rules.Count);

        return Ok(TemplateResponse.FromEntity(refreshed, runs));
    }

    [HttpPost("{id:guid}/duplicate")]
    public async Task<ActionResult<TemplateResponse>> Duplicate(Guid id, CancellationToken ct)
    {
        var source = await db.Templates
            .Include(t => t.Rules)
            .AsNoTracking()
            .FirstOrDefaultAsync(t => t.Id == id, ct);

        if (source is null) return NotFound();

        var newName = await ResolveDuplicateNameAsync(source.Name, ct);

        var copy = new Template
        {
            Id = Guid.NewGuid(),
            Name = newName,
            Kind = source.Kind,
            Description = source.Description,
            ApplyTo = source.ApplyTo,
            VendorHint = source.VendorHint,
            SourceDocumentId = source.SourceDocumentId,
            CreatedAt = DateTime.UtcNow,
            Rules = source.Rules
                .Select(r => new TemplateFieldRule
                {
                    Id = Guid.NewGuid(),
                    Name = r.Name,
                    DataType = r.DataType,
                    IsRequired = r.IsRequired,
                    BoundingRegionsJson = r.BoundingRegionsJson,
                    Hint = r.Hint,
                    AliasesJson = r.AliasesJson,
                })
                .ToList(),
        };

        db.Templates.Add(copy);
        await db.SaveChangesAsync(ct);

        logger.LogInformation(
            "Duplicated template {SourceId} → {NewId} ({Name}) with {RuleCount} rules",
            source.Id, copy.Id, copy.Name, copy.Rules.Count);

        return CreatedAtAction(
            actionName: nameof(Get),
            routeValues: new { id = copy.Id },
            value: TemplateResponse.FromEntity(copy, runs: 0));
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

    /// <summary>
    /// Picks a non-colliding "(copy)" / "(copy 2)" / "(copy 3)" name for a
    /// duplicated template. Matches Finder/Explorer behavior — the user never
    /// hits a wall if they duplicate repeatedly.
    /// </summary>
    private async Task<string> ResolveDuplicateNameAsync(string baseName, CancellationToken ct)
    {
        var candidate = $"{baseName} (copy)";
        if (!await db.Templates.AnyAsync(t => t.Name == candidate, ct)) return candidate;

        for (var n = 2; ; n++)
        {
            candidate = $"{baseName} (copy {n})";
            if (!await db.Templates.AnyAsync(t => t.Name == candidate, ct)) return candidate;
        }
    }
}
