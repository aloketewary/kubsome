export interface OpportunityItem {
  deployment: string;
  namespace: string;
  savings_monthly: number;
  confidence: number;
  risk: 'low' | 'medium' | 'high';
  reason: string;
  score: number;
  cpu_current: number;
  cpu_recommended: number;
  cpu_limit_recommended: number;
  mem_current: number;
  mem_recommended: number;
  mem_limit_recommended: number;
  cpu_p95: number;
  mem_p95: number;
  pods: number;
  workload_type: string;
  cpu_volatile: boolean;
  mem_volatile: boolean;
}

export interface RiskWorkload {
  deployment: string;
  namespace: string;
  severity: 'critical' | 'high' | 'medium';
  resource: string;
  utilization_pct: number;
  request: number;
  p95: number;
  unit: string;
  restarts: number;
  action: string;
}

export interface ExecutionItem {
  deployment: string;
  namespace: string;
  savings_monthly: number;
  confidence: number;
  risk: string;
}

export interface ExecutionPhase {
  label: string;
  count: number;
  savings_monthly: number;
  auto_apply: boolean;
  items: ExecutionItem[];
}

export interface RightsizingOverview {
  deployments_analyzed: number;
  total_savings_monthly: number;
  at_risk_count: number;
  safe_to_apply: number;
  opportunities: OpportunityItem[];
  risks: RiskWorkload[];
  execution: ExecutionPhase[];
  generated_at: string;
  data_freshness_seconds: number;
  empty_state_reason: string | null;
}
