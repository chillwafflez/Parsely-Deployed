using DocParsing.Api.Models;
using Microsoft.EntityFrameworkCore;

namespace DocParsing.Api.Data;

public class AppDbContext(DbContextOptions<AppDbContext> options) : DbContext(options)
{
    public DbSet<Document> Documents => Set<Document>();
    public DbSet<ExtractedField> ExtractedFields => Set<ExtractedField>();

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
    }
}
