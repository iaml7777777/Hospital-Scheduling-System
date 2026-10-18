import { Component, inject, output, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AuthService } from '../../../services/auth.service';

@Component({
  selector: 'app-password-modal',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="modal-overlay" (click)="close.emit()">
      <div class="modal-content" (click)="$event.stopPropagation()">
        <div class="card-header" style="margin-bottom: 20px;">
          <h3>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
              <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
            </svg>
            修改個人密碼
          </h3>
          <button class="btn btn-sm" (click)="close.emit()">✕</button>
        </div>

        <div *ngIf="errorMessage()" class="alert-box alert-danger">
          {{ errorMessage() }}
        </div>
        <div *ngIf="successMessage()" class="alert-box alert-success">
          {{ successMessage() }}
        </div>

        <form (ngSubmit)="onSubmit()">
          <div class="form-group">
            <label>目前密碼 *</label>
            <input type="password" [(ngModel)]="oldPassword" name="oldPassword" required placeholder="請輸入目前密碼" />
          </div>

          <div class="form-group">
            <label>新密碼 * (至少 6 個字元)</label>
            <input type="password" [(ngModel)]="newPassword" name="newPassword" required placeholder="請輸入新密碼" />
            <div class="hint">密碼需至少 6 字元，且不可與目前密碼相同</div>
          </div>

          <div class="form-group">
            <label>確認新密碼 *</label>
            <input type="password" [(ngModel)]="confirmPassword" name="confirmPassword" required placeholder="請再次輸入新密碼" />
          </div>

          <div style="display: flex; justify-content: flex-end; gap: 10px; margin-top: 24px;">
            <button type="button" class="btn btn-secondary" (click)="close.emit()">取消</button>
            <button type="submit" class="btn btn-primary" [disabled]="isSubmitting">確認修改</button>
          </div>
        </form>
      </div>
    </div>
  `,
  styles: [`
    .alert-box {
      padding: 10px 14px;
      border-radius: 6px;
      font-size: 0.85rem;
      margin-bottom: 16px;
    }
    .alert-danger {
      background: var(--danger-light);
      color: #991b1b;
      border: 1px solid #fecaca;
    }
    .alert-success {
      background: var(--success-light);
      color: #065f46;
      border: 1px solid #a7f3d0;
    }
  `],
})
export class PasswordModalComponent {
  private authService = inject(AuthService);
  close = output<void>();

  oldPassword = '';
  newPassword = '';
  confirmPassword = '';
  isSubmitting = false;

  errorMessage = signal<string | null>(null);
  successMessage = signal<string | null>(null);

  onSubmit(): void {
    this.errorMessage.set(null);
    this.successMessage.set(null);

    if (this.newPassword !== this.confirmPassword) {
      this.errorMessage.set('兩次輸入的新密碼不一致！');
      return;
    }

    const res = this.authService.changePassword(this.oldPassword, this.newPassword);
    if (!res.success) {
      this.errorMessage.set(res.message);
    } else {
      this.successMessage.set(res.message);
      setTimeout(() => {
        this.close.emit();
      }, 1200);
    }
  }
}
