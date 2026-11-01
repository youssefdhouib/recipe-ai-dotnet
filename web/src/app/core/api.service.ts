import { HttpClient, HttpErrorResponse, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { environment } from '../../environments/environment';
import {
  ApiProblem, AppNotification, CalorieRequest, CalorieResult, PublicStats, Category, PagedResult, RecipeDetails, RecipeListItem, RecipeQuery, Review,
  SaveRecipe, SuggestionRequest, SuggestionResponse,
} from './models';

// One typed service for every API endpoint (the Angular equivalent of a client SDK).
@Injectable({ providedIn: 'root' })
export class ApiService {
  private readonly http = inject(HttpClient);
  private readonly url = environment.apiUrl;

  // ----- Recipes -----
  getRecipes(query: RecipeQuery) {
    let params = new HttpParams();
    Object.entries(query).forEach(([key, value]) => {
      if (value !== null && value !== undefined && value !== '') params = params.set(key, String(value));
    });
    return this.http.get<PagedResult<RecipeListItem>>(`${this.url}/recipes`, { params });
  }

  getRecipe(id: number) {
    return this.http.get<RecipeDetails>(`${this.url}/recipes/${id}`);
  }

  createRecipe(body: SaveRecipe) {
    return this.http.post<RecipeDetails>(`${this.url}/recipes`, body);
  }

  updateRecipe(id: number, body: SaveRecipe) {
    return this.http.put<RecipeDetails>(`${this.url}/recipes/${id}`, body);
  }

  deleteRecipe(id: number) {
    return this.http.delete<void>(`${this.url}/recipes/${id}`);
  }

  uploadImage(id: number, file: File) {
    const form = new FormData();
    form.append('file', file);
    return this.http.post<RecipeDetails>(`${this.url}/recipes/${id}/image`, form);
  }

  // ----- Categories -----
  getCategories() {
    return this.http.get<Category[]>(`${this.url}/categories`);
  }

  createCategory(body: { name: string; description: string }) {
    return this.http.post<Category>(`${this.url}/categories`, body);
  }

  updateCategory(id: number, body: { name: string; description: string }) {
    return this.http.put<Category>(`${this.url}/categories/${id}`, body);
  }

  deleteCategory(id: number) {
    return this.http.delete<void>(`${this.url}/categories/${id}`);
  }

  // ----- Reviews -----
  getReviews(recipeId: number) {
    return this.http.get<Review[]>(`${this.url}/recipes/${recipeId}/reviews`);
  }

  addReview(recipeId: number, body: { rating: number; comment: string }) {
    return this.http.post<Review>(`${this.url}/recipes/${recipeId}/reviews`, body);
  }

  // ----- Favorites -----
  getFavorites() {
    return this.http.get<RecipeListItem[]>(`${this.url}/favorites`);
  }

  addFavorite(recipeId: number) {
    return this.http.post<void>(`${this.url}/favorites/${recipeId}`, {});
  }

  removeFavorite(recipeId: number) {
    return this.http.delete<void>(`${this.url}/favorites/${recipeId}`);
  }

  // ----- Notifications -----
  getNotifications() {
    return this.http.get<AppNotification[]>(`${this.url}/notifications`);
  }

  getUnreadCount() {
    return this.http.get<{ count: number }>(`${this.url}/notifications/unread-count`);
  }

  markRead(id: number) {
    return this.http.post<void>(`${this.url}/notifications/${id}/read`, {});
  }

  markAllRead() {
    return this.http.post<void>(`${this.url}/notifications/read-all`, {});
  }

  deleteNotification(id: number) {
    return this.http.delete<void>(`${this.url}/notifications/${id}`);
  }

  // ----- AI -----
  suggest(body: SuggestionRequest) {
    return this.http.post<SuggestionResponse>(`${this.url}/suggestions`, body);
  }

  // ----- Stats -----
  getStats() {
    return this.http.get<PublicStats>(`${this.url}/stats`);
  }

  // ----- Calories -----
  calculateCalories(body: CalorieRequest) {
    return this.http.post<CalorieResult>(`${this.url}/calories`, body);
  }

  // ----- Admin -----
  setRecipeHidden(id: number, hidden: boolean) {
    return this.http.post<void>(`${this.url}/admin/recipes/${id}/${hidden ? 'hide' : 'unhide'}`, {});
  }

  setReviewHidden(id: number, hidden: boolean) {
    return this.http.post<void>(`${this.url}/admin/reviews/${id}/${hidden ? 'hide' : 'unhide'}`, {});
  }
}

// Turns an HttpErrorResponse (ProblemDetails) into one readable message for the UI.
export function errorMessage(error: unknown): string {
  if (error instanceof HttpErrorResponse) {
    if (error.status === 0) return 'Cannot reach the API. Is it running on port 5295?';
    if (error.status === 429) return 'Too many AI requests. Please wait a minute.';
    const problem = error.error as ApiProblem | null;
    if (problem?.errors) return Object.values(problem.errors).flat().join(' ');
    if (problem?.title) return problem.title;
  }
  return 'Something went wrong. Please try again.';
}

export function imageUrl(path: string | null | undefined): string | null {
  if (!path) return null;
  return path.startsWith('http') ? path : `${environment.fileBaseUrl}${path}`;
}
