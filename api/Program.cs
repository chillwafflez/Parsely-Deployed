using DocParsing.Api.Data;
using DocParsing.Api.Services;
using Microsoft.EntityFrameworkCore;

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

builder.Services.AddSingleton<IDocumentIntelligenceService, DocumentIntelligenceService>();
builder.Services.AddSingleton<ISpeechTokenProvider, SpeechTokenProvider>();
builder.Services.AddSingleton<IVoiceFillService, VoiceFillService>();

var connectionString = builder.Configuration.GetConnectionString("Default");
if (string.IsNullOrWhiteSpace(connectionString))
{
    throw new InvalidOperationException(
        "Connection string 'Default' is not configured. For local development, run: " +
        "dotnet user-secrets set \"ConnectionStrings:Default\" \"<value>\". " +
        "In Azure, supply it via the ConnectionStrings__Default environment variable / Container Apps secret.");
}

builder.Services.AddDbContext<AppDbContext>(options =>
    options.UseSqlServer(connectionString));

const string WebCorsPolicy = "WebOrigins";
builder.Services.AddCors(options =>
{
    options.AddPolicy(WebCorsPolicy, policy =>
    {
        policy.WithOrigins("http://localhost:3000")
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
