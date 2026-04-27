namespace DocParsing.Api.Contracts;

/// <summary>
/// Wire-format projection of a <see cref="DocParsing.Api.Catalog.DocumentTypeDefinition"/>.
/// Only carries the fields the frontend needs to render the upload picker
/// and resolve a <c>modelId</c> back to a display label — the per-model
/// matching path and flatten flag stay server-side.
/// </summary>
public record DocumentTypeResponse(
    string ModelId,
    string DisplayName,
    string? SampleAssetUrl);
