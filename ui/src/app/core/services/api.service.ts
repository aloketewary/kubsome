import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import {
  PodsResponse,
  OverviewResponse,
  ContextsResponse,
  EventsResponse,
  PodMetrics,
  NodeMetrics,
  NamespacesResponse,
  DeploymentsResponse,
  LogsResponse,
  DiagnoseResponse,
  AiResponse,
} from '../models';

@Injectable({ providedIn: 'root' })
export class ApiService {
  private http = inject(HttpClient);
  private base = '/api';

  // Pods
  getPods(): Observable<PodsResponse> {
    return this.http.get<PodsResponse>(`${this.base}/pods`);
  }

  // Overview
  getOverview(): Observable<OverviewResponse> {
    return this.http.get<OverviewResponse>(`${this.base}/overview`);
  }

  // Contexts
  getContexts(): Observable<ContextsResponse> {
    return this.http.get<ContextsResponse>(`${this.base}/contexts`);
  }

  switchContext(name: string): Observable<any> {
    return this.http.post(`${this.base}/switch-context`, { name });
  }

  // Namespaces
  getNamespaces(): Observable<NamespacesResponse> {
    return this.http.get<NamespacesResponse>(`${this.base}/namespaces`);
  }

  switchNamespace(namespace: string): Observable<any> {
    return this.http.post(`${this.base}/switch-namespace`, { namespace });
  }

  // Events
  getEvents(limit = 50): Observable<EventsResponse> {
    return this.http.get<EventsResponse>(`${this.base}/events`, { params: { limit } });
  }

  // Metrics
  getTopPods(): Observable<{ pods: PodMetrics[] }> {
    return this.http.get<{ pods: PodMetrics[] }>(`${this.base}/top/pods`);
  }

  getTopNodes(): Observable<{ nodes: NodeMetrics[] }> {
    return this.http.get<{ nodes: NodeMetrics[] }>(`${this.base}/top/nodes`);
  }

  // Deployments
  getDeployments(): Observable<DeploymentsResponse> {
    return this.http.get<DeploymentsResponse>(`${this.base}/deployments`);
  }

  getRollout(name: string): Observable<any> {
    return this.http.get(`${this.base}/rollout/${name}`);
  }

  restart(name: string): Observable<any> {
    return this.http.post(`${this.base}/restart/${name}`, {});
  }

  rollback(name: string): Observable<any> {
    return this.http.post(`${this.base}/rollback/${name}`, {});
  }

  scale(name: string, replicas: number): Observable<any> {
    return this.http.post(`${this.base}/scale/${name}`, { replicas });
  }

  // Logs
  getLogs(pod: string, tail = 100, errors = false): Observable<LogsResponse> {
    return this.http.get<LogsResponse>(`${this.base}/logs/${pod}`, { params: { tail, errors } });
  }

  // Diagnostics
  inspect(pod: string): Observable<any> {
    return this.http.get(`${this.base}/inspect/${pod}`);
  }

  diagnose(pod: string): Observable<DiagnoseResponse> {
    return this.http.get<DiagnoseResponse>(`${this.base}/diagnose/${pod}`);
  }

  trace(name: string): Observable<any> {
    return this.http.get(`${this.base}/trace/${name}`);
  }

  // Intelligence
  search(query: string): Observable<any> {
    return this.http.get(`${this.base}/search`, { params: { q: query } });
  }

  securityScan(): Observable<any> {
    return this.http.get(`${this.base}/security`);
  }

  healthCheck(): Observable<any> {
    return this.http.get(`${this.base}/health-check`);
  }

  anomalies(): Observable<any> {
    return this.http.get(`${this.base}/anomalies`);
  }

  optimize(): Observable<any> {
    return this.http.get(`${this.base}/optimize`);
  }

  askAi(query: string): Observable<AiResponse> {
    return this.http.post<AiResponse>(`${this.base}/ai`, { query });
  }
}
