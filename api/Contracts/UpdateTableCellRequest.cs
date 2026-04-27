namespace DocParsing.Api.Contracts;

/// <summary>
/// PATCH body for updating a single cell within an extracted table.
/// <c>RowIndex</c> and <c>ColumnIndex</c> identify the cell — for merged
/// cells, supply the top-left coordinates (which is how Azure DI addresses
/// merged regions). <c>Content</c> is the new value; null clears the cell.
/// </summary>
public record UpdateTableCellRequest(
    int RowIndex,
    int ColumnIndex,
    string? Content);
