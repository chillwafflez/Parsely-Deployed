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

    public bool IsCorrected { get; set; }
    public DateTime? CorrectedAt { get; set; }

    public Document Document { get; set; } = null!;
}
