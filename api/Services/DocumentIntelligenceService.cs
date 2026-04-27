using Azure;
using Azure.AI.DocumentIntelligence;
using DocParsing.Api.Catalog;
using Microsoft.Extensions.Options;

namespace DocParsing.Api.Services;

public class DocumentIntelligenceService : IDocumentIntelligenceService
{
    private readonly DocumentIntelligenceClient _client;
    private readonly ILogger<DocumentIntelligenceService> _logger;

    public DocumentIntelligenceService(
        IOptions<DocumentIntelligenceOptions> options,
        ILogger<DocumentIntelligenceService> logger)
    {
        var opts = options.Value;
        if (string.IsNullOrWhiteSpace(opts.Endpoint) || string.IsNullOrWhiteSpace(opts.Key))
        {
            throw new InvalidOperationException(
                "DocumentIntelligence:Endpoint and DocumentIntelligence:Key must be set. " +
                "Populate them in appsettings.Development.json (copy from the .example file).");
        }

        _client = new DocumentIntelligenceClient(
            new Uri(opts.Endpoint),
            new AzureKeyCredential(opts.Key));
        _logger = logger;
    }

    public async Task<DocumentExtractionResult> AnalyzeAsync(
        Stream content,
        string modelId,
        CancellationToken cancellationToken = default)
    {
        var bytes = await BinaryData.FromStreamAsync(content, cancellationToken);

        // Models like W-2 / paystub / bank statement nest identifying data
        // (Employer.Name, AccountHolderName, …) inside Dictionary fields. The
        // catalog opts those models into flattening so the children surface as
        // their own rows, which is what the Inspector edits and what template
        // matching keys off of. Invoice/receipt stay un-flattened so existing
        // BillingAddress-style composite rows are unchanged.
        var flattenMaps = DocumentTypeCatalog.Find(modelId)?.FlattenMaps ?? false;

        _logger.LogInformation(
            "Analyzing document with model {ModelId} (flattenMaps={FlattenMaps})",
            modelId, flattenMaps);

        var operation = await _client.AnalyzeDocumentAsync(
            WaitUntil.Completed,
            modelId,
            bytes,
            cancellationToken: cancellationToken);

        var result = operation.Value;

        var fields = new List<ExtractedFieldData>();
        if (result.Documents is { Count: > 0 })
        {
            var document = result.Documents[0];
            foreach (var (name, field) in document.Fields)
            {
                EmitFields(name, field, flattenMaps, fields);
            }
        }

        var pages = (result.Pages ?? new List<DocumentPage>())
            .Select(p => new PageExtraction(
                PageNumber: p.PageNumber,
                Words: (p.Words ?? new List<DocumentWord>())
                    .Select(w => new WordData(
                        Content: w.Content,
                        Polygon: w.Polygon?.ToArray() ?? Array.Empty<float>(),
                        Confidence: w.Confidence))
                    .ToList()))
            .ToList();

        var tables = (result.Tables ?? new List<DocumentTable>())
            .Select((t, index) => new TableExtraction(
                Index: index,
                // Tables can span pages; record the first page for "Table N · pg X"
                // labels and let BoundingRegions carry the full per-page geometry.
                // Index access (vs. FirstOrDefault) sidesteps the BoundingRegion
                // value-type that breaks `?.` in the SDK.
                PageNumber: t.BoundingRegions is { Count: > 0 } regions
                    ? regions[0].PageNumber
                    : 1,
                RowCount: t.RowCount,
                ColumnCount: t.ColumnCount,
                BoundingRegions: ToRegionData(t.BoundingRegions),
                Cells: (t.Cells ?? new List<DocumentTableCell>())
                    .Select(c => new TableCellData(
                        RowIndex: c.RowIndex,
                        ColumnIndex: c.ColumnIndex,
                        // Azure omits span for non-merged cells; normalize to 1
                        // so the frontend never has to special-case nulls.
                        RowSpan: c.RowSpan ?? 1,
                        ColumnSpan: c.ColumnSpan ?? 1,
                        // DocumentTableCellKind is an extensible-enum struct
                        // (same family as DocumentFieldType — see CLAUDE.md
                        // gotchas). ToString() yields the wire string we want.
                        Kind: c.Kind?.ToString() ?? "content",
                        Content: c.Content,
                        BoundingRegions: ToRegionData(c.BoundingRegions)))
                    .ToList()))
            .ToList();

        return new DocumentExtractionResult(fields, pages, tables);
    }

    private static IReadOnlyList<BoundingRegionData> ToRegionData(
        IReadOnlyList<BoundingRegion>? regions) =>
        (regions ?? new List<BoundingRegion>())
            .Select(r => new BoundingRegionData(r.PageNumber, r.Polygon.ToArray()))
            .ToList();

    /// <summary>
    /// Walks a single field. With flattening on, Dictionary fields recurse
    /// into <c>Parent.Child</c> entries; leaf scalars and Lists emit a single
    /// row. Lists deliberately stay raw — the Items/AdditionalInfo collections
    /// belong to the future table-extraction feature, not this pipeline.
    /// </summary>
    private static void EmitFields(
        string name,
        DocumentField field,
        bool flattenMaps,
        List<ExtractedFieldData> output)
    {
        if (flattenMaps
            && field.FieldType == DocumentFieldType.Dictionary
            && field.ValueDictionary is { Count: > 0 } children)
        {
            foreach (var (childKey, childField) in children)
            {
                EmitFields($"{name}.{childKey}", childField, flattenMaps, output);
            }
            return;
        }

        output.Add(ToFieldData(name, field));
    }

    private static ExtractedFieldData ToFieldData(string name, DocumentField field)
    {
        var regions = field.BoundingRegions?
            .Select(r => new BoundingRegionData(r.PageNumber, r.Polygon.ToArray()))
            .ToList() ?? new List<BoundingRegionData>();

        return new ExtractedFieldData(
            Name: name,
            Value: FormatValue(field),
            DataType: field.FieldType.ToString(),
            Confidence: field.Confidence ?? 0f,
            BoundingRegions: regions);
    }

    private static string? FormatValue(DocumentField field)
    {
        var type = field.FieldType;

        if (type == DocumentFieldType.String)
            return field.ValueString ?? field.Content;

        if (type == DocumentFieldType.Currency && field.ValueCurrency is { } c)
            return $"{c.CurrencySymbol}{c.Amount}";

        return field.Content;
    }
}
