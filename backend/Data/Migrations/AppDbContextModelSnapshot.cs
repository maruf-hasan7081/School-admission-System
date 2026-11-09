using System;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Infrastructure;
using SchoolAdmission.Api.Data.Entities;

#nullable disable

namespace SchoolAdmission.Api.Data.Migrations;

[DbContext(typeof(AppDbContext))]
partial class AppDbContextModelSnapshot : ModelSnapshot
{
    protected override void BuildModel(ModelBuilder modelBuilder)
    {
#pragma warning disable 612, 618
        modelBuilder.HasAnnotation("ProductVersion", "8.0.11");

        modelBuilder.Entity("SchoolAdmission.Api.Data.Entities.AdmissionClass", b =>
        {
            b.Property<string>("Id")
                .HasColumnType("text")
                .HasColumnName("id");

            b.Property<string>("Name")
                .IsRequired()
                .HasMaxLength(256)
                .HasColumnType("character varying(256)")
                .HasColumnName("name");

            b.Property<int>("TotalSeats")
                .HasColumnType("integer")
                .HasColumnName("total_seats");

            b.HasKey("Id")
                .HasName("pk_classes");

            b.ToTable("classes", (string)null, t => t.HasCheckConstraint("ck_classes_positive_seats", "total_seats > 0"));
        });

        modelBuilder.Entity("SchoolAdmission.Api.Data.Entities.Hold", b =>
        {
            b.Property<string>("Id")
                .HasColumnType("text")
                .HasColumnName("id");

            b.Property<string>("ClassId")
                .IsRequired()
                .HasColumnType("text")
                .HasColumnName("class_id");

            b.Property<DateTime?>("ConfirmedAtUtc")
                .HasColumnType("timestamp with time zone")
                .HasColumnName("confirmed_at_utc");

            b.Property<DateTime>("CreatedAtUtc")
                .HasColumnType("timestamp with time zone")
                .HasColumnName("created_at_utc");

            b.Property<DateTime>("ExpiresAtUtc")
                .HasColumnType("timestamp with time zone")
                .HasColumnName("expires_at_utc");

            b.Property<string>("Status")
                .IsRequired()
                .HasMaxLength(16)
                .HasColumnType("character varying(16)")
                .HasColumnName("status");

            b.Property<string>("StudentId")
                .IsRequired()
                .HasMaxLength(17)
                .HasColumnType("character varying(17)")
                .HasColumnName("student_id");

            b.HasKey("Id")
                .HasName("pk_holds");

            b.HasIndex("ClassId", "StudentId")
                .HasDatabaseName("ix_holds_class_id_student_id");

            b.HasIndex(new[] { "ClassId", "StudentId" }, "ActiveStudent")
                .IsUnique().HasDatabaseName("ix_holds_active_student").HasFilter("status IN ('HELD', 'CONFIRMED')");
            b.HasIndex("ExpiresAtUtc").HasDatabaseName("ix_holds_expiry").HasFilter("status = 'HELD'");
            b.HasIndex("StudentId", "CreatedAtUtc").HasDatabaseName("ix_holds_student_history");
            b.ToTable("holds", (string)null, t => {
                t.HasCheckConstraint("ck_holds_student_id", "student_id ~ '^[0-9]{17}$'");
                t.HasCheckConstraint("ck_holds_status", "status IN ('HELD', 'CONFIRMED', 'EXPIRED', 'CANCELLED')");
                t.HasCheckConstraint("ck_holds_expiry", "expires_at_utc > created_at_utc");
                t.HasCheckConstraint("ck_holds_confirmation", "status <> 'CONFIRMED' OR confirmed_at_utc IS NOT NULL");
            });
        });

        modelBuilder.Entity("SchoolAdmission.Api.Data.Entities.Hold", b =>
        {
            b.HasOne("SchoolAdmission.Api.Data.Entities.AdmissionClass", "Class")
                .WithMany("Holds")
                .HasForeignKey("ClassId")
                .OnDelete(DeleteBehavior.Cascade)
                .IsRequired()
                .HasConstraintName("fk_holds_classes_class_id");

            b.Navigation("Class");
        });

        modelBuilder.Entity("SchoolAdmission.Api.Data.Entities.AdmissionClass", b =>
        {
            b.Navigation("Holds");
        });
#pragma warning restore 612, 618
    }
}
