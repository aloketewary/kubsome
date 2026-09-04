import { Routes } from '@angular/router';

export const routes: Routes = [
  { path: '', redirectTo: 'monitor/dashboard', pathMatch: 'full' },
  {
    path: '',
    loadChildren: () => import('./features/features.routes').then(m => m.FEATURE_ROUTES),
  },
];
