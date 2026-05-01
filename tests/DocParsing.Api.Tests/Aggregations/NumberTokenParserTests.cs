using DocParsing.Api.Aggregations;
using DocParsing.Api.Services;

namespace DocParsing.Api.Tests.Aggregations;

public class NumberTokenParserTests
{
    [Theory]
    [InlineData("100", 100)]
    [InlineData("0", 0)]
    [InlineData("123.45", 123.45)]
    [InlineData(".5", 0.5)]
    [InlineData("100.", 100)]
    [InlineData("12,345,678.90", 12345678.90)]
    public void Parses_plain_numbers(string input, double expected)
    {
        Assert.True(NumberTokenParser.TryParse(input, out var value));
        Assert.Equal((decimal)expected, value);
    }

    [Theory]
    [InlineData("-50", -50)]
    [InlineData("+50", 50)]
    [InlineData("-12.34", -12.34)]
    public void Parses_signed_numbers(string input, double expected)
    {
        Assert.True(NumberTokenParser.TryParse(input, out var value));
        Assert.Equal((decimal)expected, value);
    }

    [Theory]
    [InlineData("$100", 100)]
    [InlineData("$1,234.56", 1234.56)]
    [InlineData("€100", 100)]
    [InlineData("£99.99", 99.99)]
    [InlineData("¥500", 500)]
    public void Parses_currency_prefixed_numbers(string input, double expected)
    {
        Assert.True(NumberTokenParser.TryParse(input, out var value));
        Assert.Equal((decimal)expected, value);
    }

    [Theory]
    [InlineData("(123.45)", -123.45)]
    [InlineData("($100)", -100)]
    [InlineData("(-100)", 100)] // double negative cancels
    public void Parses_accounting_style_negatives(string input, double expected)
    {
        Assert.True(NumberTokenParser.TryParse(input, out var value));
        Assert.Equal((decimal)expected, value);
    }

    [Theory]
    [InlineData("12.5%", 12.5)]
    [InlineData("-2.5%", -2.5)]
    [InlineData("(1%)", -1)]
    public void Parses_percent_suffixed_numbers(string input, double expected)
    {
        Assert.True(NumberTokenParser.TryParse(input, out var value));
        Assert.Equal((decimal)expected, value);
    }

    [Theory]
    [InlineData("-$50", -50)]
    [InlineData("$-50", -50)]
    [InlineData("+$50", 50)]
    public void Parses_either_sign_currency_order(string input, double expected)
    {
        Assert.True(NumberTokenParser.TryParse(input, out var value));
        Assert.Equal((decimal)expected, value);
    }

    [Theory]
    [InlineData("  $50  ", 50)]
    [InlineData("\t100\n", 100)]
    [InlineData(" -123.45 ", -123.45)]
    public void Tolerates_surrounding_whitespace(string input, double expected)
    {
        Assert.True(NumberTokenParser.TryParse(input, out var value));
        Assert.Equal((decimal)expected, value);
    }

    [Theory]
    [InlineData("")]
    [InlineData("   ")]
    [InlineData(null)]
    [InlineData("Total")]
    [InlineData("Date")]
    [InlineData(":")]
    [InlineData("-")]
    [InlineData("$")]
    [InlineData("()")]
    [InlineData("abc123")]
    [InlineData("Total: $100")] // embedded numbers are out of scope (one-token-per-word)
    public void Rejects_non_numeric_tokens(string? input)
    {
        Assert.False(NumberTokenParser.TryParse(input, out var value));
        Assert.Equal(0m, value);
    }

    [Fact]
    public void ParseWords_skips_non_numeric_entries()
    {
        var words = new[]
        {
            Word("Item"),
            Word("$100.00"),
            Word("Tax"),
            Word("$8.25"),
            Word("Total"),
            Word("$108.25"),
        };

        var parsed = NumberTokenParser.ParseWords(words).ToList();

        Assert.Equal(3, parsed.Count);
        Assert.Equal(100.00m, parsed[0].Value);
        Assert.Equal(8.25m, parsed[1].Value);
        Assert.Equal(108.25m, parsed[2].Value);
    }

    [Fact]
    public void ParseWords_pairs_each_value_with_its_source_word()
    {
        var first = Word("$100.00");
        var second = Word("$50.00");

        var parsed = NumberTokenParser.ParseWords(new[] { first, second }).ToList();

        Assert.Same(first, parsed[0].Source);
        Assert.Same(second, parsed[1].Source);
    }

    [Fact]
    public void ParseWords_preserves_input_order()
    {
        var words = new[] { Word("3"), Word("1"), Word("2") };

        var values = NumberTokenParser.ParseWords(words).Select(t => t.Value).ToList();

        Assert.Equal(new[] { 3m, 1m, 2m }, values);
    }

    private static WordData Word(string content) =>
        new(Content: content, Polygon: Array.Empty<float>(), Confidence: 0.99f);
}
