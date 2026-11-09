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
            e.ToTable("classes", t => t.HasCheckConstraint("ck_classes_positive_seats", "total_seats > 0"));
            e.HasKey(x => x.Id).HasName("pk_classes");
            e.Property(x => x.Id).HasColumnName("id");
            e.Property(x => x.Name).HasColumnName("name").HasMaxLength(256).IsRequired();
            e.Property(x => x.TotalSeats).HasColumnName("total_seats");
        });

        modelBuilder.Entity<Hold>(e =>
        {
            e.ToTable("holds", t => {
                t.HasCheckConstraint("ck_holds_student_id", "student_id ~ '^[0-9]{17}$'");
                t.HasCheckConstraint("ck_holds_status", "status IN ('HELD', 'CONFIRMED', 'EXPIRED', 'CANCELLED')");
                t.HasCheckConstraint("ck_holds_expiry", "expires_at_utc > created_at_utc");
                t.HasCheckConstraint("ck_holds_confirmation", "status <> 'CONFIRMED' OR confirmed_at_utc IS NOT NULL");
            });
            e.HasKey(x => x.Id).HasName("pk_holds");
            e.Property(x => x.Id).HasColumnName("id");
            e.Property(x => x.ClassId).HasColumnName("class_id");
            e.Property(x => x.StudentId).HasColumnName("student_id").HasMaxLength(17).IsRequired();
            e.Property(x => x.Status).HasColumnName("status").HasMaxLength(16).IsRequired();
            e.Property(x => x.CreatedAtUtc).HasColumnName("created_at_utc");
            e.Property(x => x.ExpiresAtUtc).HasColumnName("expires_at_utc");
            e.Property(x => x.ConfirmedAtUtc).HasColumnName("confirmed_at_utc");
            e.HasOne(x => x.Class).WithMany(x => x.Holds).HasForeignKey(x => x.ClassId).HasConstraintName("fk_holds_classes_class_id");
            e.HasIndex(x => new { x.ClassId, x.StudentId }).HasDatabaseName("ix_holds_class_id_student_id");
            e.HasIndex(x => new { x.ClassId, x.StudentId }, "ActiveStudent")
                .IsUnique().HasDatabaseName("ix_holds_active_student").HasFilter("status IN ('HELD', 'CONFIRMED')");
            e.HasIndex(x => x.ExpiresAtUtc).HasDatabaseName("ix_holds_expiry").HasFilter("status = 'HELD'");
            e.HasIndex(x => new { x.StudentId, x.CreatedAtUtc }).HasDatabaseName("ix_holds_student_history");
        });
    }
}
