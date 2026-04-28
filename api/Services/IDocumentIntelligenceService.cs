namespace DocParsing.Api.Services;

public interface IDocumentIntelligenceService
{
    Task<DocumentExtractionResult> AnalyzeAsync(
        Stream content,
        string modelId,
        CancellationToken cancellationToken = default);
}

/// <summary>
/// Combined result of a single Azure Document Intelligence call: the
/// structured fields the prebuilt model extracted, the underlying
/// word-level OCR (layout) used for template-region text pickup, and the
/// detected tables (populated by every prebuilt that builds on the layout
/// substrate — invoice, receipt, W-2, paystub, bank-statement).
/// </summary>
public record DocumentExtractionResult(
    IReadOnlyList<ExtractedFieldData> Fields,
    IReadOnlyList<PageExtraction> Pages,
    IReadOnlyList<TableExtraction> Tables);

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

/// <summary>
/// A single table detected on the document. Cells are the source of truth
/// for both display and editing — RowCount/ColumnCount are convenience
/// dimensions for sizing the grid up front. <c>Source</c> distinguishes
/// visual tables (Azure DI's <c>result.Tables</c>) from synthesized tables
/// built by <see cref="TableSynthesizer"/> from
/// <c>Array&lt;Dictionary&gt;</c> structured fields — the two surfaces
/// render in different parts of the Inspector.
/// </summary>
public record TableExtraction(
    int Index,
    int PageNumber,
    int RowCount,
    int ColumnCount,
    string Source,
    string? Name,
    IReadOnlyList<BoundingRegionData> BoundingRegions,
    IReadOnlyList<TableCellData> Cells);

/// <summary>
/// One cell within a <see cref="TableExtraction"/>. <c>RowSpan</c> and
/// <c>ColumnSpan</c> default to 1; merged cells emit a single record at
/// their top-left address with the correct span values. <c>Kind</c> is the
/// stringified <c>DocumentTableCellKind</c> ("content", "columnHeader",
/// "rowHeader", "stubHead", "description").
/// </summary>
public record TableCellData(
    int RowIndex,
    int ColumnIndex,
    int RowSpan,
    int ColumnSpan,
    string Kind,
    string? Content,
    IReadOnlyList<BoundingRegionData> BoundingRegions);
