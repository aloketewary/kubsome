import { Routes } from '@angular/router';

export const INFRASTRUCTURE_ROUTES: Routes = [
  { path: 'network', title: 'Network — Kubsome', loadComponent: () => import('../network/network').then(m => m.NetworkComponent) },
  { path: 'graph', title: 'Service Map — Kubsome', loadComponent: () => import('../graph/graph').then(m => m.GraphComponent) },
  { path: 'gateway-monitor', title: 'Gateway — Kubsome', loadComponent: () => import('../gateway-monitor/gateway-monitor.component').then(m => m.GatewayMonitorComponent) },
  { path: 'gitops', title: 'GitOps — Kubsome', loadComponent: () => import('../gitops/gitops').then(m => m.GitopsComponent) },
  { path: 'policy', title: 'Policy — Kubsome', loadComponent: () => import('../policy/policy').then(m => m.PolicyComponent) },
  { path: 'mesh', title: 'Service Mesh — Kubsome', loadComponent: () => import('../mesh/mesh').then(m => m.MeshComponent) },
  { path: 'integrations', title: 'Integrations — Kubsome', loadComponent: () => import('../integrations/integrations').then(m => m.IntegrationsComponent) },
  { path: 'compare', title: 'Compare — Kubsome', loadComponent: () => import('../compare/compare').then(m => m.CompareComponent) },
  { path: 'helm', title: 'Helm — Kubsome', loadComponent: () => import('../helm/helm').then(m => m.HelmComponent) },
  { path: 'port-forwards', title: 'Port Forwards — Kubsome', loadComponent: () => import('../port-forwards/port-forwards').then(m => m.PortForwardsComponent) },
  { path: 'blast-radius', title: 'Blast Radius — Kubsome', loadComponent: () => import('../blast-radius/blast-radius').then(m => m.BlastRadiusComponent) },
  { path: 'taints', title: 'Node Taints — Kubsome', loadComponent: () => import('../taints/taints').then(m => m.TaintsComponent) },
  { path: 'node-ops', title: 'Node Operations — Kubsome', loadComponent: () => import('../node-ops/node-ops').then(m => m.NodeOpsComponent) },
  { path: 'resource-ops', title: 'Resource Operations — Kubsome', loadComponent: () => import('../resource-ops/resource-ops').then(m => m.ResourceOpsComponent) },
];
