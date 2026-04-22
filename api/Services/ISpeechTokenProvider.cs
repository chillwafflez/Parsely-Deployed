namespace DocParsing.Api.Services;

/// <summary>
/// Short-lived JWT minted for browser use with the Azure Speech SDK.
/// Tokens are valid for 10 minutes upstream — we report 9 so callers
/// rotate with a safety margin.
/// </summary>
public record SpeechTokenResult(string Token, string Region, DateTime ExpiresAt);

/// <summary>
/// Mints + caches Azure Speech authorization tokens on the server so the
/// subscription key never reaches the browser.
/// </summary>
public interface ISpeechTokenProvider
{
    Task<SpeechTokenResult> GetAsync(CancellationToken ct);
}
