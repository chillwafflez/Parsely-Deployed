using DocParsing.Api.Models;

namespace DocParsing.Api.Services;

/// <summary>
/// Structured field assignment produced by the LLM from a user's transcript.
/// <see cref="Warning"/> is populated when we couldn't coerce the raw value
/// into its declared data type — the patch still flows through so the
/// caller can decide whether to accept or flag it.
/// </summary>
public record FieldPatch(
    string Field,
    string Value,
    string DataType,
    string? Warning);

public record VoiceFillResult(
    IReadOnlyList<FieldPatch> Patches,
    IReadOnlyList<string> UnmatchedPhrases);

/// <summary>
/// Maps a voice transcript to <see cref="FieldPatch"/>es constrained by the
/// given template's field schema. Uses strict JSON-schema structured output
/// so the LLM cannot invent field names outside the template's rule set.
/// </summary>
public interface IVoiceFillService
{
    Task<VoiceFillResult> ExtractPatchesAsync(
        Template template,
        string transcript,
        IReadOnlyDictionary<string, string?> currentValues,
        CancellationToken ct);
}
