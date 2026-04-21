namespace DocParsing.Api.Models;

public class Document
{
    public Guid Id { get; set; }
    public string OriginalFileName { get; set; } = string.Empty;
    public string StoragePath { get; set; } = string.Empty;
    public string ModelId { get; set; } = "prebuilt-invoice";
    public DocumentStatus Status { get; set; }
    public DateTime CreatedAt { get; set; }
    public DateTime? CompletedAt { get; set; }
    public string? ErrorMessage { get; set; }

    /// <summary>
    /// Optional link to the template this document was matched against on
    /// upload (by VendorName heuristic). Lets the Inspector show
    /// "Template: X" without an extra round-trip.
    /// </summary>
    public Guid? TemplateId { get; set; }
    public Template? Template { get; set; }

    public List<ExtractedField> ExtractedFields { get; set; } = new();
}

public enum DocumentStatus
{
    Uploaded = 0,
    Analyzing = 1,
    Completed = 2,
    Failed = 3,
}
