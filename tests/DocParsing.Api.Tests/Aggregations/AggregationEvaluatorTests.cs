using DocParsing.Api.Aggregations;
using DocParsing.Api.Services;

namespace DocParsing.Api.Tests.Aggregations;

public class AggregationEvaluatorTests
{
    private static readonly DateTime Now = new(2026, 5, 1, 12, 0, 0, DateTimeKind.Utc);

    // A tiny synthetic page: four words, each at a known x range, all on
    // the same horizontal band. Tests can shape the polygon to include or
    // exclude specific words by their x coordinate.
    private static readonly PageExtraction Page = new(
        PageNumber: 1,
        Words: new[]
        {
            WordAt("Total", x: 0.5f),
            WordAt("$100.00", x: 1.5f),
            WordAt("$50.00", x: 2.5f),
            WordAt("$25.00", x: 3.5f),
        });

    [Fact]
    public void Evaluate_sums_numeric_words_inside_polygon()
    {
        // Polygon 1.0–4.0 covers $100, $50, $25 — skips "Total" at x=0.5.
        var polygon = Rectangle(minX: 1.0f, maxX: 4.0f);

        var result = AggregationEvaluator.Evaluate(
            AggregationOperation.Sum, polygon, pageNumber: 1, pages: new[] { Page }, evaluatedAt: Now);

        Assert.Equal("175.00", result.Value);
        Assert.Equal(3, result.Config.SourceTokenCount);
        Assert.Equal("Sum", result.Config.Operation);
        Assert.Equal(Now, result.Config.EvaluatedAt);
    }

    [Fact]
    public void Evaluate_returns_null_value_when_region_is_empty()
    {
        // Polygon outside all words.
        var polygon = Rectangle(minX: 10f, maxX: 20f);

        var result = AggregationEvaluator.Evaluate(
            AggregationOperation.Sum, polygon, pageNumber: 1, pages: new[] { Page }, evaluatedAt: Now);

        Assert.Null(result.Value);
        Assert.Equal(0, result.Config.SourceTokenCount);
        Assert.Equal(0f, result.Confidence);
    }

    [Fact]
    public void Evaluate_returns_zero_count_for_empty_region()
    {
        var polygon = Rectangle(minX: 10f, maxX: 20f);

        var result = AggregationEvaluator.Evaluate(
            AggregationOperation.Count, polygon, pageNumber: 1, pages: new[] { Page }, evaluatedAt: Now);

        Assert.Equal("0", result.Value);
        Assert.Equal(0, result.Config.SourceTokenCount);
    }

    [Fact]
    public void Evaluate_skips_non_numeric_words()
    {
        // Polygon that includes "Total" plus the three currencies.
        var polygon = Rectangle(minX: 0f, maxX: 4f);

        var result = AggregationEvaluator.Evaluate(
            AggregationOperation.Count, polygon, pageNumber: 1, pages: new[] { Page }, evaluatedAt: Now);

        // Count is 3 (the currency tokens), not 4 — "Total" is excluded by parsing.
        Assert.Equal("3", result.Value);
        Assert.Equal(3, result.Config.SourceTokenCount);
    }

    [Fact]
    public void Evaluate_returns_null_value_when_page_is_missing()
    {
        var polygon = Rectangle(minX: 0f, maxX: 5f);

        var result = AggregationEvaluator.Evaluate(
            AggregationOperation.Sum,
            polygon,
            pageNumber: 99,
            pages: new[] { Page },
            evaluatedAt: Now);

        Assert.Null(result.Value);
        Assert.Equal(0, result.Config.SourceTokenCount);
    }

    [Fact]
    public void Evaluate_averages_per_word_confidence()
    {
        var pageWithVaryingConfidence = new PageExtraction(
            PageNumber: 1,
            Words: new[]
            {
                new WordData("100", new float[] { 1f, 0f, 2f, 0f, 2f, 1f, 1f, 1f }, 0.90f),
                new WordData("200", new float[] { 2f, 0f, 3f, 0f, 3f, 1f, 2f, 1f }, 0.70f),
            });

        var polygon = Rectangle(minX: 0f, maxX: 5f);

        var result = AggregationEvaluator.Evaluate(
            AggregationOperation.Sum, polygon, pageNumber: 1,
            pages: new[] { pageWithVaryingConfidence }, evaluatedAt: Now);

        Assert.Equal(0.80f, result.Confidence, precision: 4);
    }

    // Helpers — keep the test cases readable.

    private static WordData WordAt(string content, float x) =>
        new(
            Content: content,
            // 4-corner polygon centered at (x, 0.5), 0.4 wide × 0.4 tall.
            Polygon: new[]
            {
                x - 0.2f, 0.3f,
                x + 0.2f, 0.3f,
                x + 0.2f, 0.7f,
                x - 0.2f, 0.7f,
            },
            Confidence: 0.95f);

    private static float[] Rectangle(float minX, float maxX) =>
        new[] { minX, 0f, maxX, 0f, maxX, 1f, minX, 1f };
}
