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
  { path: 'admin', canActivate: [adminGuard], loadComponent: () => import('./pages/admin.component').then(m => m.AdminComponent), title: 'Admin' },
  { path: 'login', loadComponent: () => import('./pages/auth.component').then(m => m.AuthComponent), data: { mode: 'login' }, title: 'Login' },
  { path: 'register', loadComponent: () => import('./pages/auth.component').then(m => m.AuthComponent), data: { mode: 'register' }, title: 'Register' },
  { path: '**', redirectTo: '' },
];
