using RecipeAi.Api.Ai;

namespace RecipeAi.Api.Tests;

public class IngredientTextTests
{
    [Theory]
    [InlineData("200g spaghetti", "spaghetti")]
    [InlineData("3 cloves of garlic", "garlic")]
    [InlineData("2 ripe Tomatoes", "tomato")]
    [InlineData("1 cup green peas", "green pea")]
    public void Normalize_removes_quantities_descriptors_and_plurals(string raw, string expected)
    {
        Assert.Equal(expected, IngredientText.Normalize(raw));
    }

    [Fact]
    public void Split_turns_a_recipe_ingredient_text_into_a_clean_list()
    {
        var result = IngredientText.Split("2 carrots, 1 onion, 2 potatoes peeled and cubed").ToList();

        Assert.Equal(new[] { "carrot", "onion", "potato" }, result);
    }

    [Fact]
    public void Matches_handles_partial_names()
    {
        Assert.True(IngredientText.Matches("chicken", "chicken breast"));
        Assert.False(IngredientText.Matches("beef", "chicken breast"));
    }
}
