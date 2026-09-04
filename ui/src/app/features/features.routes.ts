import { Routes } from '@angular/router';

/**
 * Lazy-loaded feature modules. Each module owns its URL namespace and page chunks.
 */
export const FEATURE_ROUTES: Routes = [
  { path: 'monitor', loadChildren: () => import('./monitor/monitor.routes').then(m => m.MONITOR_ROUTES) },
  { path: 'operations', loadChildren: () => import('./operations/operations.routes').then(m => m.OPERATIONS_ROUTES) },
  { path: 'infrastructure', loadChildren: () => import('./infrastructure/infrastructure.routes').then(m => m.INFRASTRUCTURE_ROUTES) },
  { path: 'cost-analytics', loadChildren: () => import('./cost-analytics/cost-analytics.routes').then(m => m.COST_ANALYTICS_ROUTES) },
  { path: 'intelligence', loadChildren: () => import('./intelligence/intelligence.routes').then(m => m.INTELLIGENCE_ROUTES) },
];
