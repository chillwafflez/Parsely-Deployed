namespace DocParsing.Api.Services;

public class DocumentIntelligenceOptions
{
    public const string SectionName = "DocumentIntelligence";

    public string Endpoint { get; set; } = string.Empty;
    public string Key { get; set; } = string.Empty;
}
