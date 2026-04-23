using System.ComponentModel.DataAnnotations;
using System.Text.Json;
using DocParsing.Api.Models;

namespace DocParsing.Api.Contracts;

public record TemplateSummary(
    Guid Id,
    string Name,
    string Kind,
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
