using System.Globalization;
using DocParsing.Api.Services;

namespace DocParsing.Api.Aggregations;

/// <summary>
/// Extracts numeric values from Azure Document Intelligence layout words.
/// Tolerates currency symbols, accounting-style negatives ("(123.45)"),
/// thousands separators, leading signs, and trailing percent signs. EU-style
/// decimals (comma-as-decimal) are intentionally not supported in v1.
/// </summary>
public static class NumberTokenParser
{
    private static readonly char[] CurrencySymbols = ['$', '€', '£', '¥'];

    /// <summary>
    /// Parses one word's content as a decimal value. Returns <c>false</c>
    /// when the content has no numeric body — pure labels like "Total",
    /// punctuation, or empty strings.
    /// </summary>
    public static bool TryParse(string? content, out decimal value)
    {
        value = 0m;
        if (string.IsNullOrWhiteSpace(content)) return false;

        var s = content.Trim();
        var negative = false;

        // Accounting-style negative — "(123.45)" → -123.45.
        if (s.Length >= 2 && s[0] == '(' && s[^1] == ')')
        {
            negative = true;
            s = s[1..^1].Trim();
        }

        // Trailing percent — keep the displayed magnitude (12.5%, not 0.125).
        // Aggregations on percent columns sum the displayed values; converting
        // to fractions would surprise users reading the source PDF.
        if (s.EndsWith('%')) s = s[..^1].Trim();

        // Strip a leading sign before any currency symbol so "-$50" parses
        // the same as "$-50". Two-pass loop allows either order, at most one
        // strip per kind.
        var signStripped = false;
        var currencyStripped = false;
        for (var i = 0; i < 2 && s.Length > 0; i++)
        {
            var c = s[0];
            if (!signStripped && (c == '-' || c == '+'))
            {
                if (c == '-') negative = !negative;
                s = s[1..].TrimStart();
                signStripped = true;
                continue;
            }
            if (!currencyStripped && Array.IndexOf(CurrencySymbols, c) >= 0)
            {
                s = s[1..].TrimStart();
                currencyStripped = true;
                continue;
            }
            break;
        }

        // Strip thousands separators — invariant-culture US formatting.
        s = s.Replace(",", string.Empty);

        if (!decimal.TryParse(
            s,
            NumberStyles.AllowLeadingSign | NumberStyles.AllowDecimalPoint,
            CultureInfo.InvariantCulture,
            out var parsed))
        {
            return false;
        }

        value = negative ? -parsed : parsed;
        return true;
    }

    /// <summary>
    /// Yields a <see cref="ParsedToken"/> for each word whose content parses
    /// as a number. Non-numeric words (labels, punctuation) are skipped.
    /// </summary>
    public static IEnumerable<ParsedToken> ParseWords(IEnumerable<WordData> words)
    {
        foreach (var word in words)
        {
            if (TryParse(word.Content, out var value))
            {
                yield return new ParsedToken(word, value);
            }
        }
    }
}

/// <summary>
/// A successfully-parsed numeric token, paired with the layout word it came
/// from so callers can later associate the value with its source bbox for
/// preview-list display and per-token highlighting on the document overlay.
/// </summary>
public record ParsedToken(WordData Source, decimal Value);
