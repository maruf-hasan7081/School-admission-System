using Microsoft.EntityFrameworkCore;
using SchoolAdmission.Api.Data.Entities;

namespace SchoolAdmission.Api.Data;

public class AppDbContext(DbContextOptions<AppDbContext> options) : DbContext(options)
{
    public DbSet<AdmissionClass> Classes => Set<AdmissionClass>();
    public DbSet<Hold> Holds => Set<Hold>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        modelBuilder.Entity<AdmissionClass>(e =>
        {
            e.ToTable("classes");
            e.HasKey(x => x.Id);
            e.Property(x => x.Name).HasMaxLength(256).IsRequired();
        });

        modelBuilder.Entity<Hold>(e =>
        {
            e.ToTable("holds");
            e.HasKey(x => x.Id);
            e.Property(x => x.StudentId).HasMaxLength(17).IsRequired();
            e.Property(x => x.Status).HasMaxLength(16).IsRequired();
            e.HasOne(x => x.Class).WithMany(x => x.Holds).HasForeignKey(x => x.ClassId);
            e.HasIndex(x => new { x.ClassId, x.StudentId });
        });
    }
}
