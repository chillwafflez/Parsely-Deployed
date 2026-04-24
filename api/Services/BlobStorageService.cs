using Azure;
using Azure.Storage.Blobs;
using Azure.Storage.Blobs.Models;
using Microsoft.Extensions.Options;

namespace DocParsing.Api.Services;

public class BlobStorageService : IBlobStorageService
{
    private readonly BlobContainerClient _container;

    public BlobStorageService(BlobServiceClient serviceClient, IOptions<BlobStorageOptions> options)
    {
        var containerName = options.Value.ContainerName;
        if (string.IsNullOrWhiteSpace(containerName))
        {
            throw new InvalidOperationException(
                $"{BlobStorageOptions.SectionName}:ContainerName is not configured.");
        }

        _container = serviceClient.GetBlobContainerClient(containerName);
    }

    public async Task UploadAsync(
        string blobName,
        Stream content,
        string contentType,
        CancellationToken cancellationToken = default)
    {
        var blob = _container.GetBlobClient(blobName);
        var options = new BlobUploadOptions
        {
            HttpHeaders = new BlobHttpHeaders { ContentType = contentType },
        };

        await blob.UploadAsync(content, options, cancellationToken);
    }

    public async Task<Stream?> TryOpenReadAsync(
        string blobName,
        CancellationToken cancellationToken = default)
    {
        var blob = _container.GetBlobClient(blobName);
        try
        {
            return await blob.OpenReadAsync(cancellationToken: cancellationToken);
        }
        catch (RequestFailedException ex) when (ex.Status == 404)
        {
            return null;
        }
    }
}
