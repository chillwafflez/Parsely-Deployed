namespace DocParsing.Api.Services;

/// <summary>
/// Azure Speech resource credentials. The key stays server-side; only
/// short-lived JWTs are handed to the browser via <c>/api/voice/token</c>.
/// </summary>
public class SpeechOptions
{
    public const string SectionName = "Speech";

    public string Key { get; set; } = string.Empty;
    public string Region { get; set; } = "eastus";
}
