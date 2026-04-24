namespace DocParsing.Api.Services;

public interface IBlobStorageService
{
    /// <summary>
    /// Uploads <paramref name="content"/> as a blob with the given name and
    /// content type. Overwrites if the blob already exists.
    /// </summary>
    Task UploadAsync(
        string blobName,
        Stream content,
        string contentType,
        CancellationToken cancellationToken = default);

    /// <summary>
    /// Opens a read stream for the named blob, or returns <c>null</c> if it
    /// does not exist. Caller is responsible for disposing the stream.
    /// </summary>
    Task<Stream?> TryOpenReadAsync(
        string blobName,
        CancellationToken cancellationToken = default);
}
