using System.Text.Json;
using DocParsing.Api.Models;

namespace DocParsing.Api.Contracts;

public record TableResponse(
    Guid Id,
    int Index,
    int PageNumber,
    int RowCount,
    int ColumnCount,
    string Source,
    string? Name,
    IReadOnlyList<BoundingRegionResponse> BoundingRegions,
    IReadOnlyList<TableCellResponse> Cells)
{
    public static TableResponse FromEntity(ExtractedTable t)
    {
        var regions = string.IsNullOrWhiteSpace(t.BoundingRegionsJson)
            ? new List<BoundingRegionResponse>()
            : JsonSerializer.Deserialize<List<BoundingRegionResponse>>(t.BoundingRegionsJson)
              ?? new List<BoundingRegionResponse>();

        var cells = JsonSerializer.Deserialize<List<TableCellResponse>>(t.CellsJson)
                    ?? new List<TableCellResponse>();

        return new TableResponse(
            Id: t.Id,
            Index: t.Index,
            PageNumber: t.PageNumber,
            RowCount: t.RowCount,
            ColumnCount: t.ColumnCount,
            Source: t.Source,
            Name: t.Name,
            BoundingRegions: regions,
            Cells: cells);
    }
}

/// <summary>
/// Wire shape AND on-disk JSON shape for a single table cell. Reused for
/// both serialization (when persisting <see cref="ExtractedTable.CellsJson"/>)
/// and the API response — same pattern as <see cref="BoundingRegionResponse"/>
/// for field bounding regions. <c>IsCorrected</c> flips on the first user
/// edit and stays true; same convention as <see cref="ExtractedField.IsCorrected"/>.
/// </summary>
public record TableCellResponse(
    int RowIndex,
    int ColumnIndex,
    int RowSpan,
    int ColumnSpan,
    string Kind,
    string? Content,
    bool IsCorrected,
    IReadOnlyList<BoundingRegionResponse> BoundingRegions);
