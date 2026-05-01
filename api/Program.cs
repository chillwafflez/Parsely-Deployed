using DocParsing.Api.Data;
using DocParsing.Api.Services;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Azure;

var builder = WebApplication.CreateBuilder(args);

builder.Services.AddControllers();
builder.Services.AddOpenApi();
builder.Services.AddHttpClient();

builder.Services.Configure<DocumentIntelligenceOptions>(
    builder.Configuration.GetSection(DocumentIntelligenceOptions.SectionName));
builder.Services.Configure<SpeechOptions>(
    builder.Configuration.GetSection(SpeechOptions.SectionName));
builder.Services.Configure<OpenAIOptions>(
    builder.Configuration.GetSection(OpenAIOptions.SectionName));
builder.Services.Configure<BlobStorageOptions>(
    builder.Configuration.GetSection(BlobStorageOptions.SectionName));

builder.Services.AddSingleton<IDocumentIntelligenceService, DocumentIntelligenceService>();
builder.Services.AddSingleton<ISpeechTokenProvider, SpeechTokenProvider>();
builder.Services.AddSingleton<IVoiceFillService, VoiceFillService>();
builder.Services.AddSingleton<IBlobStorageService, BlobStorageService>();
builder.Services.AddSingleton<ILayoutStorageService, LayoutStorageService>();

var sqlConnectionString = builder.Configuration.GetConnectionString("Default");
if (string.IsNullOrWhiteSpace(sqlConnectionString))
{
    throw new InvalidOperationException(
        "Connection string 'Default' is not configured. For local development, run: " +
        "dotnet user-secrets set \"ConnectionStrings:Default\" \"<value>\". " +
        "In Azure, supply it via the ConnectionStrings__Default environment variable / Container Apps secret.");
}

var blobConnectionString = builder.Configuration.GetConnectionString("BlobStorage");
if (string.IsNullOrWhiteSpace(blobConnectionString))
{
    throw new InvalidOperationException(
        "Connection string 'BlobStorage' is not configured. For local development, run: " +
        "dotnet user-secrets set \"ConnectionStrings:BlobStorage\" \"<value>\". " +
        "In Azure, supply it via the ConnectionStrings__BlobStorage environment variable / Container Apps secret.");
}

builder.Services.AddDbContext<AppDbContext>(options =>
    options.UseSqlServer(sqlConnectionString));

builder.Services.AddAzureClients(clients =>
{
    clients.AddBlobServiceClient(blobConnectionString);
});

const string WebCorsPolicy = "WebOrigins";
var allowedOrigins = builder.Configuration
    .GetSection("Cors:AllowedOrigins").Get<string[]>() ?? [];

builder.Services.AddCors(options =>
{
    options.AddPolicy(WebCorsPolicy, policy =>
    {
        policy.WithOrigins(allowedOrigins)
              .SetIsOriginAllowedToAllowWildcardSubdomains()
              .AllowAnyHeader()
              .AllowAnyMethod();
    });
});

var app = builder.Build();

// TODO (Phase 2): move to migration bundles applied by CI/CD instead of on app start.
// Migrate-on-startup is fine for the prototype (single ACA replica, no concurrent writers)
// but Microsoft's guidance flags it as risky at production scale.
using (var scope = app.Services.CreateScope())
{
    var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
    db.Database.Migrate();
}

if (app.Environment.IsDevelopment())
{
    app.MapOpenApi();
}

app.UseCors(WebCorsPolicy);
app.MapControllers();

app.Run();
