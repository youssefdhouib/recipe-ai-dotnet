// TypeScript mirrors of the API DTOs (api/RecipeAi.Api/Dtos).

export type Difficulty = 'Easy' | 'Medium' | 'Hard';
export const DIFFICULTIES: Difficulty[] = ['Easy', 'Medium', 'Hard'];

export interface User {
  id: string;
  email: string;
  fullName: string;
  roles: string[];
}

export interface AuthResponse {
  token: string;
  expiresAt: string;
  user: User;
}

export interface PagedResult<T> {
  items: T[];
  page: number;
  pageSize: number;
  totalCount: number;
}

export interface RecipeListItem {
  id: number;
  name: string;
  description: string;
  categoryName: string;
  difficulty: Difficulty;
  prepMinutes: number;
  cookMinutes: number;
  imagePath: string | null;
  averageRating: number;
  reviewCount: number;
  authorName: string;
  isHidden: boolean;
}

export interface RecipeDetails extends RecipeListItem {
  ingredients: string;
  portions: number;
  categoryId: number;
  authorId: string;
  createdOn: string;
}

export interface SaveRecipe {
  name: string;
  description: string;
  ingredients: string;
  prepMinutes: number;
  cookMinutes: number;
  portions: number;
  difficulty: Difficulty;
  categoryId: number;
}

export interface RecipeQuery {
  search?: string;
  categoryId?: number | null;
  difficulty?: Difficulty | null;
  maxMinutes?: number | null;
  sort?: 'Newest' | 'TopRated' | 'Quickest';
  page?: number;
  pageSize?: number;
}

export interface Category {
  id: number;
  name: string;
  description: string;
  recipeCount: number;
  coverImage: string | null;
}

export interface PublicStats {
  recipes: number;
  reviews: number;
  members: number;
  categories: number;
}

export type ReviewSort = 'Newest' | 'Helpful' | 'Highest' | 'Lowest';

export interface Reply {
  id: number;
  parentId: number | null;
  content: string;
  userId: string;
  userName: string;
  isRecipeAuthor: boolean;
  createdOn: string;
  isHidden: boolean;
}

export interface Review {
  id: number;
  title: string;
  rating: number;
  comment: string;
  userId: string;
  userName: string;
  createdOn: string;
  modifiedOn: string | null;
  isHidden: boolean;
  helpfulCount: number;
  votedByMe: boolean;
  replies: Reply[];
}

// distribution[0] = number of 5-star reviews ... distribution[4] = 1-star.
export interface RatingSummary { average: number; count: number; distribution: number[]; }

export interface RecipeReviews { summary: RatingSummary; reviews: Review[]; }

export interface SaveReview { title: string; rating: number; comment: string; }

export interface AppNotification {
  id: number;
  text: string;
  link: string;
  isRead: boolean;
  createdOn: string;
}

export interface SuggestionRequest {
  ingredients: string[];
  categoryId?: number | null;
  difficulty?: Difficulty | null;
}

export interface SuggestedRecipe {
  id: number;
  name: string;
  categoryName: string;
  difficulty: Difficulty;
  imagePath: string | null;
  score: number;
  reason: string;
  matched: string[];
  missing: string[];
  extra: string[];
}

export interface RecipeIdea {
  name: string;
  description: string;
  ingredients: string[];
  steps: string;
}

export interface SuggestionResponse {
  normalizedIngredients: string[];
  recipes: SuggestedRecipe[];
  ideas: RecipeIdea[];
  aiAvailable: boolean;
  provider: string;
  messages: string[];
}

// Shape of the API's ProblemDetails errors.
export interface ApiProblem {
  title?: string;
  status?: number;
  errors?: Record<string, string[]>;
}

export type Sex = 'Male' | 'Female';
export type ActivityLevel = 'Sedentary' | 'Light' | 'Moderate' | 'Active' | 'VeryActive';
export type Goal = 'Lose' | 'Maintain' | 'Gain';

export interface CalorieRequest {
  sex: Sex;
  age: number;
  weightKg: number;
  heightCm: number;
  activity: ActivityLevel;
  goal: Goal;
}

export interface Macro {
  name: string;
  grams: number;
  calories: number;
  percent: number;
}

export interface CalorieResult {
  bmr: number;
  maintenance: number;
  target: number;
  perMeal: number;
  macros: Macro[];
  explanation: string;
}

export interface CountItem { label: string; count: number; }
export interface DailyCount { date: string; count: number; }
export interface TopRecipe { id: number; name: string; averageRating: number; reviewCount: number; }
export interface AiStepLatency { step: string; averageMs: number; calls: number; }
export interface AiUsage { calls: number; failed: number; successRate: number; averageMs: number; steps: AiStepLatency[]; }

export interface Trend { label: string; total: number; last7Days: number; previous7Days: number; }
export interface ModerationCounts { hiddenRecipes: number; hiddenReviews: number; hiddenReplies: number; lowRatingsThisWeek: number; bannedUsers: number; }
export interface Activity { kind: 'user' | 'recipe' | 'review'; text: string; link: string; createdOn: string; }

export interface AdminStats {
  trends: Trend[];
  favorites: number;
  moderation: ModerationCounts;
  recipesPerCategory: CountItem[];
  reviewsPerDay: DailyCount[];
  signupsPerDay: DailyCount[];
  topRecipes: TopRecipe[];
  aiUsage: AiUsage;
  recentActivity: Activity[];
}

// ----- Admin tables -----
export interface AdminListQuery { search?: string; status?: string; page?: number; pageSize?: number; }

export interface AdminRecipe {
  id: number; name: string; categoryName: string; authorName: string; imagePath: string | null;
  isHidden: boolean; reviewCount: number; averageRating: number | null; favorites: number; createdOn: string;
}

export interface AdminReview {
  id: number; title: string; rating: number; comment: string; recipeId: number; recipeName: string; userName: string;
  createdOn: string; isHidden: boolean; helpfulCount: number; replyCount: number; hiddenReplyCount: number;
}

export interface AdminReviewDetails { review: AdminReview; replies: Reply[]; }

export interface AdminUser {
  id: string; fullName: string; email: string; isAdmin: boolean; isBanned: boolean; isMe: boolean;
  createdOn: string; recipes: number; reviews: number; replies: number;
}

export interface AiDay { date: string; succeeded: number; failed: number; }
export interface AiCall { id: number; createdOn: string; step: string; provider: string; durationMs: number; success: boolean; }
export interface AiMonitor { days: number; usage: AiUsage; perDay: AiDay[]; recent: AiCall[]; }
