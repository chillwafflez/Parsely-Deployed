using Azure;
using Azure.AI.DocumentIntelligence;
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

    public async Task<IReadOnlyList<ExtractedFieldData>> AnalyzeAsync(
        string filePath,
        string modelId,
        CancellationToken cancellationToken = default)
    {
        await using var stream = File.OpenRead(filePath);
        var bytes = await BinaryData.FromStreamAsync(stream, cancellationToken);

        _logger.LogInformation("Analyzing {File} with model {ModelId}", filePath, modelId);

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
                fields.Add(ToFieldData(name, field));
            }
        }

        return fields;
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
