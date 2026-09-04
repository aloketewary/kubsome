import { Routes } from '@angular/router';

export const COST_ANALYTICS_ROUTES: Routes = [
  { path: 'analytics', title: 'Analytics — Kubsome', loadComponent: () => import('../analytics/analytics').then(m => m.AnalyticsComponent) },
  { path: 'cost', title: 'Optimization — Kubsome', loadComponent: () => import('../cost/cost').then(m => m.CostComponent) },
  { path: 'cost-estimate', title: 'Cost Estimate — Kubsome', loadComponent: () => import('../cost-estimate/cost-estimate').then(m => m.CostEstimateComponent) },
  { path: 'rightsizing', title: 'Right-Sizing — Kubsome', loadComponent: () => import('../rightsizing/rightsizing').then(m => m.RightsizingComponent) },
  { path: 'stats', title: 'Usage Analytics — Kubsome', loadComponent: () => import('../stats/stats').then(m => m.StatsComponent) },
  { path: 'chargeback', title: 'Chargeback — Kubsome', loadComponent: () => import('../chargeback/chargeback').then(m => m.ChargebackComponent) },
  { path: 'idle-resources', title: 'Idle Resources — Kubsome', loadComponent: () => import('../idle-resources/idle-resources').then(m => m.IdleResourcesComponent) },
];
