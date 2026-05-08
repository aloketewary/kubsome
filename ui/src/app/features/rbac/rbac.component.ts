import { Component, inject, OnInit } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { TagModule } from 'primeng/tag';
import { ButtonModule } from 'primeng/button';

@Component({
  selector: 'app-rbac',
  standalone: true,
  imports: [TagModule, ButtonModule],
  template: `
    <div class="page-header">
      <h1>RBAC</h1>
      <p class="subtitle">Role bindings in namespace</p>
    </div>

    <div class="table-wrap">
      <table>
        <thead>
          <tr><th>Name</th><th>Role</th><th>Subjects</th><th>Kind</th></tr>
        </thead>
        <tbody>
          @for (b of bindings; track $index) {
            <tr>
              <td><code class="mono">{{ b.name }}</code></td>
              <td><p-tag [value]="b.role" severity="info" /></td>
              <td>{{ b.subjects }}</td>
              <td><p-tag [value]="b.kind" severity="secondary" /></td>
            </tr>
          }
        </tbody>
      </table>
    </div>
  `,
  styles: [`
    .page-header { margin-bottom: 24px; }
    .page-header h1 { font-size: 24px; font-weight: 700; letter-spacing: -0.03em; }
    .subtitle { font-size: 13px; color: var(--text-muted); margin-top: 4px; }
    .table-wrap {
      background: var(--bg-card);
      border: 1px solid var(--border);
      border-radius: var(--radius);
      overflow: hidden;
    }
    table { width: 100%; border-collapse: collapse; font-size: 13px; }
    th { text-align: left; padding: 12px 16px; font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.05em; color: var(--text-muted); border-bottom: 1px solid var(--border); background: var(--bg-elevated); }
    td { padding: 10px 16px; border-bottom: 1px solid var(--border); }
    tr:hover td { background: var(--bg-hover); }
  `],
})
export class RbacComponent implements OnInit {
  private http = inject(HttpClient);
  bindings: any[] = [];

  ngOnInit() {
    this.http.get<any>('http://localhost:8000/api/rbac').subscribe(res => {
      this.bindings = res.bindings || [];
    });
  }
}
