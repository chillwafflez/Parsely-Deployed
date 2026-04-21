using DocParsing.Api.Models;
using Microsoft.EntityFrameworkCore;

namespace DocParsing.Api.Data;

public class AppDbContext(DbContextOptions<AppDbContext> options) : DbContext(options)
{
    public DbSet<Document> Documents => Set<Document>();
    public DbSet<ExtractedField> ExtractedFields => Set<ExtractedField>();
    public DbSet<Template> Templates => Set<Template>();
    public DbSet<TemplateFieldRule> TemplateFieldRules => Set<TemplateFieldRule>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        modelBuilder.Entity<Document>(entity =>
        {
            entity.HasKey(d => d.Id);
            entity.Property(d => d.OriginalFileName).HasMaxLength(512).IsRequired();
            entity.Property(d => d.StoragePath).HasMaxLength(1024).IsRequired();
            entity.Property(d => d.ModelId).HasMaxLength(128).IsRequired();
            entity.Property(d => d.Status).HasConversion<int>();
            entity.HasIndex(d => d.CreatedAt);
            entity.HasIndex(d => d.TemplateId);

            // Matching a document to a template is a soft link; deleting a
            // template must not cascade-delete its matched documents.
            entity.HasOne(d => d.Template)
                  .WithMany()
                  .HasForeignKey(d => d.TemplateId)
                  .OnDelete(DeleteBehavior.SetNull);
        });

        modelBuilder.Entity<ExtractedField>(entity =>
        {
            entity.HasKey(f => f.Id);
            entity.Property(f => f.Name).HasMaxLength(256).IsRequired();
            entity.Property(f => f.DataType).HasMaxLength(64).IsRequired();

            entity.HasOne(f => f.Document)
                  .WithMany(d => d.ExtractedFields)
                  .HasForeignKey(f => f.DocumentId)
                  .OnDelete(DeleteBehavior.Cascade);

            entity.HasIndex(f => new { f.DocumentId, f.Name });
        });

        modelBuilder.Entity<Template>(entity =>
        {
            entity.HasKey(t => t.Id);
            entity.Property(t => t.Name).HasMaxLength(256).IsRequired();
            entity.Property(t => t.Kind).HasMaxLength(64).IsRequired();
            entity.Property(t => t.Description).HasMaxLength(2048);
            entity.Property(t => t.ApplyTo).HasMaxLength(32).IsRequired();
            entity.Property(t => t.VendorHint).HasMaxLength(512);
            entity.HasIndex(t => t.CreatedAt);
            entity.HasIndex(t => t.VendorHint);
        });

        modelBuilder.Entity<TemplateFieldRule>(entity =>
        {
            entity.HasKey(r => r.Id);
            entity.Property(r => r.Name).HasMaxLength(256).IsRequired();
            entity.Property(r => r.DataType).HasMaxLength(64).IsRequired();

            entity.HasOne(r => r.Template)
                  .WithMany(t => t.Rules)
                  .HasForeignKey(r => r.TemplateId)
                  .OnDelete(DeleteBehavior.Cascade);

            entity.HasIndex(r => new { r.TemplateId, r.Name });
        });
    }
}
