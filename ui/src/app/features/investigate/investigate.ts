import { Component, inject, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { DecimalPipe, KeyValuePipe, UpperCasePipe } from '@angular/common';
import { TooltipModule } from 'primeng/tooltip';
import { IntelHeaderComponent, HoloCardComponent, MetricTileComponent, StatusBeaconComponent } from '../../shared/components/futuristic';
import { ApiService } from '../../core/services/api.service';
import { Subject, debounceTime, distinctUntilChanged, switchMap, of, catchError, finalize } from 'rxjs';

@Component({
  selector: 'app-investigate',
  standalone: true,
  imports: [FormsModule, TooltipModule, IntelHeaderComponent, HoloCardComponent, MetricTileComponent, StatusBeaconComponent, DecimalPipe, KeyValuePipe, UpperCasePipe],
  templateUrl: './investigate.html',
  styleUrl: './investigate.scss',
})
export class InvestigateComponent implements OnInit {
  private api = inject(ApiService);
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private searchSubject = new Subject<string>();
  private investigationRequestId = 0;

  target = '';
  loading = false;
  loadError = '';
  report: any = null;
  benchmarkData: any = null;
  benchmarkError = '';
  benchmarkLoading = false;
  feedbackSummary: any = null;
  feedbackState: 'idle' | 'submitting' | 'recorded' | 'error' = 'idle';
  feedbackMessage = '';
  activeTab: 'findings' | 'timeline' | 'evidence' | 'plans' | 'trust' = 'findings';
  expandedSources: Set<string> = new Set();
  copyFeedback: string | null = null;
  copyError = '';

  suggestions: string[] = [];
  showSuggestions = false;
  autocompleteLoading = false;
  autocompleteError = '';

  get findings() { return this.report?.findings?.filter((f: any) => f.id !== 'healthy') || []; }
  get observations() { return this.report?.observations || []; }
  get recommendations() { return this.report?.recommendations || []; }
  get plans() { return this.report?.execution_plans || []; }
  get evidenceScores() { return this.report?.evidence_scores || {}; }
  get isHealthyReport() { return !!this.report && this.findings.length === 0; }

  get reportTarget(): string {
    const target = this.report?.target;
    if (typeof target === 'string') return target;
    return target?.name || this.target;
  }

  get criticalCount() { return this.findings.filter((f: any) => f.severity === 'critical').length; }
  get highCount() { return this.findings.filter((f: any) => f.severity === 'high').length; }
  get mediumCount() { return this.findings.filter((f: any) => f.severity === 'medium').length; }
  get lowCount() { return this.findings.filter((f: any) => f.severity === 'low').length; }

  get topFinding(): any | null {
    const order = ['critical', 'high', 'medium', 'low', 'info'];
    for (const severity of order) {
      const finding = this.findings.find((item: any) => item.severity === severity);
      if (finding) return finding;
    }
    return null;
  }

  get overallConfidence(): number {
    if (!this.report) return 0;
    if (this.topFinding) return this.confidenceForFinding(this.topFinding);
    return 100;
  }

  get topRecommendation(): any | null {
    const top = this.topFinding;
    if (!top) return null;
    return this.recommendations.find((item: any) => item.finding_id === top.id) || null;
  }

  confidenceForFinding(finding: any): number {
    const score = this.evidenceScores[finding.id];
    const map: Record<string, number> = { strong: 92, medium: 68, weak: 35 };
    return map[score] || 0;
  }

  get timelineEntries(): any[] {
    return [...this.observations]
      .filter((observation: any) => observation.timestamp)
      .sort((a: any, b: any) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
  }

  get evidenceBySource(): { source: string; items: any[] }[] {
    const groups: Record<string, any[]> = {};
    for (const observation of this.observations) {
      const source = observation.source || 'unknown';
      if (!groups[source]) groups[source] = [];
      groups[source].push(observation);
    }
    return Object.entries(groups).map(([source, items]) => ({ source, items }));
  }

  get feedbackEntries(): { key: string; accuracy: number; correct: number; wrong: number; partial: number }[] {
    if (!this.feedbackSummary?.findings) return [];
    return Object.entries(this.feedbackSummary.findings).map(([key, value]: [string, any]) => ({
      key,
      accuracy: value.accuracy ?? 0,
      correct: value.correct ?? 0,
      wrong: value.wrong ?? 0,
      partial: value.partial ?? 0,
    }));
  }

  ngOnInit() {
    this.searchSubject.pipe(
      debounceTime(250),
      distinctUntilChanged(),
      switchMap(value => {
        const query = value.trim();
        this.autocompleteError = '';
        if (query.length < 2) {
          this.autocompleteLoading = false;
          return of({ pods: [] });
        }

        this.autocompleteLoading = true;
        return this.api.getPods(1, 8, query).pipe(
          catchError(() => {
            this.autocompleteError = 'Unable to load pod suggestions.';
            return of({ pods: [] });
          }),
          finalize(() => { this.autocompleteLoading = false; }),
        );
      }),
    ).subscribe(response => {
      this.suggestions = (response.pods || []).map((pod: any) => pod.name);
      this.showSuggestions = this.target.trim().length >= 2;
    });

    this.route.queryParams.subscribe(params => {
      const requestedTarget = (params['target'] || params['deployment'] || '').trim();
      if (requestedTarget && requestedTarget !== this.target) {
        this.target = requestedTarget;
        this.investigate(false);
      }
    });
  }

  onSearchInput() {
    this.autocompleteError = '';
    this.searchSubject.next(this.target);
  }

  selectSuggestion(name: string) {
    this.target = name;
    this.showSuggestions = false;
    this.investigate();
  }

  hideSuggestions() {
    setTimeout(() => { this.showSuggestions = false; }, 150);
  }

  investigate(updateUrl = true) {
    const normalizedTarget = this.target.trim();
    if (!normalizedTarget) {
      this.loadError = 'Enter a pod name to investigate.';
      return;
    }

    this.target = normalizedTarget;
    if (updateUrl) {
      this.router.navigate([], {
        relativeTo: this.route,
        queryParams: { target: normalizedTarget },
        replaceUrl: true,
      });
    }

    const requestId = ++this.investigationRequestId;
    this.loading = true;
    this.loadError = '';
    this.report = null;
    this.showSuggestions = false;
    this.activeTab = 'findings';
    this.feedbackState = 'idle';
    this.feedbackMessage = '';

    this.api.investigate(normalizedTarget).subscribe({
      next: response => {
        if (requestId !== this.investigationRequestId) return;
        this.report = response;
        this.loading = false;
      },
      error: error => {
        if (requestId !== this.investigationRequestId) return;
        this.loading = false;
        this.loadError = error.error?.detail || 'Investigation failed. Check the pod name and cluster connection.';
      },
    });
  }

  loadBenchmark() {
    this.activeTab = 'trust';
    if (this.benchmarkLoading) return;
    if (this.benchmarkData && !this.benchmarkError) return;

    this.benchmarkError = '';
    this.benchmarkLoading = true;
    this.api.getBenchmark().subscribe({
      next: response => { this.benchmarkData = response; this.benchmarkLoading = false; },
      error: () => {
        this.benchmarkData = null;
        this.benchmarkLoading = false;
        this.benchmarkError = 'Benchmark unavailable. Try again.';
      },
    });

    this.api.getFeedbackSummary().subscribe({
      next: response => { this.feedbackSummary = response; },
    });
  }

  submitFeedback(findingType: string, verdict: string) {
    if (this.feedbackState === 'submitting') return;
    this.feedbackState = 'submitting';
    this.feedbackMessage = '';
    this.api.submitFeedback(findingType, verdict).subscribe({
      next: () => {
        this.feedbackState = 'recorded';
        this.feedbackMessage = 'Feedback recorded.';
      },
      error: () => {
        this.feedbackState = 'error';
        this.feedbackMessage = 'Feedback could not be recorded.';
      },
    });
  }

  severityBeacon(severity: string): 'ok' | 'warning' | 'critical' {
    if (severity === 'critical' || severity === 'high') return 'critical';
    if (severity === 'medium') return 'warning';
    return 'ok';
  }

  strengthLabel(findingId: string): string {
    return this.evidenceScores[findingId] || '';
  }

  getEvidenceForFinding(finding: any): any[] {
    const ids = new Set(finding.evidence_ids || []);
    return this.observations.filter((observation: any) => ids.has(observation.id));
  }

  getRecsForFinding(finding: any): any[] {
    return this.recommendations.filter((recommendation: any) => recommendation.finding_id === finding.id);
  }

  toggleSource(source: string) {
    if (this.expandedSources.has(source)) this.expandedSources.delete(source);
    else this.expandedSources.add(source);
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

  formatTime(timestamp: string): string {
    if (!timestamp) return '';
    const date = new Date(timestamp);
    return Number.isNaN(date.getTime()) ? '' : date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  }

  copyToClipboard(text: string) {
    this.copyError = '';
    if (!navigator.clipboard) {
      this.copyError = 'Clipboard is unavailable in this browser.';
      return;
    }

    navigator.clipboard.writeText(text).then(() => {
      this.copyFeedback = text;
      setTimeout(() => { this.copyFeedback = null; }, 1500);
    }).catch(() => {
      this.copyError = 'Copy failed. Select the command manually.';
    });
  }
}
