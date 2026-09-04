import { Routes } from '@angular/router';

export const OPERATIONS_ROUTES: Routes = [
  { path: 'pods', title: 'Pods — Kubsome', loadComponent: () => import('../pods/pods').then(m => m.PodsComponent) },
  { path: 'deployments', title: 'Deployments — Kubsome', loadComponent: () => import('../deployments/deployments').then(m => m.DeploymentsComponent) },
  { path: 'jobs', title: 'Jobs — Kubsome', loadComponent: () => import('../jobs/jobs').then(m => m.JobsComponent) },
  { path: 'namespace', title: 'Namespace — Kubsome', loadComponent: () => import('../namespace/namespace').then(m => m.NamespaceComponent) },
  { path: 'rbac', title: 'RBAC — Kubsome', loadComponent: () => import('../rbac/rbac').then(m => m.RbacComponent) },
  { path: 'resources', title: 'Resources — Kubsome', loadComponent: () => import('../resources/resources').then(m => m.ResourcesComponent) },
  { path: 'secrets', title: 'Pull Secrets — Kubsome', loadComponent: () => import('../secrets/secrets').then(m => m.SecretsComponent) },
  { path: 'incident', title: 'Incident — Kubsome', loadComponent: () => import('../incident/incident').then(m => m.IncidentComponent) },
  { path: 'terminal', title: 'Terminal — Kubsome', loadComponent: () => import('../terminal/terminal').then(m => m.TerminalComponent) },
  { path: 'runbooks', title: 'Runbooks — Kubsome', loadComponent: () => import('../runbooks/runbooks').then(m => m.RunbooksComponent) },
  { path: 'yaml', title: 'YAML Editor — Kubsome', loadComponent: () => import('../yaml-editor/yaml-editor').then(m => m.YamlEditorComponent) },
  { path: 'yaml-diff', title: 'YAML Diff — Kubsome', loadComponent: () => import('../yaml-diff/yaml-diff').then(m => m.YamlDiffComponent) },
  { path: 'audit', title: 'Audit — Kubsome', loadComponent: () => import('../audit/audit').then(m => m.AuditComponent) },
  { path: 'schedule', title: 'Schedules — Kubsome', loadComponent: () => import('../schedule/schedule').then(m => m.ScheduleComponent) },
];
