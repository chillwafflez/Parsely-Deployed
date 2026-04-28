using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace DocParsing.Api.Migrations
{
    /// <inheritdoc />
    public partial class Add_ExtractedTable_Source_And_Name : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "Name",
                table: "ExtractedTables",
                type: "nvarchar(512)",
                maxLength: 512,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "Source",
                table: "ExtractedTables",
                type: "nvarchar(32)",
                maxLength: 32,
                nullable: false,
                defaultValue: "Layout");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "Name",
                table: "ExtractedTables");

            migrationBuilder.DropColumn(
                name: "Source",
                table: "ExtractedTables");
        }
    }
}
