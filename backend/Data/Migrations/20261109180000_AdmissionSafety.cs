using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;
namespace SchoolAdmission.Api.Data.Migrations;

[DbContext(typeof(AppDbContext))]
[Migration("20261109180000_AdmissionSafety")]
public partial class AdmissionSafety : Migration
{
    protected override void Up(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.Sql("UPDATE holds SET status = 'EXPIRED' WHERE status = 'HELD' AND expires_at_utc <= clock_timestamp()");
        migrationBuilder.AddCheckConstraint("ck_classes_positive_seats", "classes", "total_seats > 0");
        migrationBuilder.AddCheckConstraint("ck_holds_student_id", "holds", "student_id ~ '^[0-9]{17}$'");
        migrationBuilder.AddCheckConstraint("ck_holds_status", "holds", "status IN ('HELD', 'CONFIRMED', 'EXPIRED', 'CANCELLED')");
        migrationBuilder.AddCheckConstraint("ck_holds_expiry", "holds", "expires_at_utc > created_at_utc");
        migrationBuilder.AddCheckConstraint("ck_holds_confirmation", "holds", "status <> 'CONFIRMED' OR confirmed_at_utc IS NOT NULL");
        migrationBuilder.CreateIndex("ix_holds_active_student", "holds", new[] { "class_id", "student_id" }, unique: true, filter: "status IN ('HELD', 'CONFIRMED')");
        migrationBuilder.CreateIndex("ix_holds_expiry", "holds", "expires_at_utc", filter: "status = 'HELD'");
        migrationBuilder.CreateIndex("ix_holds_student_history", "holds", new[] { "student_id", "created_at_utc" });
    }
    protected override void Down(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.DropIndex("ix_holds_active_student", "holds");
        migrationBuilder.DropIndex("ix_holds_expiry", "holds");
        migrationBuilder.DropIndex("ix_holds_student_history", "holds");
        migrationBuilder.DropCheckConstraint("ck_classes_positive_seats", "classes");
        foreach (var name in new[] { "ck_holds_student_id", "ck_holds_status", "ck_holds_expiry", "ck_holds_confirmation" })
            migrationBuilder.DropCheckConstraint(name, "holds");
    }
}
