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
            BoundingRegions: regions);
    }
}

public record CreateTemplateRequest(
    [Required, StringLength(256, MinimumLength = 1)] string Name,
    [Required, StringLength(64, MinimumLength = 1)] string Kind,
    [StringLength(2048)] string? Description,
    [Required, RegularExpression("^(vendor|similar|all)$")] string ApplyTo,
    [Required] Guid SourceDocumentId);
