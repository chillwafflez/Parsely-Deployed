namespace DocParsing.Api.Models;

/// <summary>
/// Canonical values for <see cref="ExtractedTable.Source"/>. Constants —
/// not an enum — to match the on-disk string column and the wire format
/// without extra serialization plumbing.
/// </summary>
public static class TableSources
{
    /// <summary>
    /// Visual table detected by Azure DI's layout pass and surfaced via
    /// <c>AnalyzeResult.Tables</c>. Renders in the Inspector "Tables" section.
    /// </summary>
    public const string Layout = "Layout";

    /// <summary>
    /// Synthesized by <see cref="Services.TableSynthesizer"/> from a
    /// <c>List&lt;Dictionary&gt;</c> structured field. Renders as a
    /// tabular row in the field section (with a parent field) or under the
    /// "Records" sub-header (orphan, e.g. nested <c>Transactions</c>).
    /// </summary>
    public const string Synthesized = "Synthesized";
}
