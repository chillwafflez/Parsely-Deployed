using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace DocParsing.Api.Migrations
{
    /// <inheritdoc />
    public partial class Add_Template_ModelId : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "ModelId",
                table: "Templates",
                type: "nvarchar(128)",
                maxLength: 128,
                nullable: false,
                defaultValue: "prebuilt-invoice");

            migrationBuilder.CreateIndex(
                name: "IX_Templates_ModelId",
                table: "Templates",
                column: "ModelId");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_Templates_ModelId",
                table: "Templates");

            migrationBuilder.DropColumn(
                name: "ModelId",
                table: "Templates");
        }
    }
}
