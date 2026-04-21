namespace DocParsing.Api.Models;

/// <summary>
/// A single rule within a Template — mirrors the relevant subset of an
/// ExtractedField (name, datatype, required flag, location) without the
/// per-document value. Many rules belong to one Template.
/// </summary>
public class TemplateFieldRule
{
    public Guid Id { get; set; }
    public Guid TemplateId { get; set; }

    public string Name { get; set; } = string.Empty;
    public string DataType { get; set; } = "string";
    public bool IsRequired { get; set; }

    /// <summary>
    /// Serialized BoundingRegion[] snapshot — same JSON shape used by
    /// ExtractedField.BoundingRegionsJson so reapplying a rule doesn't
    /// require a separate parser.
    /// </summary>
    public string? BoundingRegionsJson { get; set; }

    public Template Template { get; set; } = null!;
}
