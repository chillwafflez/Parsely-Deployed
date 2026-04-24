namespace DocParsing.Api.Services;

public class BlobStorageOptions
{
    public const string SectionName = "BlobStorage";

    public string ContainerName { get; set; } = string.Empty;
}
