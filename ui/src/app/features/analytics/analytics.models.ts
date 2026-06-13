export interface ChangeItem {
  deployment: string;
  namespace: string;
  metric: 'memory' | 'cpu' | 'cost';
  delta_pct: number;
  trend: 'up' | 'down';
  current_value: number;
  previous_value: number;
  unit: string;
}

export interface CostOpportunity {
  deployment: string;
  namespace: string;
  action: string;
  savings_monthly: number;
  confidence: number;
  risk: 'low' | 'medium' | 'high';
}

export interface RiskItem {
  deployment: string;
  namespace: string;
  risk_type: string;
  severity: 'critical' | 'high' | 'medium';
  hours_remaining: number;
  message: string;
  recommendation: string;
  confidence: number;
}

export interface IncidentItem {
  deployment: string;
  namespace: string;
  severity: string;
  title: string;
  description: string;
  health_before: number;
  health_after: number;
  occurred_at: string;
}

export interface AnalyticsOverview {
  health_score: number;
  cost_delta_monthly: number;
  active_risks: number;
  highest_risk_severity: string | null;
  biggest_change: ChangeItem | null;
  top_changes: ChangeItem[];
  cost_opportunities: CostOpportunity[];
  upcoming_risks: RiskItem[];
  recent_incidents: IncidentItem[];
  generated_at: string;
  data_freshness_seconds: number;
  empty_state_reason: string | null;
}
