using Microsoft.Extensions.Options;

namespace DocParsing.Api.Services;

public class SpeechTokenProvider : ISpeechTokenProvider
{
    // Azure tokens live 10 minutes; re-mint at 9 to leave a margin for
    // mid-request expiries on the browser side.
    private static readonly TimeSpan TokenLifetime = TimeSpan.FromMinutes(9);

    private readonly IHttpClientFactory _httpClientFactory;
    private readonly IOptionsMonitor<SpeechOptions> _options;
    private readonly ILogger<SpeechTokenProvider> _logger;
    private readonly SemaphoreSlim _lock = new(1, 1);

    private string? _cachedToken;
    private DateTime _cachedExpiresAt;

    public SpeechTokenProvider(
        IHttpClientFactory httpClientFactory,
        IOptionsMonitor<SpeechOptions> options,
        ILogger<SpeechTokenProvider> logger)
    {
        _httpClientFactory = httpClientFactory;
        _options = options;
        _logger = logger;
    }

    public async Task<SpeechTokenResult> GetAsync(CancellationToken ct)
    {
        var opts = _options.CurrentValue;
        if (string.IsNullOrWhiteSpace(opts.Key) || string.IsNullOrWhiteSpace(opts.Region))
        {
            throw new InvalidOperationException(
                "Speech:Key and Speech:Region must be set via user-secrets before voice endpoints can serve.");
        }

        await _lock.WaitAsync(ct);
        try
        {
            if (_cachedToken is not null && DateTime.UtcNow < _cachedExpiresAt)
            {
                return new SpeechTokenResult(_cachedToken, opts.Region, _cachedExpiresAt);
            }

            var token = await MintAsync(opts, ct);
            _cachedToken = token;
            _cachedExpiresAt = DateTime.UtcNow.Add(TokenLifetime);
            return new SpeechTokenResult(token, opts.Region, _cachedExpiresAt);
        }
        finally
        {
            _lock.Release();
        }
    }

    private async Task<string> MintAsync(SpeechOptions opts, CancellationToken ct)
    {
        var url = $"https://{opts.Region}.api.cognitive.microsoft.com/sts/v1.0/issueToken";
        using var request = new HttpRequestMessage(HttpMethod.Post, url);
        request.Headers.Add("Ocp-Apim-Subscription-Key", opts.Key);
        request.Content = new StringContent(string.Empty);
        request.Content.Headers.ContentType =
            new System.Net.Http.Headers.MediaTypeHeaderValue("application/x-www-form-urlencoded");

        using var client = _httpClientFactory.CreateClient();
        using var response = await client.SendAsync(request, ct);

        if (!response.IsSuccessStatusCode)
        {
            var body = await response.Content.ReadAsStringAsync(ct);
            _logger.LogError(
                "Speech token mint failed: {Status} {Reason} — {Body}",
                (int)response.StatusCode, response.ReasonPhrase, body);
            throw new HttpRequestException(
                $"Failed to mint Speech token ({(int)response.StatusCode}).");
        }

        // The issueToken endpoint returns the JWT as plain text, not JSON.
        return (await response.Content.ReadAsStringAsync(ct)).Trim();
    }
}
