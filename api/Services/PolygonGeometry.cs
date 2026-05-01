namespace DocParsing.Api.Services;

/// <summary>
/// Pure-static geometry helpers shared by template-rule extraction and
/// aggregation-region extraction. Both features need to ask the same
/// question: which layout words sit inside a user-drawn polygon? Azure DI
/// polygons are flat float arrays of <c>[x0, y0, x1, y1, …]</c> in the
/// page's native unit (inches for PDFs, pixels for images), so all helpers
/// operate in that unit.
/// </summary>
public static class PolygonGeometry
{
    /// <summary>
    /// Computes the axis-aligned bounding rectangle for a polygon. Returns
    /// <c>null</c> when the polygon is empty or malformed (fewer than two
    /// coordinate values).
    /// </summary>
    public static (float MinX, float MinY, float MaxX, float MaxY)? AxisAlignedBounds(
        IReadOnlyList<float> polygon)
    {
        if (polygon is null || polygon.Count < 2) return null;

        float minX = float.MaxValue, minY = float.MaxValue;
        float maxX = float.MinValue, maxY = float.MinValue;

        for (var i = 0; i + 1 < polygon.Count; i += 2)
        {
            var x = polygon[i];
            var y = polygon[i + 1];
            if (x < minX) minX = x;
            if (x > maxX) maxX = x;
            if (y < minY) minY = y;
            if (y > maxY) maxY = y;
        }

        return (minX, minY, maxX, maxY);
    }

    /// <summary>
    /// Returns <c>true</c> when the centroid of <paramref name="wordPolygon"/>
    /// falls inside <paramref name="bounds"/>. Centroid (rather than overlap)
    /// is the correct test for short layout words — a word straddling the
    /// edge of a region is "in" or "out" by where its mass actually sits, not
    /// by whether any pixel touches the region.
    /// </summary>
    public static bool WordCenterInside(
        IReadOnlyList<float> wordPolygon,
        (float MinX, float MinY, float MaxX, float MaxY) bounds)
    {
        if (wordPolygon is null || wordPolygon.Count < 2) return false;

        float sumX = 0, sumY = 0;
        var count = 0;
        for (var i = 0; i + 1 < wordPolygon.Count; i += 2)
        {
            sumX += wordPolygon[i];
            sumY += wordPolygon[i + 1];
            count++;
        }
        if (count == 0) return false;

        var cx = sumX / count;
        var cy = sumY / count;

        return cx >= bounds.MinX && cx <= bounds.MaxX
               && cy >= bounds.MinY && cy <= bounds.MaxY;
    }

    /// <summary>
    /// Filters <paramref name="words"/> to those whose centroids fall inside
    /// <paramref name="regionPolygon"/>'s axis-aligned bounds. Returns an
    /// empty list when the region is missing or malformed.
    /// </summary>
    public static IReadOnlyList<WordData> WordsInsideRegion(
        IReadOnlyList<WordData> words,
        IReadOnlyList<float> regionPolygon)
    {
        var bounds = AxisAlignedBounds(regionPolygon);
        if (!bounds.HasValue) return Array.Empty<WordData>();

        var matched = new List<WordData>();
        foreach (var word in words)
        {
            if (WordCenterInside(word.Polygon, bounds.Value))
            {
                matched.Add(word);
            }
        }
        return matched;
    }
}
