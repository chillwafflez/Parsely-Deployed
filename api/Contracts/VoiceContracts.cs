using System.ComponentModel.DataAnnotations;

namespace DocParsing.Api.Contracts;

/// <summary>
/// POST /api/voice/fill body. <see cref="CurrentValues"/> is an optional
/// map of already-filled fields so the LLM can resolve ambiguous phrases
/// against existing context (keyed by the rule's field name,
/// case-insensitive on the server).
/// </summary>
public record VoiceFillRequest(
    [Required] Guid TemplateId,
    [Required, StringLength(2000, MinimumLength = 1)] string Transcript,
    IDictionary<string, string?>? CurrentValues);

/// <summary>
/// Serialized shape of <see cref="Services.FieldPatch"/> returned to the
/// browser. <see cref="Warning"/> is populated when post-LLM coercion
/// couldn't parse the value into its declared data type — the slot UI
/// can show a warning chip while still accepting the raw value.
/// </summary>
public record FieldPatchResponse(
    string Field,
    string Value,
    string DataType,
    string? Warning);

public record VoiceFillResponse(
    IReadOnlyList<FieldPatchResponse> Patches,
    IReadOnlyList<string> UnmatchedPhrases,
    string Transcript);
