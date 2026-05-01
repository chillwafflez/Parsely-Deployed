namespace DocParsing.Api.Aggregations;

/// <summary>
/// Numeric rollup operations supported by the aggregation feature. Persisted
/// as the operation's name string (case-insensitive) on
/// <c>TemplateAggregationRule.Operation</c> and on
/// <c>ExtractedField.AggregationConfigJson</c> for readability and to keep
/// schema changes additive when new operations land.
/// </summary>
public enum AggregationOperation
{
    Sum,
    Average,
    Count,
    Min,
    Max,
}
