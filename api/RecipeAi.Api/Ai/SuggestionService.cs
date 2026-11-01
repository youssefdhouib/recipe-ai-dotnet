using System.Diagnostics;
using Microsoft.EntityFrameworkCore;
using RecipeAi.Api.Data;
using RecipeAi.Api.Dtos;

namespace RecipeAi.Api.Ai;

// The AI pipeline. It never throws because of the AI: if any AI step fails,
// the user still gets results from the keyword fallback, with AiAvailable = false.
public class SuggestionService
{
    public const int MaxCandidates = 25;
    public const int IdeasThreshold = 40;

    private readonly AppDbContext _db;
    private readonly IAiProvider _ai;
    private readonly ILogger<SuggestionService> _logger;

    public SuggestionService(AppDbContext db, IAiProvider ai, ILogger<SuggestionService> logger)
    {
        _db = db;
        _ai = ai;
        _logger = logger;
    }

    public async Task<SuggestionResponseDto> SuggestAsync(SuggestionRequestDto request, CancellationToken cancellationToken = default)
    {
        var messages = new List<string>();

        // Step 1 - clean the user input (trim, remove duplicates, case-insensitive).
        var cleaned = request.Ingredients
            .Select(i => i.Trim())
            .Where(i => i.Length > 0)
            .Distinct(StringComparer.OrdinalIgnoreCase)
            .ToList();

        // Step 2 - candidates from OUR database (visible recipes only, with the filters).
        var query = _db.Recipes.AsNoTracking().Where(r => !r.IsHidden);
        if (request.CategoryId is not null)
        {
            query = query.Where(r => r.CategoryId == request.CategoryId);
        }

        if (request.Difficulty is not null)
        {
            query = query.Where(r => r.Difficulty == request.Difficulty);
        }

        var candidates = await query
            .OrderByDescending(r => r.Reviews.Where(v => !v.IsHidden).Select(v => (double?)v.Rating).Average() ?? 0)
            .ThenByDescending(r => r.CreatedOn)
            .Take(MaxCandidates)
            .Select(r => new
            {
                r.Id,
                r.Name,
                r.Ingredients,
                CategoryName = r.Category.Name,
                r.Difficulty,
                r.ImagePath,
            })
            .ToListAsync(cancellationToken);

        // Step 3 - normalise the ingredients with the AI ("3 Tomatoes" -> "tomato").
        var normalized = AiResponseValidator.ParseIngredients(
            await TryAiAsync("normalize", ct => _ai.NormalizeIngredientsAsync(cleaned, ct), cancellationToken));
        var aiAvailable = normalized is not null;
        normalized ??= cleaned.Select(IngredientText.Normalize).Where(i => i.Length > 0).Distinct().ToList();

        if (candidates.Count == 0)
        {
            messages.Add("No recipe in the database matches the selected filters.");
            return new SuggestionResponseDto(normalized, new(), new(), aiAvailable, _ai.Name, messages);
        }

        // Step 4 - let the AI rank OUR candidates, then validate its answer.
        List<RankedMatch>? ranking = null;
        if (aiAvailable)
        {
            var aiCandidates = candidates.Select(c => new CandidateRecipe(c.Id, c.Name, c.Ingredients)).ToList();
            ranking = AiResponseValidator.ParseRanking(
                await TryAiAsync("rank", ct => _ai.RankRecipesAsync(normalized, aiCandidates, ct), cancellationToken),
                candidates.Select(c => c.Id).ToList());
            aiAvailable = ranking is not null;
        }

        // Step 6 (fallback) - AI down or unusable: keyword scoring so the user always gets an answer.
        if (ranking is null)
        {
            messages.Add("The AI is unavailable right now: results are based on keyword matching.");
            ranking = KeywordRank(normalized, candidates.Select(c => (c.Id, c.Ingredients)));
        }

        // Step 5 - build the response. Names, images and categories come from OUR data, never from the AI.
        var byId = candidates.ToDictionary(c => c.Id);
        var recipes = ranking
            .Where(r => r.Score > 0)
            .Select(r =>
            {
                var c = byId[r.RecipeId];
                return new SuggestedRecipeDto(c.Id, c.Name, c.CategoryName, c.Difficulty, c.ImagePath,
                    r.Score, r.Reason, r.Matched, r.Missing, r.Extra);
            })
            .ToList();

        // Weak matches -> ask the AI for new recipe ideas.
        var ideas = new List<RecipeIdea>();
        var bestScore = recipes.Count > 0 ? recipes[0].Score : 0;
        if (aiAvailable && bestScore < IdeasThreshold)
        {
            ideas = AiResponseValidator.ParseIdeas(
                await TryAiAsync("ideas", ct => _ai.GenerateIdeasAsync(normalized, ct), cancellationToken));
            if (ideas.Count > 0)
            {
                messages.Add("No strong match in our recipes, so here are some AI ideas.");
            }
        }

        return new SuggestionResponseDto(normalized, recipes, ideas, aiAvailable, _ai.Name, messages);
    }

    // Public + static so it can be unit-tested on its own.
    public static List<RankedMatch> KeywordRank(IReadOnlyList<string> userIngredients, IEnumerable<(int Id, string Ingredients)> recipes) =>
        recipes.Select(r =>
            {
                var recipeIngredients = IngredientText.Split(r.Ingredients).ToList();
                var matched = recipeIngredients.Where(ri => userIngredients.Any(u => IngredientText.Matches(u, ri))).ToList();
                var score = recipeIngredients.Count == 0 ? 0 : (int)Math.Round(100.0 * matched.Count / recipeIngredients.Count);
                return new RankedMatch(r.Id, score, matched, recipeIngredients.Except(matched).ToList(), new List<string>(),
                    "Keyword match (AI unavailable).");
            })
            .OrderByDescending(m => m.Score)
            .ToList();

    // Runs one AI call, measures it, logs it, and turns any failure into null (= "AI unavailable").
    private async Task<string?> TryAiAsync(string step, Func<CancellationToken, Task<string>> call, CancellationToken cancellationToken)
    {
        var watch = Stopwatch.StartNew();
        try
        {
            var result = await call(cancellationToken);
            _logger.LogInformation("AI {Step} via {Provider} succeeded in {ElapsedMs} ms", step, _ai.Name, watch.ElapsedMilliseconds);
            return result;
        }
        catch (Exception ex) when (ex is not OperationCanceledException || !cancellationToken.IsCancellationRequested)
        {
            _logger.LogWarning(ex, "AI {Step} via {Provider} failed after {ElapsedMs} ms", step, _ai.Name, watch.ElapsedMilliseconds);
            return null;
        }
    }
}
