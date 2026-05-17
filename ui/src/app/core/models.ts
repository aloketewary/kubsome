export interface Pod {
  name: string;
  status: string;
  restarts: number;
  labels?: string[];
  age?: string;
}

export interface PodsResponse {
  context: string;
  namespace: string;
  pods: Pod[];
  total: number;
  page: number;
  size: number;
}

export interface HealthCount {
  healthy: number;
  warning: number;
  critical: number;
  unavailable: number;
}

export interface ResourceRecommendation {
  pod: string;
  type: string;
  severity: 'warning' | 'info';
  title: string;
  detail: string;
  suggestion: string;
  current?: string;
  suggested?: string;
}

export interface OverviewResponse {
  context: string;
  namespace: string;
  pods: HealthCount;
  nodes: HealthCount;
  deployments: HealthCount;
  top_recommendation?: ResourceRecommendation;
}

export interface KubeContext {
  name: string;
  cluster: string;
  namespace: string;
  user: string;
  environment: string;
  risk: string;
}

export interface ContextsResponse {
  current: string;
  namespace: string;
  contexts: KubeContext[];
}

export interface KubeEvent {
  type: string;
  reason: string;
  object: string;
  kind: string;
  message: string;
  count: number;
  last_seen: string;
}

export interface EventsResponse {
  context: string;
  namespace: string;
  events: KubeEvent[];
}

export interface PodMetrics {
  name: string;
  cpu: string;
  memory: string;
  cpu_millicores: number;
  memory_mb: number;
}

export interface NodeMetrics {
  name: string;
  cpu: string;
  cpu_percent: string;
  memory: string;
  memory_percent: string;
  cpu_pct_val: number;
  mem_pct_val: number;
}

export interface NamespacesResponse {
  namespaces: string[];
  current: string;
}

export interface Deployment {
  name: string;
  desired: number;
  available: number;
}

export interface DeploymentsResponse {
  context: string;
  namespace: string;
  deployments: Deployment[];
}

export interface LogsResponse {
  pod: string;
  namespace: string;
  lines: string[];
  count: number;
}

export interface DiagnoseResponse {
  pod: string;
  findings: any[];
  summary?: string;
  reasoning?: string;
}

export interface SearchResult {
  kind: string;
  name: string;
  namespace?: string;
}

export interface AiResponse {
  answer?: string;
  summary?: string;
  [key: string]: any;
}

export interface UsageStats {
  total_commands: number;
  top_commands: [string, number][];
  unresolved_count: number;
  top_unresolved: [string, number][];
  days_tracked: number;
}
