namespace DocParsing.Api.Models;

public class ExtractedTable
{
    public Guid Id { get; set; }
    public Guid DocumentId { get; set; }

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
