using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace RecipeAi.Api.Data.Migrations
{
    /// <inheritdoc />
    public partial class ReviewEditedOn : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<DateTime>(
                name: "EditedOn",
                table: "Reviews",
                type: "datetime2",
                nullable: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "EditedOn",
                table: "Reviews");
        }
    }
}
