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

        return new DocumentExtractionResult(fields, pages);
    }

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
