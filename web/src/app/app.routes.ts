import { Routes } from '@angular/router';
import { adminGuard, authGuard } from './core/guards';

// Lazy loading: each page's code is downloaded only when the user opens it.
export const routes: Routes = [
  { path: '', loadComponent: () => import('./pages/recipe-list.component').then(m => m.RecipeListComponent), title: 'Recipes' },
  { path: 'suggest', loadComponent: () => import('./pages/suggest.component').then(m => m.SuggestComponent), title: 'AI Suggest' },
  { path: 'calories', loadComponent: () => import('./pages/calories.component').then(m => m.CaloriesComponent), title: 'Calorie calculator' },
  { path: 'recipes/new', canActivate: [authGuard], loadComponent: () => import('./pages/recipe-form.component').then(m => m.RecipeFormComponent), title: 'New recipe' },
  { path: 'recipes/:id/edit', canActivate: [authGuard], loadComponent: () => import('./pages/recipe-form.component').then(m => m.RecipeFormComponent), title: 'Edit recipe' },
  { path: 'recipes/:id', loadComponent: () => import('./pages/recipe-detail.component').then(m => m.RecipeDetailComponent), title: 'Recipe' },
  { path: 'favorites', canActivate: [authGuard], loadComponent: () => import('./pages/favorites.component').then(m => m.FavoritesComponent), title: 'Favorites' },
  { path: 'notifications', canActivate: [authGuard], loadComponent: () => import('./pages/notifications.component').then(m => m.NotificationsComponent), title: 'Notifications' },
  {
    path: 'admin',
    canActivate: [adminGuard],
    loadComponent: () => import('./pages/admin/admin-layout.component').then(m => m.AdminLayoutComponent),
    children: [
      { path: '', loadComponent: () => import('./pages/admin/admin-dashboard.component').then(m => m.AdminDashboardComponent), title: 'Admin · Dashboard' },
      { path: 'recipes', loadComponent: () => import('./pages/admin/admin-recipes.component').then(m => m.AdminRecipesComponent), title: 'Admin · Recipes' },
      { path: 'reviews', loadComponent: () => import('./pages/admin/admin-reviews.component').then(m => m.AdminReviewsComponent), title: 'Admin · Reviews' },
      { path: 'users', loadComponent: () => import('./pages/admin/admin-users.component').then(m => m.AdminUsersComponent), title: 'Admin · Users' },
      { path: 'categories', loadComponent: () => import('./pages/admin/admin-categories.component').then(m => m.AdminCategoriesComponent), title: 'Admin · Categories' },
      { path: 'ai', loadComponent: () => import('./pages/admin/admin-ai.component').then(m => m.AdminAiComponent), title: 'Admin · AI monitor' },
    ],
  },
  { path: 'login', loadComponent: () => import('./pages/auth.component').then(m => m.AuthComponent), data: { mode: 'login' }, title: 'Login' },
  { path: 'register', loadComponent: () => import('./pages/auth.component').then(m => m.AuthComponent), data: { mode: 'register' }, title: 'Register' },
  { path: '**', redirectTo: '' },
];
