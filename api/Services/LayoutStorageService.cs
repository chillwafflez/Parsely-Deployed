using System.Text.Json;

namespace DocParsing.Api.Services;

public class LayoutStorageService : ILayoutStorageService
{
    private const string ContentType = "application/json";
    private const string LayoutModelId = "prebuilt-layout";

    // The blob round-trips between two calls in this same service, so the
    // only thing that matters is symmetric serialize/deserialize. Defaults
    // (PascalCase, matching the C# record property names) are fine.
    private static readonly JsonSerializerOptions SerializerOptions = new();

    private readonly IBlobStorageService _blobs;
    private readonly IDocumentIntelligenceService _intelligence;
    private readonly ILogger<LayoutStorageService> _logger;

    public LayoutStorageService(
        IBlobStorageService blobs,
        IDocumentIntelligenceService intelligence,
        ILogger<LayoutStorageService> logger)
    {
        _blobs = blobs;
        _intelligence = intelligence;
        _logger = logger;
    }

    public async Task SaveAsync(
        Guid documentId,
        IReadOnlyList<PageExtraction> pages,
        CancellationToken cancellationToken = default)
    {
        await using var buffer = new MemoryStream();
        await JsonSerializer.SerializeAsync(buffer, pages, SerializerOptions, cancellationToken);
        buffer.Position = 0;

        await _blobs.UploadAsync(BlobName(documentId), buffer, ContentType, cancellationToken);
    }

    public async Task<IReadOnlyList<PageExtraction>?> LoadAsync(
        Guid documentId,
        CancellationToken cancellationToken = default)
    {
        await using var stream = await _blobs.TryOpenReadAsync(BlobName(documentId), cancellationToken);
        if (stream is null) return null;

        return await JsonSerializer.DeserializeAsync<List<PageExtraction>>(
            stream, SerializerOptions, cancellationToken);
    }

    public async Task<IReadOnlyList<PageExtraction>?> GetOrBackfillAsync(
        Guid documentId,
        string originalBlobName,
        CancellationToken cancellationToken = default)
    {
        var existing = await LoadAsync(documentId, cancellationToken);
        if (existing is not null) return existing;

        await using var pdf = await _blobs.TryOpenReadAsync(originalBlobName, cancellationToken);
        if (pdf is null) return null;

        _logger.LogInformation(
            "Backfilling layout for legacy document {Id} via prebuilt-layout.",
            documentId);

        var extraction = await _intelligence.AnalyzeAsync(pdf, LayoutModelId, cancellationToken);
        await SaveAsync(documentId, extraction.Pages, cancellationToken);
        return extraction.Pages;
    }

    // {id-without-dashes}-layout.json — parallels the existing upload blob
    // naming ({id-without-dashes}-{filename}) so related artifacts cluster
    // together when browsing the container.
    private static string BlobName(Guid documentId) => $"{documentId:N}-layout.json";
}
