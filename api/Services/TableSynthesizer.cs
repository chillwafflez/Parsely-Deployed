using Azure.AI.DocumentIntelligence;
using DocParsing.Api.Models;

namespace DocParsing.Api.Services;

/// <summary>
/// Builds <see cref="TableExtraction"/>s from <c>List&lt;Dictionary&gt;</c>
/// structured fields ("Items", "Accounts", nested "Transactions", …) — the
/// model's structured interpretation of repeating data.
///
/// Distinct from layout's <c>result.Tables</c> (visual table structure on
/// the page). Both surfaces coexist by design (Phase G architecture in
/// <c>context/IDEAS.md</c>): synth tables are bound to a parent field via
/// <see cref="TableExtraction.Name"/>, while layout tables use detection-order
/// "Table N" labelling.
///
/// Walking is recursive: a top-level <c>Items</c> array becomes one table,
/// and a nested <c>Accounts[i].Transactions</c> array becomes its own
/// table at the leaf name. Repeated leaf names are disambiguated with a
/// <c>[N]</c> suffix.
/// </summary>
public static class TableSynthesizer
{
    /// <summary>
    /// Walks every field on the document and emits a synth table for each
    /// <c>List&lt;Dictionary&gt;</c> encountered (top-level or nested).
    /// Indexes are sequential within the synth set; the caller offsets when
    /// merging into the document's global table order.
    /// </summary>
    public static IReadOnlyList<TableExtraction> Synthesize(
        IReadOnlyDictionary<string, DocumentField> fields)
    {
        var tables = new List<TableExtraction>();
        var nameCounts = new Dictionary<string, int>(StringComparer.OrdinalIgnoreCase);

        foreach (var (name, field) in fields)
        {
            WalkField(name, field, tables, nameCounts);
        }

        return tables.Select((t, i) => t with { Index = i }).ToList();
    }

    private static void WalkField(
        string name,
        DocumentField field,
        List<TableExtraction> output,
        Dictionary<string, int> nameCounts)
    {
        if (AzureFieldMapping.IsArrayOfDictionaries(field, out var items))
        {
            output.Add(BuildTable(LeafName(name), items, nameCounts));

            // Recurse into each row's children. A nested List<Dictionary>
            // (e.g., Accounts[i].Transactions) becomes its own table — the
            // [N] suffix on AssignName handles the repeated leaf name.
            foreach (var item in items)
            {
                if (item.ValueDictionary is { Count: > 0 } children)
                {
                    foreach (var (childKey, childField) in children)
                    {
                        WalkField(childKey, childField, output, nameCounts);
                    }
                }
            }
            return;
        }

        if (field.FieldType == DocumentFieldType.Dictionary
            && field.ValueDictionary is { Count: > 0 } dict)
        {
            foreach (var (childKey, childField) in dict)
            {
                WalkField(childKey, childField, output, nameCounts);
            }
        }
    }

    private static TableExtraction BuildTable(
        string baseName,
        IReadOnlyList<DocumentField> items,
        Dictionary<string, int> nameCounts)
    {
        var name = AssignName(baseName, nameCounts);

        // Column order = first appearance across rows. Stable across reloads
        // because DocumentField.ValueDictionary preserves insertion order.
        var columnOrder = new List<string>();
        var seen = new HashSet<string>(StringComparer.Ordinal);
        foreach (var item in items)
        {
            if (item.ValueDictionary is null) continue;
            foreach (var key in item.ValueDictionary.Keys)
            {
                if (seen.Add(key)) columnOrder.Add(key);
            }
        }

        var cells = new List<TableCellData>(capacity: (items.Count + 1) * columnOrder.Count);

        // Row 0: column headers. No bbox — these are synthesized labels, not
        // text on the page. Kind="columnHeader" so the grid styles them.
        for (var col = 0; col < columnOrder.Count; col++)
        {
            cells.Add(new TableCellData(
                RowIndex: 0,
                ColumnIndex: col,
                RowSpan: 1,
                ColumnSpan: 1,
                Kind: "columnHeader",
                Content: columnOrder[col],
                BoundingRegions: Array.Empty<BoundingRegionData>()));
        }

        // Data rows: one per item, one cell per column key. Missing keys
        // emit an empty cell so every (row, col) is addressable for editing.
        for (var row = 0; row < items.Count; row++)
        {
            var item = items[row];
            for (var col = 0; col < columnOrder.Count; col++)
            {
                var key = columnOrder[col];
                DocumentField? cellField = null;
                if (item.ValueDictionary is { } map && map.TryGetValue(key, out var value))
                {
                    cellField = value;
                }

                cells.Add(new TableCellData(
                    RowIndex: row + 1,
                    ColumnIndex: col,
                    RowSpan: 1,
                    ColumnSpan: 1,
                    Kind: "content",
                    Content: cellField is null ? null : AzureFieldMapping.FormatValue(cellField),
                    BoundingRegions: cellField is null
                        ? Array.Empty<BoundingRegionData>()
                        : AzureFieldMapping.ToRegionData(cellField.BoundingRegions)));
            }
        }

        // Per-row regions: one entry per array item, mirroring DI Studio's
        // visual treatment of structured arrays (Items, Accounts, …). Each
        // row may contribute multiple regions when the underlying item spans
        // pages — we flatten so the overlay can filter by page in one pass.
        // Items with no own region are skipped silently rather than faked
        // from cell unions; the synth table still works without an outline
        // for that row, and a faked region would mis-represent the data.
        var rowRegions = items
            .SelectMany(item => AzureFieldMapping.ToRegionData(item.BoundingRegions))
            .ToList();

        var pageNumber = FirstPage(items);

        return new TableExtraction(
            // Re-assigned by Synthesize after the full walk.
            Index: 0,
            PageNumber: pageNumber,
            // +1 for the header row.
            RowCount: items.Count + 1,
            ColumnCount: columnOrder.Count,
            Source: TableSources.Synthesized,
            Name: name,
            BoundingRegions: rowRegions,
            Cells: cells);
    }

    private static string AssignName(string baseName, Dictionary<string, int> nameCounts)
    {
        if (!nameCounts.TryGetValue(baseName, out var count))
        {
            nameCounts[baseName] = 1;
            return baseName;
        }

        nameCounts[baseName] = count + 1;
        return $"{baseName} [{count + 1}]";
    }

    /// <summary>
    /// "Accounts.Transactions" → "Transactions". A nested array's table is
    /// labelled by its array name only, since that's the user-recognisable
    /// concept; <c>[N]</c> suffixes disambiguate when the same leaf name
    /// repeats across parent rows.
    /// </summary>
    private static string LeafName(string flatName)
    {
        var dot = flatName.LastIndexOf('.');
        return dot < 0 ? flatName : flatName[(dot + 1)..];
    }

    private static int FirstPage(IReadOnlyList<DocumentField> items)
    {
        foreach (var item in items)
        {
            if (item.BoundingRegions is { Count: > 0 } itemRegions)
            {
                return itemRegions[0].PageNumber;
            }

            // Item itself often has no top-level region — peek at its first
            // child field that does.
            if (item.ValueDictionary is null) continue;
            foreach (var child in item.ValueDictionary.Values)
            {
                if (child.BoundingRegions is { Count: > 0 } childRegions)
                {
                    return childRegions[0].PageNumber;
                }
            }
        }

        return 1;
    }
}
