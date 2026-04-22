namespace DocParsing.Api.Services;

/// <summary>
/// Config for the LLM that maps voice transcripts to field patches.
/// The same <c>OpenAI</c> NuGet package works for both OpenAI-direct and
/// Azure OpenAI — swap via <see cref="Endpoint"/>:
/// <list type="bullet">
///   <item>OpenAI-direct: leave <see cref="Endpoint"/> empty (defaults to api.openai.com).</item>
///   <item>Azure OpenAI: set to <c>https://&lt;resource&gt;.openai.azure.com/openai/v1/</c>.</item>
/// </list>
/// </summary>
public class OpenAIOptions
{
    public const string SectionName = "OpenAI";

    /// <summary>
    /// Optional base URL override. Required for Azure OpenAI; leave empty for OpenAI-direct.
    /// </summary>
    public string? Endpoint { get; set; }

    public string Key { get; set; } = string.Empty;

    /// <summary>
    /// Chat model name. Must support strict JSON-schema structured outputs
    /// (e.g. <c>gpt-4o-mini</c>, <c>gpt-4o</c>).
    /// </summary>
    public string Model { get; set; } = "gpt-4o-mini";
}
