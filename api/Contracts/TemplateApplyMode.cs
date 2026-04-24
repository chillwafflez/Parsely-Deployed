namespace DocParsing.Api.Contracts;

/// <summary>
/// Controls how templates are applied to a freshly-uploaded document.
/// Selected by the user at upload time; defaults to <see cref="Auto"/>
/// when omitted to preserve historic behavior.
/// </summary>
public enum TemplateApplyMode
{
    /// <summary>Match by VendorName → VendorHint and apply if found.</summary>
    Auto,

    /// <summary>
    /// Apply the template specified by <c>templateId</c> unconditionally.
    /// Skips the VendorName heuristic — the user is overriding.
    /// </summary>
    Manual,

    /// <summary>Skip template logic entirely; store raw extracted fields.</summary>
    None,
}
