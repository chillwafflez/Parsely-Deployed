using System.ComponentModel.DataAnnotations;

namespace DocParsing.Api.Contracts;

/// <summary>
/// Payload for creating a user-drawn field on a document. The client draws
/// a rectangle on the PDF and supplies the polygon in inches (4 corners × 2
/// coords = 8 floats), matching Azure DI's native bounding-region format.
/// </summary>
public record CreateFieldRequest(
    [Required, StringLength(256, MinimumLength = 1)] string Name,
    [Required, StringLength(64, MinimumLength = 1)] string DataType,
    bool IsRequired,
    [Range(1, int.MaxValue)] int PageNumber,
    [MinLength(8)] IReadOnlyList<float> Polygon);
