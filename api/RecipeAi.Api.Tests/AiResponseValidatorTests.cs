using RecipeAi.Api.Ai;

namespace RecipeAi.Api.Tests;

// The validator is the safety layer between the LLM and the app: these tests feed it bad model output.
public class AiResponseValidatorTests
{
    private static readonly int[] AllowedIds = { 1, 2, 3 };

    [Fact]
    public void Ranking_drops_ids_that_were_not_sent_to_the_model()
    {
        const string json = """{"recipes":[{"id":1,"score":80},{"id":999,"score":95}]}""";

        var result = AiResponseValidator.ParseRanking(json, AllowedIds);

        Assert.NotNull(result);
        Assert.Single(result);
        Assert.Equal(1, result[0].RecipeId);
    }

    [Theory]
    [InlineData(150, 100)]
    [InlineData(-20, 0)]
    [InlineData(55, 55)]
    public void Ranking_clamps_scores_between_0_and_100(int modelScore, int expected)
    {
        var json = $$"""{"recipes":[{"id":2,"score":{{modelScore}}}]}""";

        var result = AiResponseValidator.ParseRanking(json, AllowedIds);

        Assert.Equal(expected, result![0].Score);
    }

    [Fact]
    public void Ranking_accepts_scores_sent_as_strings_or_decimals_and_sorts_by_score()
    {
        const string json = """{"recipes":[{"id":1,"score":"40"},{"id":2,"score":91.6}]}""";

        var result = AiResponseValidator.ParseRanking(json, AllowedIds)!;

        Assert.Equal(new[] { 2, 1 }, result.Select(r => r.RecipeId));
        Assert.Equal(92, result[0].Score);
    }

    [Fact]
    public void Ranking_ignores_duplicate_ids()
    {
        const string json = """{"recipes":[{"id":3,"score":70},{"id":3,"score":10}]}""";

        var result = AiResponseValidator.ParseRanking(json, AllowedIds)!;

        Assert.Single(result);
        Assert.Equal(70, result[0].Score);
    }

    [Theory]
    [InlineData(null)]
    [InlineData("")]
    [InlineData("Sorry, I cannot help with that.")]
    [InlineData("""{"something":"else"}""")]
    [InlineData("""{"recipes": "not an array"}""")]
    public void Ranking_returns_null_for_unusable_answers(string? json)
    {
        Assert.Null(AiResponseValidator.ParseRanking(json, AllowedIds));
    }

    [Fact]
    public void Ingredients_are_read_even_inside_markdown_code_fences()
    {
        const string json = "```json\n{\"ingredients\": [\"Tomato\", \"onion\", \"tomato\", \"\"]}\n```";

        var result = AiResponseValidator.ParseIngredients(json);

        Assert.Equal(new[] { "tomato", "onion" }, result);
    }

    [Fact]
    public void Ingredients_return_null_when_empty()
    {
        Assert.Null(AiResponseValidator.ParseIngredients("""{"ingredients":[]}"""));
    }

    [Fact]
    public void Ideas_keep_at_most_three_and_skip_nameless_ones()
    {
        const string json = """
            {"ideas":[{"name":"A"},{"name":""},{"name":"B"},{"name":"C"},{"name":"D"}]}
            """;

        var result = AiResponseValidator.ParseIdeas(json);

        Assert.Equal(new[] { "A", "B", "C" }, result.Select(i => i.Name));
    }
}
