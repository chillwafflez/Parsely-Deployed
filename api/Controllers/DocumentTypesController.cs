using DocParsing.Api.Catalog;
using DocParsing.Api.Contracts;
using Microsoft.AspNetCore.Mvc;

namespace DocParsing.Api.Controllers;

/// <summary>
/// Read-only endpoint that exposes the catalog of supported Document
/// Intelligence prebuilt models. The frontend fetches this once per session
/// and uses it to render the upload-stage picker and to resolve a
/// <c>modelId</c> back to a display label across the UI.
/// </summary>
[ApiController]
[Route("api/document-types")]
public class DocumentTypesController : ControllerBase
{
    [HttpGet]
    public ActionResult<IReadOnlyList<DocumentTypeResponse>> List()
    {
        var response = DocumentTypeCatalog.All
            .Select(e => new DocumentTypeResponse(e.ModelId, e.DisplayName, e.SampleAssetUrl))
            .ToList();

        return Ok(response);
    }
}
