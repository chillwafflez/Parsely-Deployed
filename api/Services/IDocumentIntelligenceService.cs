namespace DocParsing.Api.Services;

public interface IDocumentIntelligenceService
{
    Task<IReadOnlyList<ExtractedFieldData>> AnalyzeAsync(
        string filePath,
        string modelId,
        CancellationToken cancellationToken = default);
}

public record ExtractedFieldData(
    string Name,
    string? Value,
    string DataType,
    float Confidence,
    IReadOnlyList<BoundingRegionData> BoundingRegions);

public record BoundingRegionData(int PageNumber, IReadOnlyList<float> Polygon);
