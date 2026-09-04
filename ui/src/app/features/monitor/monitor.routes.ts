import { Routes } from '@angular/router';

export const MONITOR_ROUTES: Routes = [
  { path: 'dashboard', title: 'Dashboard — Kubsome', loadComponent: () => import('../dashboard/dashboard').then(m => m.DashboardComponent) },
  { path: 'overview', title: 'Monitor — Kubsome', loadComponent: () => import('./monitor').then(m => m.MonitorComponent) },
  { path: 'investigate', title: 'Investigate — Kubsome', loadComponent: () => import('../investigate/investigate').then(m => m.InvestigateComponent) },
  { path: 'metrics', title: 'Metrics — Kubsome', loadComponent: () => import('../metrics/metrics').then(m => m.MetricsComponent) },
  { path: 'events', title: 'Events — Kubsome', loadComponent: () => import('../events/events').then(m => m.EventsComponent) },
  { path: 'logs', title: 'Logs — Kubsome', loadComponent: () => import('../logs/logs').then(m => m.LogsComponent) },
  { path: 'health-signals', title: 'Health Signals — Kubsome', loadComponent: () => import('../health-signals/health-signals').then(m => m.HealthSignalsComponent) },
  { path: 'scorecard', title: 'Scorecard — Kubsome', loadComponent: () => import('../scorecard/scorecard').then(m => m.ScorecardComponent) },
  { path: 'timeline', title: 'Timeline — Kubsome', loadComponent: () => import('../timeline/timeline').then(m => m.TimelineComponent) },
  { path: 'doctor', title: 'Health — Kubsome', loadComponent: () => import('../doctor/doctor').then(m => m.DoctorComponent) },
  { path: 'log-correlation', title: 'Log Correlation — Kubsome', loadComponent: () => import('../log-correlation/log-correlation').then(m => m.LogCorrelationComponent) },
  { path: 'my-dashboard', title: 'Custom Dashboard — Kubsome', loadComponent: () => import('../custom-dashboard/custom-dashboard').then(m => m.CustomDashboardComponent) },
];
