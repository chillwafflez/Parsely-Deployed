using Azure;
using Azure.AI.DocumentIntelligence;
using DocParsing.Api.Catalog;
using DocParsing.Api.Models;
using Microsoft.Extensions.Options;

namespace DocParsing.Api.Services;

public class DocumentIntelligenceService : IDocumentIntelligenceService
{
    private const string LayoutModelId = "prebuilt-layout";

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
        var typeDef = DocumentTypeCatalog.Find(modelId);

        // Models like W-2 / paystub / bank statement nest identifying data
        // (Employer.Name, AccountHolderName, …) inside Dictionary fields. The
        // catalog opts those models into flattening so the children surface as
        // their own rows, which is what the Inspector edits and what template
        // matching keys off of. Invoice/receipt stay un-flattened so existing
        // BillingAddress-style composite rows are unchanged.
        var flattenMaps = typeDef?.FlattenMaps ?? false;

        // Receipt / W-2 / paystub / bank statement return empty result.Tables
        // — verified empirically + via Microsoft Learn docs. For those, run a
        // parallel prebuilt-layout call so the user still sees visual tables
        // in the Inspector. Skip when the caller is already asking for layout
        // (avoid infinite-loop semantics + double-cost for the same data).
        var needsLayoutFallback =
            (typeDef?.NeedsLayoutFallback ?? false)
            && !modelId.Equals(LayoutModelId, StringComparison.OrdinalIgnoreCase);

        _logger.LogInformation(
            "Analyzing document with model {ModelId} (flattenMaps={FlattenMaps}, layoutFallback={NeedsFallback})",
            modelId, flattenMaps, needsLayoutFallback);

        AnalyzeResult mainResult;
        AnalyzeResult? layoutResult = null;

        if (needsLayoutFallback)
        {
            // Concurrent calls against the same DocumentIntelligenceClient
            // (thread-safe) and the same BinaryData (immutable) — perceived
            // latency is max(chosen, layout) rather than chosen + layout.
            // Both calls always run when the catalog flags fallback; we don't
            // gate the layout call on the chosen model's table count because
            // serialising would defeat the parallel optimisation.
            var mainTask = _client.AnalyzeDocumentAsync(
                WaitUntil.Completed, modelId, bytes, cancellationToken: cancellationToken);
            var layoutTask = _client.AnalyzeDocumentAsync(
                WaitUntil.Completed, LayoutModelId, bytes, cancellationToken: cancellationToken);

            await Task.WhenAll(mainTask, layoutTask);

            mainResult = (await mainTask).Value;
            layoutResult = (await layoutTask).Value;
        }
        else
        {
            var operation = await _client.AnalyzeDocumentAsync(
                WaitUntil.Completed, modelId, bytes, cancellationToken: cancellationToken);
            mainResult = operation.Value;
        }

        var fields = ExtractFields(mainResult, flattenMaps);
        var pages = ExtractPages(mainResult);

        // Visual tables: prefer the layout call's set when it ran, since the
        // chosen model's result.Tables is the very thing we expected to be
        // empty. Fall back to the main result so the path stays correct if a
        // future fallback-flagged model starts surfacing tables natively.
        var layoutTables = layoutResult is not null
            ? ExtractLayoutTables(layoutResult)
            : ExtractLayoutTables(mainResult);

        // Synthesised tables come from the chosen-model fields — Items,
        // Accounts, nested Transactions, etc. Independent of which call
        // produced result.Tables.
        var synthTables = mainResult.Documents is { Count: > 0 } docs
            ? TableSynthesizer.Synthesize(docs[0].Fields)
            : Array.Empty<TableExtraction>();

        var allTables = new List<TableExtraction>(layoutTables.Count + synthTables.Count);
        allTables.AddRange(layoutTables);
        for (var i = 0; i < synthTables.Count; i++)
        {
            // Synth tables get globally unique indexes after the layout set,
            // so (DocumentId, Index) addresses every table on the document.
            allTables.Add(synthTables[i] with { Index = layoutTables.Count + i });
        }

        return new DocumentExtractionResult(fields, pages, allTables);
    }

    private static List<ExtractedFieldData> ExtractFields(AnalyzeResult result, bool flattenMaps)
    {
        var fields = new List<ExtractedFieldData>();
        if (result.Documents is not { Count: > 0 } documents) return fields;

        foreach (var (name, field) in documents[0].Fields)
        {
            EmitFields(name, field, flattenMaps, fields);
        }

        return fields;
    }

    private static List<PageExtraction> ExtractPages(AnalyzeResult result) =>
        (result.Pages ?? new List<DocumentPage>())
            .Select(p => new PageExtraction(
                PageNumber: p.PageNumber,
                Words: (p.Words ?? new List<DocumentWord>())
                    .Select(w => new WordData(
                        Content: w.Content,
                        Polygon: w.Polygon?.ToArray() ?? Array.Empty<float>(),
                        Confidence: w.Confidence))
                    .ToList()))
            .ToList();

    private static List<TableExtraction> ExtractLayoutTables(AnalyzeResult result) =>
        (result.Tables ?? new List<DocumentTable>())
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
                // Visual table from result.Tables. Name stays null — the UI
                // labels Layout-source tables by detection order ("Table N").
                Source: TableSources.Layout,
                Name: null,
                BoundingRegions: AzureFieldMapping.ToRegionData(t.BoundingRegions),
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
                        BoundingRegions: AzureFieldMapping.ToRegionData(c.BoundingRegions)))
                    .ToList()))
            .ToList();

    /// <summary>
    /// Walks a single field. <c>List&lt;Dictionary&gt;</c> fields emit a
    /// single Tabular placeholder row (the actual rows live in the synth
    /// table the frontend opens via the drawer). With flattening on,
    /// Dictionary fields recurse into <c>Parent.Child</c> entries. Everything
    /// else emits a single row formatted by <see cref="ToFieldData"/>.
    /// </summary>
    private static void EmitFields(
        string name,
        DocumentField field,
        bool flattenMaps,
        List<ExtractedFieldData> output)
    {
        if (AzureFieldMapping.IsArrayOfDictionaries(field, out var items))
        {
            output.Add(ToTabularPlaceholder(name, field, items.Count));
            return;
        }

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

    private static ExtractedFieldData ToFieldData(string name, DocumentField field) =>
        new(
            Name: name,
            Value: AzureFieldMapping.FormatValue(field),
            DataType: field.FieldType.ToString(),
            Confidence: field.Confidence ?? 0f,
            BoundingRegions: AzureFieldMapping.ToRegionData(field.BoundingRegions));

    /// <summary>
    /// Synthetic field row representing a <c>List&lt;Dictionary&gt;</c>
    /// (Items, Accounts, …). Frontend matches on <c>DataType == "Tabular"</c>
    /// to render the row as a clickable opener for the corresponding synth
    /// table rather than an inline-editable value. Bounding regions are
    /// intentionally empty — the bbox union of scattered child fields would
    /// be misleading on the document overlay (see Phase G v1 revert notes).
    /// Confidence pinned to 1.0 so the placeholder doesn't pollute the
    /// "Issues / Low confidence" Inspector stats.
    /// </summary>
    private static ExtractedFieldData ToTabularPlaceholder(
        string name,
        DocumentField field,
        int recordCount) =>
        new(
            Name: name,
            Value: $"{recordCount} record{(recordCount == 1 ? string.Empty : "s")}",
            DataType: "Tabular",
            Confidence: 1.0f,
            BoundingRegions: Array.Empty<BoundingRegionData>());

}
