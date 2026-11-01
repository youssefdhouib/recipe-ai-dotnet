namespace RecipeAi.Api.Models;

// Every table has an Id and audit dates. AppDbContext fills the dates automatically.
public abstract class BaseEntity
{
    public int Id { get; set; }

    public DateTime CreatedOn { get; set; }

    public DateTime? ModifiedOn { get; set; }
}
