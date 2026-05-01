namespace DocParsing.Api.Models;

public class ExtractedField
{
    public Guid Id { get; set; }
    public Guid DocumentId { get; set; }

    public string Name { get; set; } = string.Empty;
    public string? Value { get; set; }
    public string DataType { get; set; } = "String";
    public float Confidence { get; set; }

    public string? BoundingRegionsJson { get; set; }

    public bool IsRequired { get; set; }

    public bool IsCorrected { get; set; }
    public DateTime? CorrectedAt { get; set; }

    /// <summary>
    /// True if the user drew this field manually (not extracted by Azure DI).
    /// Used to route user-added fields into the Inspector's "Custom" group.
    /// </summary>
    public bool IsUserAdded { get; set; }

    /// <summary>
    /// Serialized aggregation provenance ({operation, sourceTokenCount,
    /// evaluatedAt}) for fields produced by the aggregation feature. Null on
    /// every other field. Presence — not <see cref="DataType"/> — is the
    /// authoritative "is this an aggregation?" signal so users can still
    /// override the displayed type via the type popover.
    /// </summary>
    public string? AggregationConfigJson { get; set; }

    public Document Document { get; set; } = null!;
}
