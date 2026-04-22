using System.Text.Json;

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

    /// <summary>
    /// Optional free-text description shown to the voice-fill LLM for
    /// disambiguation (e.g. "the billing contact's full name"). Null when
    /// the rule name + data type are self-describing.
    /// </summary>
    public string? Hint { get; set; }

    /// <summary>
    /// Optional alternative phrasings the user might say for this field
    /// (e.g. ["PO", "P.O.", "purchase order"] for a rule named "poNumber").
    /// Stored as a JSON-serialized string[] — we never query by alias, only
    /// read them when building the voice-fill prompt, so a relational table
    /// would be overkill. Access via GetAliases()/SetAliases().
    /// </summary>
    public string? AliasesJson { get; set; }

    public Template Template { get; set; } = null!;

    public IReadOnlyList<string> GetAliases() =>
        string.IsNullOrWhiteSpace(AliasesJson)
            ? Array.Empty<string>()
            : JsonSerializer.Deserialize<List<string>>(AliasesJson) ?? new();

    public void SetAliases(IEnumerable<string>? aliases)
    {
        if (aliases is null)
        {
            AliasesJson = null;
            return;
        }

        var cleaned = aliases
            .Where(a => !string.IsNullOrWhiteSpace(a))
            .Select(a => a.Trim())
            .Distinct(StringComparer.OrdinalIgnoreCase)
            .ToArray();

        AliasesJson = cleaned.Length == 0 ? null : JsonSerializer.Serialize(cleaned);
    }
}
