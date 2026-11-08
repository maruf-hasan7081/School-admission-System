using System;
using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;
using SchoolAdmission.Api.Data;

#nullable disable

namespace SchoolAdmission.Api.Data.Migrations;

[DbContext(typeof(AppDbContext))]
[Migration("20261108160000_InitialCreate")]
public partial class InitialCreate : Migration
{
    protected override void Up(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.CreateTable(
            name: "classes",
            columns: table => new
            {
                id = table.Column<string>(type: "text", nullable: false),
                name = table.Column<string>(type: "character varying(256)", maxLength: 256, nullable: false),
                total_seats = table.Column<int>(type: "integer", nullable: false)
            },
            constraints: table => table.PrimaryKey("pk_classes", x => x.id));

        migrationBuilder.CreateTable(
            name: "holds",
            columns: table => new
            {
                id = table.Column<string>(type: "text", nullable: false),
                class_id = table.Column<string>(type: "text", nullable: false),
                student_id = table.Column<string>(type: "character varying(17)", maxLength: 17, nullable: false),
                status = table.Column<string>(type: "character varying(16)", maxLength: 16, nullable: false),
                created_at_utc = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                expires_at_utc = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                confirmed_at_utc = table.Column<DateTime>(type: "timestamp with time zone", nullable: true)
            },
            constraints: table =>
            {
                table.PrimaryKey("pk_holds", x => x.id);
                table.ForeignKey(
                    name: "fk_holds_classes_class_id",
                    column: x => x.class_id,
                    principalTable: "classes",
                    principalColumn: "id",
                    onDelete: ReferentialAction.Cascade);
            });

        migrationBuilder.CreateIndex(
            name: "ix_holds_class_id_student_id",
            table: "holds",
            columns: new[] { "class_id", "student_id" });
    }

    protected override void Down(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.DropTable(name: "holds");
        migrationBuilder.DropTable(name: "classes");
    }
}
