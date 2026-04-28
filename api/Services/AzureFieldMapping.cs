using Azure.AI.DocumentIntelligence;

namespace DocParsing.Api.Services;

/// <summary>
/// Pure mappers from Azure DI SDK types to our service-layer DTOs. Shared by
/// <see cref="DocumentIntelligenceService"/> (top-level field extraction) and
/// <see cref="TableSynthesizer"/> (synth-table cell formatting). Centralised
/// so a future change to currency rendering, bbox shape, etc. lands in one
/// place.
/// </summary>
internal static class AzureFieldMapping
{
    /// <summary>
    /// Renders a <see cref="DocumentField"/> as a single string for display
    /// or storage. Falls back to <c>field.Content</c> for any type we don't
    /// special-case — Azure DI populates Content for every leaf, so the UI
    /// always gets something readable.
    /// </summary>
    public static string? FormatValue(DocumentField field)
    {
        var type = field.FieldType;

        if (type == DocumentFieldType.String)
            return field.ValueString ?? field.Content;

        if (type == DocumentFieldType.Currency && field.ValueCurrency is { } c)
            return $"{c.CurrencySymbol}{c.Amount}";

        return field.Content;
    }

    public static IReadOnlyList<BoundingRegionData> ToRegionData(
        IReadOnlyList<BoundingRegion>? regions) =>
        (regions ?? new List<BoundingRegion>())
            .Select(r => new BoundingRegionData(r.PageNumber, r.Polygon.ToArray()))
            .ToList();

    /// <summary>
    /// Returns true when <paramref name="field"/> is a non-empty
    /// <c>List&lt;Dictionary&gt;</c> — invoice's Items, bank statement's
    /// Accounts/Transactions, etc. Both <see cref="DocumentIntelligenceService"/>
    /// (Tabular placeholder emission) and <see cref="TableSynthesizer"/>
    /// (synth-table generation) gate on this same predicate, so they always
    /// agree on which fields qualify.
    /// </summary>
    public static bool IsArrayOfDictionaries(
        DocumentField field,
        out IReadOnlyList<DocumentField> items)
    {
        if (field.FieldType == DocumentFieldType.List
            && field.ValueList is { Count: > 0 } list
            && list[0].FieldType == DocumentFieldType.Dictionary)
        {
            items = list;
            return true;
        }

        items = Array.Empty<DocumentField>();
        return false;
    }
}
