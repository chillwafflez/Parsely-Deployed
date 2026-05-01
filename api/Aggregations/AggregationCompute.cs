using System.Globalization;

namespace DocParsing.Api.Aggregations;

/// <summary>
/// Pure computation + formatting for the five v1 aggregation operations.
/// Decoupled from persistence so unit tests cover the math without touching
/// EF Core or the controller layer.
/// </summary>
public static class AggregationCompute
{
    /// <summary>
    /// Returns the result of applying <paramref name="operation"/> to
    /// <paramref name="values"/>. <c>Count</c> on an empty input is <c>0</c>;
    /// every other operation on an empty input is <c>null</c> (no value
    /// can be defined — average of nothing is undefined; min/max of nothing
    /// is undefined; sum-of-nothing is debatable but null is safer than 0
    /// because the field flags as missing rather than displaying a wrong
    /// total).
    /// </summary>
    public static decimal? Compute(AggregationOperation operation, IReadOnlyList<decimal> values)
    {
        if (values.Count == 0)
        {
            return operation == AggregationOperation.Count ? 0m : null;
        }

        return operation switch
        {
            AggregationOperation.Sum => Sum(values),
            AggregationOperation.Average => Average(values),
            AggregationOperation.Count => values.Count,
            AggregationOperation.Min => Min(values),
            AggregationOperation.Max => Max(values),
            _ => throw new ArgumentOutOfRangeException(
                nameof(operation), operation, "Unsupported aggregation operation."),
        };
    }

    /// <summary>
    /// Formats <paramref name="result"/> for display in the field's value:
    /// integer string for <c>Count</c>, two-decimal string for the rest, and
    /// empty string when the input was null (empty source region).
    /// </summary>
    public static string Format(AggregationOperation operation, decimal? result)
    {
        if (result is null) return string.Empty;

        return operation == AggregationOperation.Count
            ? ((long)result.Value).ToString(CultureInfo.InvariantCulture)
            : result.Value.ToString("0.00", CultureInfo.InvariantCulture);
    }

    /// <summary>
    /// Parses a stored operation name (case-insensitive) into the enum.
    /// Returns <c>false</c> for anything outside the v1 vocabulary, so the
    /// controller can reject bad input cleanly.
    /// </summary>
    public static bool TryParseOperation(string? name, out AggregationOperation operation) =>
        Enum.TryParse(name, ignoreCase: true, out operation)
        && Enum.IsDefined(operation);

    // Manual loops avoid LINQ's IEnumerable overhead — these methods run on
    // every aggregation save and during template-rule replay on every
    // matching upload.

    private static decimal Sum(IReadOnlyList<decimal> values)
    {
        var total = 0m;
        for (var i = 0; i < values.Count; i++) total += values[i];
        return total;
    }

    private static decimal Average(IReadOnlyList<decimal> values) =>
        Sum(values) / values.Count;

    private static decimal Min(IReadOnlyList<decimal> values)
    {
        var min = values[0];
        for (var i = 1; i < values.Count; i++)
        {
            if (values[i] < min) min = values[i];
        }
        return min;
    }

    private static decimal Max(IReadOnlyList<decimal> values)
    {
        var max = values[0];
        for (var i = 1; i < values.Count; i++)
        {
            if (values[i] > max) max = values[i];
        }
        return max;
    }
}
