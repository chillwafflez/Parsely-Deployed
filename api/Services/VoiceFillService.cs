using System.ClientModel;
using System.Globalization;
using System.Text;
using System.Text.Json;
using System.Text.RegularExpressions;
using DocParsing.Api.Models;
using Microsoft.Extensions.Options;
using OpenAI;
using OpenAI.Chat;

namespace DocParsing.Api.Services;

public class VoiceFillService : IVoiceFillService
{
    private readonly IOptionsMonitor<OpenAIOptions> _options;
    private readonly ILogger<VoiceFillService> _logger;

    // ChatClient is thread-safe and cheap to reuse; build lazily so a
    // missing OpenAI secret doesn't kill the whole API at startup.
    private ChatClient? _client;
    private readonly object _clientLock = new();

    public VoiceFillService(
        IOptionsMonitor<OpenAIOptions> options,
        ILogger<VoiceFillService> logger)
    {
        _options = options;
        _logger = logger;
    }

    public async Task<VoiceFillResult> ExtractPatchesAsync(
        Template template,
        string transcript,
        IReadOnlyDictionary<string, string?> currentValues,
        CancellationToken ct)
    {
        if (template.Rules is null || template.Rules.Count == 0)
        {
            // Nothing to match against — surface the whole transcript as
            // unmatched rather than silently dropping it.
            return new VoiceFillResult(
                Patches: Array.Empty<FieldPatch>(),
                UnmatchedPhrases: string.IsNullOrWhiteSpace(transcript)
                    ? Array.Empty<string>()
                    : new[] { transcript.Trim() });
        }

        var client = GetClient();

        var schema = BuildJsonSchema(template.Rules);
        var systemPrompt = BuildSystemPrompt();
        var userPrompt = BuildUserPrompt(template.Rules, currentValues, transcript);

        var options = new ChatCompletionOptions
        {
            ResponseFormat = ChatResponseFormat.CreateJsonSchemaFormat(
                jsonSchemaFormatName: "voice_fill_patches",
                jsonSchema: schema,
                jsonSchemaIsStrict: true),
        };

        List<ChatMessage> messages =
        [
            new SystemChatMessage(systemPrompt),
            new UserChatMessage(userPrompt),
        ];

        var completion = await client.CompleteChatAsync(messages, options, ct);
        var responseText = completion.Value.Content[0].Text;

        return ParseResponse(responseText, template.Rules);
    }

    private ChatClient GetClient()
    {
        if (_client is not null) return _client;
        lock (_clientLock)
        {
            if (_client is not null) return _client;

            var opts = _options.CurrentValue;
            if (string.IsNullOrWhiteSpace(opts.Key))
            {
                throw new InvalidOperationException(
                    "OpenAI:Key must be set via user-secrets before voice-fill endpoints can serve.");
            }
            if (string.IsNullOrWhiteSpace(opts.Model))
            {
                throw new InvalidOperationException("OpenAI:Model must be set.");
            }

            var credential = new ApiKeyCredential(opts.Key);
            _client = string.IsNullOrWhiteSpace(opts.Endpoint)
                ? new ChatClient(opts.Model, credential)
                : new ChatClient(opts.Model, credential, new OpenAIClientOptions
                {
                    Endpoint = new Uri(opts.Endpoint),
                });

            return _client;
        }
    }

    private static BinaryData BuildJsonSchema(IEnumerable<TemplateFieldRule> rules)
    {
        using var stream = new MemoryStream();
        using (var writer = new Utf8JsonWriter(stream))
        {
            writer.WriteStartObject();
            writer.WriteString("type", "object");

            writer.WriteStartObject("properties");

            // patches: array of { field: enum, value: string }
            writer.WriteStartObject("patches");
            writer.WriteString("type", "array");

            writer.WriteStartObject("items");
            writer.WriteString("type", "object");

            writer.WriteStartObject("properties");
            writer.WriteStartObject("field");
            writer.WriteString("type", "string");
            writer.WriteStartArray("enum");
            foreach (var rule in rules) writer.WriteStringValue(rule.Name);
            writer.WriteEndArray();
            writer.WriteEndObject();

            writer.WriteStartObject("value");
            writer.WriteString("type", "string");
            writer.WriteEndObject();
            writer.WriteEndObject(); // items.properties

            writer.WriteStartArray("required");
            writer.WriteStringValue("field");
            writer.WriteStringValue("value");
            writer.WriteEndArray();
            writer.WriteBoolean("additionalProperties", false);
            writer.WriteEndObject(); // items
            writer.WriteEndObject(); // patches

            // unmatched: string[]
            writer.WriteStartObject("unmatched");
            writer.WriteString("type", "array");
            writer.WriteStartObject("items");
            writer.WriteString("type", "string");
            writer.WriteEndObject();
            writer.WriteEndObject();

            writer.WriteEndObject(); // properties

            writer.WriteStartArray("required");
            writer.WriteStringValue("patches");
            writer.WriteStringValue("unmatched");
            writer.WriteEndArray();
            writer.WriteBoolean("additionalProperties", false);
            writer.WriteEndObject();
        }
        return BinaryData.FromBytes(stream.ToArray());
    }

    private static string BuildSystemPrompt() =>
        """
        You map spoken intent to form-field assignments. You will receive:
        1. A list of available fields (name, data type, optional hint, optional aliases).
        2. The current value of each field (if already filled).
        3. A transcript of what the user said.

        For each field the user clearly referenced, emit a patch with the field's
        canonical name and the value the user specified. Coerce values to match
        the field's data type (numbers for currency/number fields, ISO 8601 dates
        for date fields, strings otherwise).

        If the user says a phrase that doesn't clearly match any field, add it
        to "unmatched" instead of guessing. Do not invent fields. Do not patch
        fields the user did not mention. Do not overwrite a field with the same
        value it already has.
        """;

    private static string BuildUserPrompt(
        IEnumerable<TemplateFieldRule> rules,
        IReadOnlyDictionary<string, string?> currentValues,
        string transcript)
    {
        using var stream = new MemoryStream();
        using (var writer = new Utf8JsonWriter(stream, new JsonWriterOptions { Indented = true }))
        {
            writer.WriteStartObject();
            writer.WriteStartArray("fields");
            foreach (var rule in rules)
            {
                writer.WriteStartObject();
                writer.WriteString("name", rule.Name);
                writer.WriteString("dataType", rule.DataType);

                if (!string.IsNullOrWhiteSpace(rule.Hint))
                {
                    writer.WriteString("hint", rule.Hint);
                }

                var aliases = rule.GetAliases();
                if (aliases.Count > 0)
                {
                    writer.WriteStartArray("aliases");
                    foreach (var alias in aliases) writer.WriteStringValue(alias);
                    writer.WriteEndArray();
                }

                if (currentValues.TryGetValue(rule.Name, out var current) &&
                    !string.IsNullOrEmpty(current))
                {
                    writer.WriteString("currentValue", current);
                }

                writer.WriteEndObject();
            }
            writer.WriteEndArray();
            writer.WriteString("transcript", transcript);
            writer.WriteEndObject();
        }
        return Encoding.UTF8.GetString(stream.ToArray());
    }

    private VoiceFillResult ParseResponse(string responseText, IEnumerable<TemplateFieldRule> rules)
    {
        var ruleByName = rules.ToDictionary(r => r.Name, StringComparer.OrdinalIgnoreCase);

        using var doc = JsonDocument.Parse(responseText);
        var root = doc.RootElement;

        var patches = new List<FieldPatch>();
        if (root.TryGetProperty("patches", out var patchesEl) &&
            patchesEl.ValueKind == JsonValueKind.Array)
        {
            foreach (var item in patchesEl.EnumerateArray())
            {
                var fieldName = item.TryGetProperty("field", out var fEl)
                    ? fEl.GetString() ?? string.Empty : string.Empty;
                var rawValue = item.TryGetProperty("value", out var vEl)
                    ? vEl.GetString() ?? string.Empty : string.Empty;

                // Strict-mode enum prevents invented names, but guard anyway
                // in case a future schema change relaxes that.
                if (string.IsNullOrWhiteSpace(fieldName) ||
                    !ruleByName.TryGetValue(fieldName, out var rule))
                {
                    continue;
                }

                var (coercedValue, warning) = CoerceValue(rawValue, rule.DataType);
                patches.Add(new FieldPatch(
                    Field: rule.Name,
                    Value: coercedValue,
                    DataType: rule.DataType,
                    Warning: warning));
            }
        }

        var unmatched = new List<string>();
        if (root.TryGetProperty("unmatched", out var unEl) &&
            unEl.ValueKind == JsonValueKind.Array)
        {
            foreach (var item in unEl.EnumerateArray())
            {
                var s = item.GetString();
                if (!string.IsNullOrWhiteSpace(s)) unmatched.Add(s);
            }
        }

        _logger.LogInformation(
            "Voice fill produced {PatchCount} patches, {UnmatchedCount} unmatched phrases",
            patches.Count, unmatched.Count);

        return new VoiceFillResult(patches, unmatched);
    }

    // Non-capturing regex for currency symbols/codes stripping.
    private static readonly Regex CurrencyStripper =
        new(@"[\$€£¥,\s]|USD|EUR|GBP|JPY", RegexOptions.Compiled | RegexOptions.IgnoreCase);

    /// <summary>
    /// Post-LLM data-type validation. The LLM is prompted to coerce but
    /// can still hallucinate a currency like "one hundred dollars" — we
    /// flag (not drop) those so the UI can surface a warning chip.
    /// </summary>
    private static (string Value, string? Warning) CoerceValue(string raw, string dataType)
    {
        if (string.IsNullOrWhiteSpace(raw)) return (raw, null);

        // DataType can arrive as Azure DI's PascalCase ("Currency","Date")
        // or the frontend FieldDataType lowercase — match case-insensitive.
        if (TypeEquals(dataType, "currency"))
        {
            var cleaned = CurrencyStripper.Replace(raw, string.Empty);
            return decimal.TryParse(cleaned, NumberStyles.Any, CultureInfo.InvariantCulture, out var dec)
                ? (dec.ToString(CultureInfo.InvariantCulture), null)
                : (raw, $"Couldn't parse as currency: '{raw}'");
        }

        if (TypeEquals(dataType, "number") || TypeEquals(dataType, "integer"))
        {
            var cleaned = raw.Replace(",", string.Empty).Trim();
            return decimal.TryParse(cleaned, NumberStyles.Any, CultureInfo.InvariantCulture, out var dec)
                ? (dec.ToString(CultureInfo.InvariantCulture), null)
                : (raw, $"Couldn't parse as number: '{raw}'");
        }

        if (TypeEquals(dataType, "percent"))
        {
            var cleaned = raw.Replace("%", string.Empty).Trim();
            return decimal.TryParse(cleaned, NumberStyles.Any, CultureInfo.InvariantCulture, out var dec)
                ? (dec.ToString(CultureInfo.InvariantCulture), null)
                : (raw, $"Couldn't parse as percent: '{raw}'");
        }

        if (TypeEquals(dataType, "date"))
        {
            return DateTime.TryParse(raw, CultureInfo.InvariantCulture, DateTimeStyles.AssumeLocal, out var dt)
                ? (dt.ToString("yyyy-MM-dd", CultureInfo.InvariantCulture), null)
                : (raw, $"Couldn't parse as date: '{raw}'");
        }

        return (raw, null);
    }

    private static bool TypeEquals(string value, string expected) =>
        string.Equals(value, expected, StringComparison.OrdinalIgnoreCase);
}
