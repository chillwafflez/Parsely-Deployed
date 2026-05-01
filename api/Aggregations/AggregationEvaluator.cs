using DocParsing.Api.Contracts;
using DocParsing.Api.Services;

namespace DocParsing.Api.Aggregations;

/// <summary>
/// Single-source evaluation pipeline used by both the aggregation save
/// endpoint (computing the result for a freshly-drawn region) and the
/// template-replay path (re-running an existing rule on a future upload).
/// Pure function: takes layout pages + a polygon + an operation, returns
/// the formatted value and provenance metadata. No persistence side
/// effects.
/// </summary>
public static class AggregationEvaluator
{
    /// <summary>
    /// Result of evaluating an aggregation against a layout region.
    /// </summary>
    /// <param name="Value">
    /// Display string for <see cref="Models.ExtractedField.Value"/> — the
    /// formatted number, or <c>null</c> when no values were detected
    /// (region empty, page out of range, all words non-numeric).
    /// </param>
    /// <param name="Confidence">
    /// Average per-word OCR confidence across the source tokens, in
    /// <c>[0, 1]</c>. Zero when no tokens contributed.
    /// </param>
    /// <param name="Config">Provenance for the field's <c>AggregationConfigJson</c>.</param>
    public record Result(string? Value, float Confidence, AggregationFieldConfig Config);

    public static Result Evaluate(
        AggregationOperation operation,
        IReadOnlyList<float> polygon,
        int pageNumber,
        IReadOnlyList<PageExtraction> pages,
        DateTime evaluatedAt)
    {
        var page = pages.FirstOrDefault(p => p.PageNumber == pageNumber);
        var matched = page is null
            ? Array.Empty<WordData>()
            : PolygonGeometry.WordsInsideRegion(page.Words, polygon);

        var parsed = NumberTokenParser.ParseWords(matched).ToList();
        var values = parsed.Select(t => t.Value).ToList();
        var result = AggregationCompute.Compute(operation, values);
        var formatted = AggregationCompute.Format(operation, result);
        var averageConfidence = parsed.Count == 0
            ? 0f
            : parsed.Average(t => t.Source.Confidence);

        return new Result(
            Value: string.IsNullOrEmpty(formatted) ? null : formatted,
            Confidence: averageConfidence,
            Config: new AggregationFieldConfig(
                Operation: operation.ToString(),
                SourceTokenCount: parsed.Count,
                EvaluatedAt: evaluatedAt));
    }
}
