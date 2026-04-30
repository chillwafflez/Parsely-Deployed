namespace DocParsing.Api.Models;

public class ExtractedTable
{
    public Guid Id { get; set; }
    public Guid DocumentId { get; set; }

    /// <summary>
    /// Where this table came from. <c>"Layout"</c> means Azure DI's
    /// <c>result.Tables</c> (visual structure detected on the page).
    /// <c>"Synthesized"</c> means the row was synthesized by
    /// <see cref="Services.TableSynthesizer"/> from an
    /// <c>Array&lt;Dictionary&gt;</c> structured field — the model's semantic
    /// interpretation, not a visual table. The two surfaces render in
    /// different parts of the Inspector; see Phase G architecture in
    /// <c>context/IDEAS.md</c>.
    /// </summary>
    public string Source { get; set; } = "Layout";

    /// <summary>
    /// Human-readable label. Always set for Synthesized tables (matches the
    /// originating field path, with a <c>[N]</c> suffix when the same name
    /// appears multiple times on the document). Null for Layout tables, which
    /// fall back to "Table N" by detection order in the UI.
    /// </summary>
    public string? Name { get; set; }

    /// <summary>
    /// Position within the document (0-based). Preserves Azure DI's detection
    /// order so the Inspector can render "Table 1", "Table 2", … consistently
    /// across reloads.
    /// </summary>
    public int Index { get; set; }

    /// <summary>
    /// First page the table appears on. Tables can span multiple pages;
    /// see <see cref="BoundingRegionsJson"/> for the full per-page breakdown.
    /// </summary>
    public int PageNumber { get; set; }

    public int RowCount { get; set; }
    public int ColumnCount { get; set; }

    /// <summary>
    /// JSON-serialized List&lt;BoundingRegionResponse&gt; — one entry per page
    /// the table spans. Same PascalCase storage convention as
    /// <see cref="ExtractedField.BoundingRegionsJson"/>; see CLAUDE.md §7.
    /// </summary>
    public string? BoundingRegionsJson { get; set; }

    /// <summary>
    /// JSON-serialized List&lt;TableCellResponse&gt; — denormalized because
    /// cells are always loaded together (a table is rendered as a single
    /// grid) and never queried individually. Edits read-modify-write the
    /// whole blob; fine at prototype scale (&lt;100 cells per table).
    /// </summary>
    public string CellsJson { get; set; } = "[]";

    public Document Document { get; set; } = null!;
}
