import { Component, inject } from '@angular/core';
import { ErrorService } from '../../core/services/error.service';

@Component({
  selector: 'app-error-toast',
  standalone: true,
  template: `
    <div class="error-container">
      @for (error of errorService.errors(); track error.id) {
        <div class="error-toast" (click)="errorService.dismiss(error.id)">
          <i class="pi pi-times-circle"></i>
          <div class="error-body">
            <span class="error-msg">{{ error.message }}</span>
            @if (error.status) {
              <span class="error-code">HTTP {{ error.status }}</span>
            }
          </div>
        </div>
      }
    </div>
  `,
  styles: [`
    .error-container {
      position: fixed;
      bottom: 40px;
      left: 232px;
      z-index: 8000;
      display: flex;
      flex-direction: column;
      gap: 6px;
      max-width: 340px;
    }
    .error-toast {
      display: flex;
      align-items: center;
      gap: 10px;
      padding: 10px 14px;
      background: var(--bg-card);
      border: 1px solid var(--danger);
      border-left: 3px solid var(--danger);
      border-radius: 8px;
      box-shadow: 0 4px 20px rgba(0,0,0,0.4);
      cursor: pointer;
      animation: slideUp 0.2s ease-out;
    }
    @keyframes slideUp {
      from { opacity: 0; transform: translateY(8px); }
      to { opacity: 1; transform: translateY(0); }
    }
    .error-toast i { color: var(--danger); font-size: 14px; }
    .error-body { display: flex; flex-direction: column; gap: 2px; }
    .error-msg { font-size: 12px; font-weight: 500; }
    .error-code { font-size: 10px; color: var(--text-muted); }
  `],
})
export class ErrorToastComponent {
  errorService = inject(ErrorService);
}
