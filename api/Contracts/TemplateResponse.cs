using System.ComponentModel.DataAnnotations;
using System.Text.Json;
using DocParsing.Api.Models;

namespace DocParsing.Api.Contracts;

public record TemplateSummary(
    Guid Id,
    string Name,
    string Kind,
    string ModelId,
    string? Description,
    string ApplyTo,
    string? VendorHint,
    DateTime CreatedAt,
    int RuleCount,
    int Runs);

public record TemplateResponse(
    Guid Id,
    string Name,
    string Kind,
    string ModelId,
    string? Description,
    string ApplyTo,
    string? VendorHint,
    DateTime CreatedAt,
    Guid? SourceDocumentId,
    int Runs,
    IReadOnlyList<TemplateFieldRuleResponse> Rules)
{
    public static TemplateResponse FromEntity(Template template, int runs) => new(
        Id: template.Id,
        Name: template.Name,
        Kind: template.Kind,
        ModelId: template.ModelId,
        Description: template.Description,
        ApplyTo: template.ApplyTo,
        VendorHint: template.VendorHint,
        CreatedAt: template.CreatedAt,
        SourceDocumentId: template.SourceDocumentId,
        Runs: runs,
        Rules: template.Rules
            .OrderBy(r => r.Name)
            .Select(TemplateFieldRuleResponse.FromEntity)
            .ToList());
}

public record TemplateFieldRuleResponse(
    Guid Id,
    string Name,
    string DataType,
    bool IsRequired,
    string? Hint,
    IReadOnlyList<string> Aliases,
    IReadOnlyList<BoundingRegionResponse> BoundingRegions)
{
    public static TemplateFieldRuleResponse FromEntity(TemplateFieldRule rule)
    {
        var regions = string.IsNullOrWhiteSpace(rule.BoundingRegionsJson)
            ? new List<BoundingRegionResponse>()
            : JsonSerializer.Deserialize<List<BoundingRegionResponse>>(rule.BoundingRegionsJson)
              ?? new List<BoundingRegionResponse>();

        return new TemplateFieldRuleResponse(
            Id: rule.Id,
            Name: rule.Name,
            DataType: rule.DataType,
            IsRequired: rule.IsRequired,
            Hint: rule.Hint,
            Aliases: rule.GetAliases(),
            BoundingRegions: regions);
    }
}

/// <summary>
/// Optional voice-fill overrides the user can supply per captured rule
/// when saving a template. Keyed by the rule's field name in
/// <see cref="CreateTemplateRequest.RuleOverrides"/>.
/// </summary>
public record RuleOverride(
    [StringLength(200)] string? Hint,
    IReadOnlyList<string>? Aliases);

public record CreateTemplateRequest(
    [Required, StringLength(256, MinimumLength = 1)] string Name,
    [Required, StringLength(64, MinimumLength = 1)] string Kind,
    [StringLength(2048)] string? Description,
    [Required, RegularExpression("^(vendor|similar|all)$")] string ApplyTo,
    [Required] Guid SourceDocumentId,
    IDictionary<string, RuleOverride>? RuleOverrides = null);

/// <summary>
/// Full-replace payload for the template edit page. Metadata is applied as-is;
/// the Rules collection is reconciled against the persisted rules by Id —
/// existing ids are updated in place, omitted ids are deleted. Adding new
/// rules is out of scope (requires a bounding region, which requires the
/// full PDF + draw tooling).
/// </summary>
public record UpdateTemplateRequest(
    [Required, StringLength(256, MinimumLength = 1)] string Name,
    [StringLength(2048)] string? Description,
    [Required, StringLength(64, MinimumLength = 1)] string Kind,
    [StringLength(512)] string? VendorHint,
    [Required] IReadOnlyList<UpdateTemplateRuleRequest> Rules);

public record UpdateTemplateRuleRequest(
    [Required] Guid Id,
    [Required, StringLength(256, MinimumLength = 1)] string Name,
    [Required, StringLength(64, MinimumLength = 1)] string DataType,
    bool IsRequired,
    [StringLength(200)] string? Hint,
    IReadOnlyList<string>? Aliases);

/// <summary>
/// Portable on-disk shape produced by <c>GET /api/templates/:id/export</c> and
/// consumed verbatim by <c>POST /api/templates/import</c>. Intentionally omits
/// all server-generated ids and any reference to the source document so the
/// file is safe to share across users and databases.
/// </summary>
public record TemplateExportPayload(
    int Version,
    string Name,
    string Kind,
    string? Description,
    string ApplyTo,
    string? VendorHint,
    IReadOnlyList<TemplateExportRule> Rules);

public record TemplateExportRule(
    string Name,
    string DataType,
    bool IsRequired,
    string? Hint,
    IReadOnlyList<string> Aliases,
    IReadOnlyList<BoundingRegionResponse> BoundingRegions);

/// <summary>
/// Import body — mirrors <see cref="TemplateExportPayload"/> field-for-field
/// with validation attributes so malformed or future-versioned files surface
/// a clean 400 instead of a half-populated row.
/// </summary>
public record ImportTemplateRequest(
    [Required, Range(1, 1)] int Version,
    [Required, StringLength(256, MinimumLength = 1)] string Name,
    [Required, StringLength(64, MinimumLength = 1)] string Kind,
    [StringLength(2048)] string? Description,
    [Required, RegularExpression("^(vendor|similar|all)$")] string ApplyTo,
    [StringLength(512)] string? VendorHint,
    [Required] IReadOnlyList<ImportTemplateRuleRequest> Rules);

public record ImportTemplateRuleRequest(
    [Required, StringLength(256, MinimumLength = 1)] string Name,
    [Required, StringLength(64, MinimumLength = 1)] string DataType,
    bool IsRequired,
    [StringLength(200)] string? Hint,
    IReadOnlyList<string>? Aliases,
    IReadOnlyList<BoundingRegionResponse>? BoundingRegions);
