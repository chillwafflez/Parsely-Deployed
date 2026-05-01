namespace DocParsing.Api.Models;

/// <summary>
/// A template-level rule that replays an aggregation on every future upload
/// matching the template — the same way <see cref="TemplateFieldRule"/>
/// replays draw-to-add fields. Captures the operation, the polygon to filter
/// layout words by, and the result-field name. Many rules belong to one
/// template; cascade-delete with the template.
/// </summary>
public class TemplateAggregationRule
{
    public Guid Id { get; set; }
    public Guid TemplateId { get; set; }

    /// <summary>
    /// Name of the resulting <see cref="ExtractedField"/> on documents the
    /// template applies to (e.g. "Line items total").
    /// </summary>
    public string Name { get; set; } = string.Empty;

    /// <summary>
    /// Aggregation operation as the enum's name string ("Sum", "Average",
    /// "Count", "Min", "Max"). Stored as text for readability and to keep
    /// schema changes additive when new operations land.
    /// </summary>
    public string Operation { get; set; } = string.Empty;

    public bool IsRequired { get; set; }

    /// <summary>
    /// Serialized BoundingRegion[] snapshot — same JSON shape used by
    /// <see cref="ExtractedField.BoundingRegionsJson"/> and
    /// <see cref="TemplateFieldRule.BoundingRegionsJson"/> so replay can
    /// share the polygon-containment helpers in <c>PolygonGeometry</c>.
    /// </summary>
    public string? BoundingRegionsJson { get; set; }

    public Template Template { get; set; } = null!;
}
