import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService } from '../../services/auth.service';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="login-wrapper">
      <div class="login-card">
        <div class="login-header">
          <div class="brand-logo">
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2">
              <path d="M22 12h-4l-3 9L9 3l-3 9H2"></path>
            </svg>
          </div>
          <h2>護理人員智慧排班系統</h2>
          <p class="subtitle">依據衛生福利部護理排班指引與勞基法法規開發</p>
        </div>

        <div *ngIf="errorMessage()" class="alert alert-danger">
          {{ errorMessage() }}
        </div>
        <div *ngIf="infoMessage()" class="alert alert-info">
          {{ infoMessage() }}
        </div>

        <form (ngSubmit)="onLogin()">
          <div class="form-group">
            <label>登入帳號 (Username)</label>
            <input
              type="text"
              [(ngModel)]="username"
              name="username"
              required
              placeholder="請輸入帳號 (例如: user1, admin)"
              autocomplete="username"
            />
          </div>

          <div class="form-group">
            <label>登入密碼 (Password)</label>
            <input
              type="password"
              [(ngModel)]="password"
              name="password"
              required
              placeholder="請輸入密碼 (預設: user123, admin123)"
              autocomplete="current-password"
            />
          </div>

          <button type="submit" class="btn btn-primary btn-block" [disabled]="loading">
            {{ loading ? '驗證中...' : '登入系統' }}
          </button>
        </form>

        <!-- Quick Demo Accounts -->
        <div class="quick-demo-accounts">
          <div class="demo-title">快速體驗帳號 (點擊代入)：</div>
          <div class="account-chips">
            <button class="chip" (click)="fillAccount('admin', 'admin123')">
              <strong>admin</strong>
              <span>(全院管理員)</span>
            </button>
            <button class="chip" (click)="fillAccount('user1', 'user123')">
              <strong>user1</strong>
              <span>(7A 護理長)</span>
            </button>
            <button class="chip" (click)="fillAccount('nurse1', 'nurse123')">
              <strong>nurse1</strong>
              <span>(張佩芬 資深)</span>
            </button>
            <button class="chip" (click)="fillAccount('nurse5', 'nurse123')">
              <strong>nurse5</strong>
              <span>(郭欣儒 妊娠)</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .login-wrapper {
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      background: linear-gradient(135deg, #0f172a 0%, #1e293b 100%);
      padding: 20px;
    }

    .login-card {
      background: #ffffff;
      width: 100%;
      max-width: 440px;
      border-radius: 16px;
      box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.25);
      padding: 36px 32px;
    }

    .login-header {
      text-align: center;
      margin-bottom: 28px;

      .brand-logo {
        width: 56px;
        height: 56px;
        background: linear-gradient(135deg, #0284c7, #0d9488);
        border-radius: 14px;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        color: #fff;
        margin-bottom: 16px;
        box-shadow: 0 8px 16px rgba(2, 132, 199, 0.35);
      }

      h2 {
        font-size: 1.35rem;
        font-weight: 700;
        color: #0f172a;
        margin-bottom: 6px;
      }

      .subtitle {
        font-size: 0.8rem;
        color: #64748b;
        line-height: 1.4;
      }
    }

    .alert {
      padding: 10px 14px;
      border-radius: 8px;
      font-size: 0.85rem;
      margin-bottom: 16px;
    }

    .alert-danger {
      background: #fee2e2;
      color: #991b1b;
      border: 1px solid #fecaca;
    }

    .alert-info {
      background: #e0f2fe;
      color: #0369a1;
      border: 1px solid #bae6fd;
    }

    .btn-block {
      width: 100%;
      padding: 11px;
      font-size: 0.95rem;
      font-weight: 600;
      margin-top: 10px;
    }

    .quick-demo-accounts {
      margin-top: 28px;
      padding-top: 20px;
      border-top: 1px dashed var(--border-color);

      .demo-title {
        font-size: 0.75rem;
        color: #64748b;
        margin-bottom: 10px;
        font-weight: 500;
      }

      .account-chips {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 8px;

        .chip {
          display: flex;
          flex-direction: column;
          align-items: flex-start;
          padding: 8px 10px;
          background: #f8fafc;
          border: 1px solid var(--border-color);
          border-radius: 8px;
          font-size: 0.8rem;
          color: #334155;
          text-align: left;
          transition: all 0.15s;

          &:hover {
            border-color: var(--primary);
            background: #f0f9ff;
            color: var(--primary);
          }

          strong {
            font-size: 0.82rem;
          }

          span {
            font-size: 0.7rem;
            color: #64748b;
          }
        }
      }
    }
  `],
})
export class LoginComponent {
  private authService = inject(AuthService);
  private router = inject(Router);

  username = 'user1';
  password = 'user123';
  loading = false;
  errorMessage = signal<string | null>(null);
  infoMessage = signal<string | null>(null);

  fillAccount(u: string, p: string): void {
    this.username = u;
    this.password = p;
    this.errorMessage.set(null);
  }

  onLogin(): void {
    this.loading = true;
    this.errorMessage.set(null);
    this.infoMessage.set(null);

    setTimeout(() => {
      const res = this.authService.login(this.username, this.password);
      this.loading = false;

      if (!res.success) {
        this.errorMessage.set(res.message);
      } else {
        const user = this.authService.currentUser();
        if (user?.role === 'N') {
          this.router.navigate(['/my-schedule']);
        } else {
          this.router.navigate(['/schedule']);
        }
      }
    }, 250);
  }
}
