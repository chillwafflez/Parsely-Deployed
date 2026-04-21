namespace DocParsing.Api.Models;

/// <summary>
/// A reusable parsing template, captured from a corrected document. Holds
/// metadata plus a snapshot of the field rules at save time. Future uploads
/// matched to this template can have its rules reapplied (Phase 2).
/// </summary>
public class Template
{
    public Guid Id { get; set; }
    public string Name { get; set; } = string.Empty;
    public string Kind { get; set; } = "Invoice";
    public string? Description { get; set; }
    public string ApplyTo { get; set; } = "similar";
    public string? VendorHint { get; set; }
    public DateTime CreatedAt { get; set; }
    public Guid? SourceDocumentId { get; set; }

    public List<TemplateFieldRule> Rules { get; set; } = new();
}
