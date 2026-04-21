namespace DocParsing.Api.Contracts;

/// <summary>
/// PATCH body for updating a single extracted field. All properties are
/// optional — only the ones the client sends are applied.
/// </summary>
public record UpdateFieldRequest(
    string? Value,
    string? DataType,
    bool? IsRequired);
