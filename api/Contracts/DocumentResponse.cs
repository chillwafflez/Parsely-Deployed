using System.Text.Json;
using DocParsing.Api.Models;

namespace DocParsing.Api.Contracts;

public record DocumentResponse(
    Guid Id,
    string FileName,
    string ModelId,
    string Status,
    DateTime CreatedAt,
    DateTime? CompletedAt,
    string? ErrorMessage,
    Guid? TemplateId,
    string? TemplateName,
    IReadOnlyList<ExtractedFieldResponse> Fields,
    IReadOnlyList<TableResponse> Tables)
{
    public static DocumentResponse FromEntity(Document doc) => new(
        Id: doc.Id,
        FileName: doc.OriginalFileName,
        ModelId: doc.ModelId,
        Status: doc.Status.ToString(),
        CreatedAt: doc.CreatedAt,
        CompletedAt: doc.CompletedAt,
        ErrorMessage: doc.ErrorMessage,
        TemplateId: doc.TemplateId,
        TemplateName: doc.Template?.Name,
        Fields: doc.ExtractedFields
            .OrderBy(f => f.Name)
            .Select(ExtractedFieldResponse.FromEntity)
            .ToList(),
        Tables: doc.ExtractedTables
            .OrderBy(t => t.Index)
            .Select(TableResponse.FromEntity)
            .ToList());
}

public record ExtractedFieldResponse(
    Guid Id,
    string Name,
    string? Value,
    string DataType,
    float Confidence,
    bool IsRequired,
    bool IsCorrected,
    bool IsUserAdded,
    IReadOnlyList<BoundingRegionResponse> BoundingRegions)
{
    public static ExtractedFieldResponse FromEntity(ExtractedField f)
    {
        var regions = string.IsNullOrWhiteSpace(f.BoundingRegionsJson)
            ? new List<BoundingRegionResponse>()
            : JsonSerializer.Deserialize<List<BoundingRegionResponse>>(f.BoundingRegionsJson)
              ?? new List<BoundingRegionResponse>();

        return new ExtractedFieldResponse(
            Id: f.Id,
            Name: f.Name,
            Value: f.Value,
            DataType: f.DataType,
            Confidence: f.Confidence,
            IsRequired: f.IsRequired,
            IsCorrected: f.IsCorrected,
            IsUserAdded: f.IsUserAdded,
            BoundingRegions: regions);
    }
}

public record BoundingRegionResponse(int PageNumber, float[] Polygon);

public record DocumentSummary(
    Guid Id,
    string FileName,
    string Status,
    DateTime CreatedAt,
    int FieldCount,
    string? TemplateName);
