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

builder.Services.AddDbContext<AppDbContext>(options =>
    options.UseSqlite(builder.Configuration.GetConnectionString("Default")
        ?? "Data Source=app.db"));

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

using (var scope = app.Services.CreateScope())
{
    var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
    db.Database.EnsureCreated();
}

if (app.Environment.IsDevelopment())
{
    app.MapOpenApi();
}

app.UseCors(WebCorsPolicy);
app.MapControllers();

app.Run();
