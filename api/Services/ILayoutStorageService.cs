namespace DocParsing.Api.Services;

/// <summary>
/// Persists the page-level OCR layout (word polygons + content + confidence)
/// for a document so spatial features — template-rule replay, aggregation
/// regions — can re-query it without re-running Azure Document Intelligence.
/// Stored as a sibling blob next to the original upload, under the same
/// container.
/// </summary>
public interface ILayoutStorageService
{
    /// <summary>
    /// Serializes <paramref name="pages"/> and writes them to the layout blob
    /// for <paramref name="documentId"/>. Idempotent — overwrites any existing
    /// layout for the same document.
    /// </summary>
    Task SaveAsync(
        Guid documentId,
        IReadOnlyList<PageExtraction> pages,
        CancellationToken cancellationToken = default);

    /// <summary>
    /// Loads the persisted layout for <paramref name="documentId"/>, or
    /// returns <c>null</c> when no layout has been saved (e.g., a legacy
    /// document uploaded before this feature shipped). Callers should fall
    /// back to a backfill path when they get <c>null</c>.
    /// </summary>
    Task<IReadOnlyList<PageExtraction>?> LoadAsync(
        Guid documentId,
        CancellationToken cancellationToken = default);

    /// <summary>
    /// Returns the persisted layout, or — for a legacy document that has no
    /// layout blob — runs <c>prebuilt-layout</c> against the original upload
    /// once, persists the result for next time, and returns it. Returns
    /// <c>null</c> when the original upload itself is missing (the document
    /// is broken and aggregation cannot recover it).
    /// </summary>
    Task<IReadOnlyList<PageExtraction>?> GetOrBackfillAsync(
        Guid documentId,
        string originalBlobName,
        CancellationToken cancellationToken = default);
}
