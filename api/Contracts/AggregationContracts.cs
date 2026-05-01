using System.ComponentModel.DataAnnotations;

namespace DocParsing.Api.Contracts;

/// <summary>
/// Request body for the aggregation preview endpoint. Carries the polygon
/// the user just drew on the document; the backend filters layout words to
/// that region and parses numeric tokens for the modal preview.
/// </summary>
public class AggregationPreviewRequest
{
    [Required]
    [Range(1, int.MaxValue, ErrorMessage = "PageNumber must be 1 or greater.")]
    public int PageNumber { get; set; }

    /// <summary>
    /// Flat <c>[x0, y0, x1, y1, …]</c> array in the page's native unit
    /// (inches for PDFs). Minimum 8 floats — 4 points × 2 coords.
    /// </summary>
    [Required]
    [MinLength(8, ErrorMessage = "Polygon must have at least 4 points (8 floats).")]
    public float[] Polygon { get; set; } = Array.Empty<float>();
}

/// <summary>
/// Preview result returned to the modal: the parsed numeric tokens inside
/// the drawn region. The frontend computes Sum / Average / Count / Min / Max
/// from this list locally as the user toggles operations — no extra
/// round-trip per op.
/// </summary>
/// <param name="Tokens">Parsed numeric tokens, in document order.</param>
public record AggregationPreviewResponse(
    IReadOnlyList<AggregationTokenResponse> Tokens);

/// <param name="Text">Original word content as Azure DI extracted it (e.g., "$1,234.56").</param>
/// <param name="Value">Parsed numeric value (e.g., <c>1234.56</c>).</param>
/// <param name="Confidence">Per-word OCR confidence in <c>[0, 1]</c>.</param>
/// <param name="Polygon">Word polygon for per-token highlighting on the document overlay.</param>
public record AggregationTokenResponse(
    string Text,
    decimal Value,
    float Confidence,
    float[] Polygon);

/// <summary>
/// Request body for committing an aggregation field. Computed result lands
/// as a regular <see cref="DocParsing.Api.Models.ExtractedField"/> on the
/// document; if the document has a matched template, an equivalent
/// <see cref="DocParsing.Api.Models.TemplateAggregationRule"/> is also
/// persisted so future uploads replay the aggregation automatically.
/// </summary>
public class CreateAggregationRequest
{
    [Required, MinLength(1), MaxLength(256)]
    public string Name { get; set; } = string.Empty;

    /// <summary>One of <c>Sum</c>, <c>Average</c>, <c>Count</c>, <c>Min</c>, <c>Max</c> (case-insensitive).</summary>
    [Required, MaxLength(16)]
    public string Operation { get; set; } = string.Empty;

    public bool IsRequired { get; set; }

    [Required]
    [Range(1, int.MaxValue, ErrorMessage = "PageNumber must be 1 or greater.")]
    public int PageNumber { get; set; }

    [Required]
    [MinLength(8, ErrorMessage = "Polygon must have at least 4 points (8 floats).")]
    public float[] Polygon { get; set; } = Array.Empty<float>();
}

/// <summary>
/// Aggregation provenance attached to an <see cref="ExtractedFieldResponse"/>.
/// Presence — not <c>DataType</c> — is what the frontend keys off to route
/// the field into the Inspector's <c>CUSTOM — AGGREGATIONS</c> group.
/// </summary>
/// <param name="Operation">One of <c>Sum</c> / <c>Average</c> / <c>Count</c> / <c>Min</c> / <c>Max</c>.</param>
/// <param name="SourceTokenCount">Numeric tokens that contributed to the value at evaluation time.</param>
/// <param name="EvaluatedAt">When the result was last computed — used later for staleness detection.</param>
public record AggregationFieldConfig(
    string Operation,
    int SourceTokenCount,
    DateTime EvaluatedAt);
