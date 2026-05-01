using DocParsing.Api.Aggregations;

namespace DocParsing.Api.Tests.Aggregations;

public class AggregationComputeTests
{
    [Fact]
    public void Sum_adds_all_values()
    {
        var result = AggregationCompute.Compute(
            AggregationOperation.Sum,
            new[] { 100m, 47.50m, 28m, 120m, 14.95m });

        Assert.Equal(310.45m, result);
    }

    [Fact]
    public void Sum_handles_negatives()
    {
        var result = AggregationCompute.Compute(
            AggregationOperation.Sum,
            new[] { 100m, -25m, 50m });

        Assert.Equal(125m, result);
    }

    [Fact]
    public void Average_divides_sum_by_count()
    {
        var result = AggregationCompute.Compute(
            AggregationOperation.Average,
            new[] { 10m, 20m, 30m });

        Assert.Equal(20m, result);
    }

    [Fact]
    public void Count_returns_value_count_for_nonempty()
    {
        var result = AggregationCompute.Compute(
            AggregationOperation.Count,
            new[] { 1m, 2m, 3m, 4m, 5m });

        Assert.Equal(5m, result);
    }

    [Fact]
    public void Count_returns_zero_for_empty_input()
    {
        var result = AggregationCompute.Compute(
            AggregationOperation.Count,
            Array.Empty<decimal>());

        Assert.Equal(0m, result);
    }

    [Theory]
    [InlineData(AggregationOperation.Sum)]
    [InlineData(AggregationOperation.Average)]
    [InlineData(AggregationOperation.Min)]
    [InlineData(AggregationOperation.Max)]
    public void Non_count_operations_return_null_for_empty_input(AggregationOperation op)
    {
        var result = AggregationCompute.Compute(op, Array.Empty<decimal>());

        Assert.Null(result);
    }

    [Fact]
    public void Min_returns_smallest_value()
    {
        var result = AggregationCompute.Compute(
            AggregationOperation.Min,
            new[] { 10m, 5m, 100m, 1m, 50m });

        Assert.Equal(1m, result);
    }

    [Fact]
    public void Max_returns_largest_value()
    {
        var result = AggregationCompute.Compute(
            AggregationOperation.Max,
            new[] { 10m, 5m, 100m, 1m, 50m });

        Assert.Equal(100m, result);
    }

    [Fact]
    public void Min_handles_negatives()
    {
        var result = AggregationCompute.Compute(
            AggregationOperation.Min,
            new[] { -5m, 0m, 5m });

        Assert.Equal(-5m, result);
    }

    [Theory]
    [InlineData(AggregationOperation.Sum, 310.45, "310.45")]
    [InlineData(AggregationOperation.Average, 20, "20.00")]
    [InlineData(AggregationOperation.Min, 1.5, "1.50")]
    [InlineData(AggregationOperation.Max, 100, "100.00")]
    public void Format_uses_two_decimals_for_numeric_operations(
        AggregationOperation op, double value, string expected)
    {
        Assert.Equal(expected, AggregationCompute.Format(op, (decimal)value));
    }

    [Fact]
    public void Format_uses_integer_for_count()
    {
        Assert.Equal("7", AggregationCompute.Format(AggregationOperation.Count, 7m));
    }

    [Fact]
    public void Format_returns_empty_string_for_null_result()
    {
        Assert.Equal(string.Empty, AggregationCompute.Format(AggregationOperation.Sum, null));
    }

    [Theory]
    [InlineData("sum", AggregationOperation.Sum)]
    [InlineData("Sum", AggregationOperation.Sum)]
    [InlineData("SUM", AggregationOperation.Sum)]
    [InlineData("average", AggregationOperation.Average)]
    [InlineData("count", AggregationOperation.Count)]
    [InlineData("min", AggregationOperation.Min)]
    [InlineData("max", AggregationOperation.Max)]
    public void TryParseOperation_accepts_canonical_names_case_insensitively(
        string input, AggregationOperation expected)
    {
        Assert.True(AggregationCompute.TryParseOperation(input, out var op));
        Assert.Equal(expected, op);
    }

    [Theory]
    [InlineData("")]
    [InlineData("   ")]
    [InlineData(null)]
    [InlineData("median")]
    [InlineData("concat")]
    [InlineData("formula")]
    [InlineData("99")]
    public void TryParseOperation_rejects_unknown_names(string? input)
    {
        Assert.False(AggregationCompute.TryParseOperation(input, out _));
    }
}
