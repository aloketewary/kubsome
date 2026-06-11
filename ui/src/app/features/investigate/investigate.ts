import { Component, inject, OnInit } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { ActivatedRoute } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { DecimalPipe, KeyValuePipe, UpperCasePipe } from '@angular/common';
import { TooltipModule } from 'primeng/tooltip';
import { IntelHeaderComponent, HoloCardComponent, MetricTileComponent, StatusBeaconComponent } from '../../shared/components/futuristic';
import { Subject, debounceTime, distinctUntilChanged, switchMap, of } from 'rxjs';

@Component({
  selector: 'app-investigate',
  standalone: true,
  imports: [FormsModule, TooltipModule, IntelHeaderComponent, HoloCardComponent, MetricTileComponent, StatusBeaconComponent, DecimalPipe, KeyValuePipe, UpperCasePipe],
  templateUrl: './investigate.html',
  styleUrl: './investigate.scss',
})
export class InvestigateComponent implements OnInit {
  private http = inject(HttpClient);
  private route = inject(ActivatedRoute);

  target = '';
  loading = false;
  loadError = '';
  report: any = null;
  benchmarkData: any = null;
  feedbackSummary: any = null;
  activeTab: 'findings' | 'timeline' | 'evidence' | 'plans' | 'trust' = 'findings';
  expandedSources: Set<string> = new Set();
  copyFeedback: string | null = null;

  // Dropdown suggestions
  suggestions: string[] = [];
  showSuggestions = false;
  private searchSubject = new Subject<string>();

  get findings() { return this.report?.findings?.filter((f: any) => f.id !== 'healthy') || []; }
  get observations() { return this.report?.observations || []; }
  get recommendations() { return this.report?.recommendations || []; }
  get plans() { return this.report?.execution_plans || []; }
  get evidenceScores() { return this.report?.evidence_scores || {}; }

  get criticalCount() { return this.findings.filter((f: any) => f.severity === 'critical').length; }
  get highCount() { return this.findings.filter((f: any) => f.severity === 'high').length; }
  get mediumCount() { return this.findings.filter((f: any) => f.severity === 'medium').length; }
  get lowCount() { return this.findings.filter((f: any) => f.severity === 'low').length; }

  get topFinding(): any | null {
    const order = ['critical', 'high', 'medium', 'low', 'info'];
    for (const sev of order) {
      const f = this.findings.find((x: any) => x.severity === sev);
      if (f) return f;
    }
    return null;
  }

  get overallConfidence(): number {
    const scores = this.evidenceScores;
    const strengthMap: Record<string, number> = { strong: 92, medium: 68, weak: 35 };
    let max = 0;
    for (const val of Object.values(scores)) {
      max = Math.max(max, strengthMap[val as string] || 0);
    }
    return max;
  }

  get topRecommendation(): any | null {
    const top = this.topFinding;
    if (!top) return null;
    return this.recommendations.find((r: any) => r.finding_id === top.id) || null;
  }

  confidenceForFinding(f: any): number {
    const score = this.evidenceScores[f.id];
    const map: Record<string, number> = { strong: 92, medium: 68, weak: 35 };
    return map[score] || 0;
  }

  get timelineEntries(): any[] {
    return [...this.observations]
      .filter((o: any) => o.timestamp)
      .sort((a: any, b: any) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
  }

  get evidenceBySource(): { source: string; items: any[] }[] {
    const groups: Record<string, any[]> = {};
    for (const obs of this.observations) {
      const src = obs.source || 'unknown';
      if (!groups[src]) groups[src] = [];
      groups[src].push(obs);
    }
    return Object.entries(groups).map(([source, items]) => ({ source, items }));
  }

  get feedbackEntries(): { key: string; accuracy: number; correct: number; wrong: number; partial: number }[] {
    if (!this.feedbackSummary?.findings) return [];
    return Object.entries(this.feedbackSummary.findings).map(([key, val]: [string, any]) => ({
      key,
      accuracy: val.accuracy ?? 0,
      correct: val.correct ?? 0,
      wrong: val.wrong ?? 0,
      partial: val.partial ?? 0,
    }));
  }

  ngOnInit() {
    // Setup autocomplete debounce
    this.searchSubject.pipe(
      debounceTime(250),
      distinctUntilChanged(),
      switchMap(q => q.length >= 2
        ? this.http.get<any>(`/api/pods`, { params: { search: q, size: 8 } })
        : of({ pods: [] })
      ),
    ).subscribe(res => {
      this.suggestions = res.pods.map((p: any) => p.name);
      this.showSuggestions = this.suggestions.length > 0;
    });

    // Read query param and auto-investigate
    this.route.queryParams.subscribe(params => {
      if (params['target']) {
        this.target = params['target'];
        this.investigate();
      }
    });
  }

  onSearchInput() {
    this.searchSubject.next(this.target);
  }

  selectSuggestion(name: string) {
    this.target = name;
    this.showSuggestions = false;
    this.investigate();
  }

  hideSuggestions() {
    // Delay to allow click on suggestion
    setTimeout(() => { this.showSuggestions = false; }, 150);
  }

  investigate() {
    if (!this.target.trim()) return;
    this.loading = true;
    this.loadError = '';
    this.report = null;
    this.showSuggestions = false;
    this.activeTab = 'findings';

    this.http.get<any>(`/api/investigate/${this.target.trim()}`).subscribe({
      next: (res) => { this.report = res; this.loading = false; },
      error: (err) => { this.loading = false; this.loadError = err.error?.detail || 'Investigation failed'; },
    });
  }

  loadBenchmark() {
    this.activeTab = 'trust';
    if (this.benchmarkData) return;
    this.http.get<any>('/api/benchmark').subscribe({
      next: (res) => { this.benchmarkData = res; },
      error: () => { this.benchmarkData = { total: 0, message: 'Failed to load' }; },
    });
    this.http.get<any>('/api/feedback/summary').subscribe({
      next: (res) => { this.feedbackSummary = res; },
    });
  }

  submitFeedback(findingType: string, verdict: string) {
    this.http.post<any>('/api/feedback', null, {
      params: { finding_type: findingType, verdict }
    }).subscribe();
  }

  severityBeacon(severity: string): 'ok' | 'warning' | 'critical' {
    if (severity === 'critical' || severity === 'high') return 'critical';
    if (severity === 'medium') return 'warning';
    return 'ok';
  }

  strengthLabel(findingId: string): string {
    return this.evidenceScores[findingId] || '';
  }

  getEvidenceForFinding(f: any): any[] {
    const ids = new Set(f.evidence_ids || []);
    return this.observations.filter((o: any) => ids.has(o.id));
  }

  getRecsForFinding(f: any): any[] {
    return this.recommendations.filter((r: any) => r.finding_id === f.id);
  }

  toggleSource(source: string) {
    if (this.expandedSources.has(source)) {
      this.expandedSources.delete(source);
    } else {
      this.expandedSources.add(source);
    }
  }

  isSourceExpanded(source: string): boolean {
    return this.expandedSources.has(source);
  }

  sourceLabel(source: string): string {
    const labels: Record<string, string> = {
      event: 'Kubernetes Events',
      log: 'Logs',
      metrics: 'Metrics',
      resource: 'Resource State',
      config: 'Configuration',
      correlated_log: 'Correlated Logs',
      cross_service_event: 'Cross-Service Events',
    };
    return labels[source] || source;
  }

  formatTime(ts: string): string {
    if (!ts) return '';
    const d = new Date(ts);
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  }

  copyToClipboard(text: string) {
    navigator.clipboard.writeText(text);
    this.copyFeedback = text;
    setTimeout(() => { this.copyFeedback = null; }, 1500);
  }
}
