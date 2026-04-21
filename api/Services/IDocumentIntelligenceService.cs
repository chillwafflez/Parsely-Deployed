namespace DocParsing.Api.Services;

public interface IDocumentIntelligenceService
{
    Task<DocumentExtractionResult> AnalyzeAsync(
        string filePath,
        string modelId,
        CancellationToken cancellationToken = default);
}

/// <summary>
/// Combined result of a single Azure Document Intelligence call: the
/// structured fields the prebuilt model extracted, plus the underlying
/// word-level OCR (layout). The latter lets us apply template rules that
/// target regions the prebuilt model didn't recognize as named fields.
/// </summary>
public record DocumentExtractionResult(
    IReadOnlyList<ExtractedFieldData> Fields,
    IReadOnlyList<PageExtraction> Pages);

public record PageExtraction(int PageNumber, IReadOnlyList<WordData> Words);

public record WordData(
    string Content,
    IReadOnlyList<float> Polygon,
    float Confidence);

public record ExtractedFieldData(
    string Name,
    string? Value,
    string DataType,
    float Confidence,
    IReadOnlyList<BoundingRegionData> BoundingRegions);

public record BoundingRegionData(int PageNumber, IReadOnlyList<float> Polygon);
