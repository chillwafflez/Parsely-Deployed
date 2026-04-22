using DocParsing.Api.Contracts;
using DocParsing.Api.Data;
using DocParsing.Api.Services;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace DocParsing.Api.Controllers;

[ApiController]
[Route("api/[controller]")]
public class VoiceController(
    AppDbContext db,
    ISpeechTokenProvider tokenProvider,
    IVoiceFillService fillService,
    ILogger<VoiceController> logger) : ControllerBase
{
    /// <summary>
    /// Mints a short-lived Azure Speech authorization token for the browser.
    /// The subscription key itself stays server-side; only the JWT + region
    /// travel to the client.
    /// </summary>
    [HttpGet("token")]
    public async Task<ActionResult<SpeechTokenResult>> GetToken(CancellationToken ct)
    {
        try
        {
            var result = await tokenProvider.GetAsync(ct);
            return Ok(result);
        }
        catch (InvalidOperationException ex)
        {
            logger.LogWarning("Speech token unavailable: {Message}", ex.Message);
            return Problem(
                title: "Speech not configured",
                detail: ex.Message,
                statusCode: StatusCodes.Status503ServiceUnavailable);
        }
        catch (HttpRequestException ex)
        {
            logger.LogError(ex, "Speech token mint failed");
            return Problem(
                title: "Speech token mint failed",
                detail: "Could not mint Azure Speech token. Verify Speech:Key and Speech:Region.",
                statusCode: StatusCodes.Status502BadGateway);
        }
    }

    /// <summary>
    /// Maps a transcript to structured field patches, constrained by the
    /// template's field rules. The response echoes the transcript back for
    /// client-side UI (e.g. the "Undo last fill" surface).
    /// </summary>
    [HttpPost("fill")]
    public async Task<ActionResult<VoiceFillResponse>> Fill(
        [FromBody] VoiceFillRequest request,
        CancellationToken ct)
    {
        if (!ModelState.IsValid) return ValidationProblem(ModelState);
        if (request.TemplateId == Guid.Empty) return BadRequest(new { error = "TemplateId is required." });

        var template = await db.Templates
            .Include(t => t.Rules)
            .AsNoTracking()
            .FirstOrDefaultAsync(t => t.Id == request.TemplateId, ct);

        if (template is null) return NotFound();

        // Normalise the lookup here so the service can trust the key
        // comparer; the LLM's response field-name match uses the same.
        var currentValues = request.CurrentValues is null
            ? new Dictionary<string, string?>(StringComparer.OrdinalIgnoreCase)
            : new Dictionary<string, string?>(request.CurrentValues, StringComparer.OrdinalIgnoreCase);

        try
        {
            logger.LogInformation(
                "Voice fill request for template {TemplateId} ({RuleCount} rules): {Transcript}",
                template.Id, template.Rules.Count, request.Transcript);

            var result = await fillService.ExtractPatchesAsync(
                template, request.Transcript, currentValues, ct);

            var dto = new VoiceFillResponse(
                Patches: result.Patches
                    .Select(p => new FieldPatchResponse(p.Field, p.Value, p.DataType, p.Warning))
                    .ToList(),
                UnmatchedPhrases: result.UnmatchedPhrases,
                Transcript: request.Transcript);

            return Ok(dto);
        }
        catch (InvalidOperationException ex)
        {
            logger.LogWarning("Voice fill unavailable: {Message}", ex.Message);
            return Problem(
                title: "Voice fill not configured",
                detail: ex.Message,
                statusCode: StatusCodes.Status503ServiceUnavailable);
        }
    }
}
