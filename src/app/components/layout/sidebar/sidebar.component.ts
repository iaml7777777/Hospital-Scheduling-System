import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { AuthService } from '../../../services/auth.service';
import { DataService } from '../../../services/data.service';
import { PasswordModalComponent } from '../password-modal/password-modal.component';

@Component({
  selector: 'app-sidebar',
  standalone: true,
  imports: [CommonModule, RouterModule, PasswordModalComponent],
  template: `
    <aside class="sidebar">
      <!-- App Brand -->
      <div class="sidebar-brand">
        <div class="brand-icon">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2">
            <path d="M22 12h-4l-3 9L9 3l-3 9H2"></path>
          </svg>
        </div>
        <div class="brand-info">
          <div class="brand-title">護理排班系統</div>
          <div class="brand-subtitle">Smart Scheduling v2.0</div>
        </div>
      </div>

      <!-- Navigation Links -->
      <nav class="sidebar-nav">
        <!-- Staff Nurse Nav -->
        <ng-container *ngIf="auth.isStaffNurse()">
          <a routerLink="/my-schedule" routerLinkActive="active" class="nav-item">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect>
              <line x1="16" y1="2" x2="16" y2="6"></line>
              <line x1="8" y1="2" x2="8" y2="6"></line>
              <line x1="3" y1="10" x2="21" y2="10"></line>
            </svg>
            <span>我的班表</span>
          </a>
          <a routerLink="/leaves" routerLinkActive="active" class="nav-item">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
              <polyline points="14 2 14 8 20 8"></polyline>
              <line x1="16" y1="13" x2="8" y2="13"></line>
              <line x1="16" y1="17" x2="8" y2="17"></line>
              <polyline points="10 9 9 9 8 9"></polyline>
            </svg>
            <span>休假申請</span>
          </a>
          <a routerLink="/swaps" routerLinkActive="active" class="nav-item">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M16 3h5v5"></path>
              <path d="M4 20L21 3"></path>
              <path d="M21 16v5h-5"></path>
              <path d="M15 15l6 6"></path>
              <path d="M4 4l5 5"></path>
            </svg>
            <span>換班管理</span>
          </a>
        </ng-container>

        <!-- Admin & Head Nurse Nav -->
        <ng-container *ngIf="!auth.isStaffNurse()">
          <a routerLink="/overview" routerLinkActive="active" class="nav-item">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <rect x="3" y="3" width="7" height="7"></rect>
              <rect x="14" y="3" width="7" height="7"></rect>
              <rect x="14" y="14" width="7" height="7"></rect>
              <rect x="3" y="14" width="7" height="7"></rect>
            </svg>
            <span>總覽儀表板</span>
          </a>

          <a routerLink="/schedule" routerLinkActive="active" class="nav-item">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect>
              <line x1="16" y1="2" x2="16" y2="6"></line>
              <line x1="8" y1="2" x2="8" y2="6"></line>
              <line x1="3" y1="10" x2="21" y2="10"></line>
            </svg>
            <span>班表管理</span>
          </a>

          <a routerLink="/leaves" routerLinkActive="active" class="nav-item">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
              <polyline points="14 2 14 8 20 8"></polyline>
              <line x1="16" y1="13" x2="8" y2="13"></line>
              <line x1="16" y1="17" x2="8" y2="17"></line>
            </svg>
            <span>休假申請</span>
          </a>

          <a routerLink="/swaps" routerLinkActive="active" class="nav-item">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M16 3h5v5"></path>
              <path d="M4 20L21 3"></path>
              <path d="M21 16v5h-5"></path>
              <path d="M15 15l6 6"></path>
              <path d="M4 4l5 5"></path>
            </svg>
            <span>換班管理</span>
          </a>

          <a routerLink="/statistics" routerLinkActive="active" class="nav-item">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <line x1="18" y1="20" x2="18" y2="10"></line>
              <line x1="12" y1="20" x2="12" y2="4"></line>
              <line x1="6" y1="20" x2="6" y2="14"></line>
            </svg>
            <span>統計報表</span>
          </a>

          <a routerLink="/nurses" routerLinkActive="active" class="nav-item">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
              <circle cx="9" cy="7" r="4"></circle>
              <path d="M23 21v-2a4 4 0 0 0-3-3.87"></path>
              <path d="M16 3.13a4 4 0 0 1 0 7.75"></path>
            </svg>
            <span>護理人員</span>
          </a>

          <a routerLink="/units" routerLinkActive="active" class="nav-item">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path>
              <polyline points="9 22 9 12 15 12 15 22"></polyline>
            </svg>
            <span>單位與班別</span>
          </a>

          <a *ngIf="auth.isAdmin()" routerLink="/settings" routerLinkActive="active" class="nav-item">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <circle cx="12" cy="12" r="3"></circle>
              <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path>
            </svg>
            <span>系統設定</span>
          </a>
        </ng-container>
      </nav>

      <!-- Account Switcher & User Footer -->
      <div class="sidebar-footer">
        <div class="quick-switch">
          <label>切換體驗帳號：</label>
          <select (change)="onSwitchUser($event)" [value]="auth.currentUser()?.login">
            <option value="admin">admin (系統管理員)</option>
            <option value="user1">user1 (7A 護理長)</option>
            <option value="user2">user2 (ICU 護理長)</option>
            <option value="nurse1">nurse1 (張佩芬 N3)</option>
            <option value="nurse2">nurse2 (王美玲 N3)</option>
            <option value="nurse5">nurse5 (郭欣儒 妊娠)</option>
          </select>
        </div>

        <div class="user-card" *ngIf="auth.currentUser() as user">
          <div class="user-avatar">
            {{ user.display_name.charAt(0) }}
          </div>
          <div class="user-details">
            <div class="user-name">{{ user.display_name }}</div>
            <div class="user-meta">
              <span class="role-badge" [ngClass]="user.role">
                {{ user.role === 'A' ? '管理員' : user.role === 'H' ? '護理長' : '護理人員' }}
              </span>
              <span *ngIf="getUnitName(user.unit_id)" class="unit-badge">
                {{ getUnitName(user.unit_id) }}
              </span>
            </div>
          </div>
        </div>

        <div class="user-actions">
          <button class="action-btn" (click)="showPasswordModal.set(true)" title="修改密碼">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
              <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
            </svg>
            <span>改密碼</span>
          </button>
          <button class="action-btn logout-btn" (click)="auth.logout()" title="登出系統">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path>
              <polyline points="16 17 21 12 16 7"></polyline>
              <line x1="21" y1="12" x2="9" y2="12"></line>
            </svg>
            <span>登出</span>
          </button>
        </div>
      </div>
    </aside>

    <app-password-modal *ngIf="showPasswordModal()" (close)="showPasswordModal.set(false)" />
  `,
  styles: [`
    .sidebar {
      width: 250px;
      min-width: 250px;
      background: #0f172a;
      color: #cbd5e1;
      display: flex;
      flex-direction: column;
      height: 100vh;
      border-right: 1px solid #1e293b;
    }

    .sidebar-brand {
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 20px 18px;
      border-bottom: 1px solid #1e293b;

      .brand-icon {
        width: 40px;
        height: 40px;
        background: linear-gradient(135deg, #0284c7, #0d9488);
        border-radius: 10px;
        display: flex;
        align-items: center;
        justify-content: center;
        color: #fff;
        box-shadow: 0 4px 10px rgba(2, 132, 199, 0.4);
      }

      .brand-title {
        font-size: 1.05rem;
        font-weight: 700;
        color: #f8fafc;
        letter-spacing: -0.02em;
      }

      .brand-subtitle {
        font-size: 0.72rem;
        color: #94a3b8;
      }
    }

    .sidebar-nav {
      flex: 1;
      overflow-y: auto;
      padding: 16px 10px;
      display: flex;
      flex-direction: column;
      gap: 4px;
    }

    .nav-item {
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 10px 14px;
      border-radius: 8px;
      color: #94a3b8;
      font-size: 0.88rem;
      font-weight: 500;
      transition: all 0.15s ease;

      &:hover {
        background: #1e293b;
        color: #f1f5f9;
      }

      &.active {
        background: #0284c7;
        color: #fff;
        box-shadow: 0 2px 8px rgba(2, 132, 199, 0.4);
      }
    }

    .sidebar-footer {
      padding: 14px 16px;
      border-top: 1px solid #1e293b;
      background: #0a0f1d;
    }

    .quick-switch {
      margin-bottom: 12px;
      label {
        font-size: 0.72rem;
        color: #64748b;
        display: block;
        margin-bottom: 4px;
      }
      select {
        width: 100%;
        background: #1e293b;
        color: #e2e8f0;
        border: 1px solid #334155;
        border-radius: 6px;
        padding: 5px 8px;
        font-size: 0.78rem;
      }
    }

    .user-card {
      display: flex;
      align-items: center;
      gap: 10px;
      margin-bottom: 10px;

      .user-avatar {
        width: 34px;
        height: 34px;
        background: #334155;
        color: #f8fafc;
        border-radius: 50%;
        display: flex;
        align-items: center;
        justify-content: center;
        font-weight: 600;
        font-size: 0.85rem;
      }

      .user-details {
        overflow: hidden;
      }

      .user-name {
        font-size: 0.84rem;
        font-weight: 600;
        color: #f8fafc;
        white-space: nowrap;
        text-overflow: ellipsis;
        overflow: hidden;
      }

      .user-meta {
        display: flex;
        align-items: center;
        gap: 6px;
        margin-top: 2px;
      }

      .role-badge {
        font-size: 0.68rem;
        padding: 1px 6px;
        border-radius: 4px;
        font-weight: 600;

        &.A { background: #7c3aed; color: #fff; }
        &.H { background: #0284c7; color: #fff; }
        &.N { background: #0d9488; color: #fff; }
      }

      .unit-badge {
        font-size: 0.68rem;
        color: #94a3b8;
      }
    }

    .user-actions {
      display: flex;
      gap: 8px;

      .action-btn {
        flex: 1;
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 6px;
        padding: 6px 8px;
        background: #1e293b;
        color: #94a3b8;
        border-radius: 6px;
        font-size: 0.75rem;

        &:hover {
          background: #334155;
          color: #f1f5f9;
        }

        &.logout-btn:hover {
          background: #ef4444;
          color: #fff;
        }
      }
    }
  `],
})
export class SidebarComponent {
  auth = inject(AuthService);
  private dataService = inject(DataService);
  showPasswordModal = signal(false);

  getUnitName(unitId: number | null): string {
    if (!unitId) return '';
    const unit = this.dataService.units().find((u) => u.unit_id === unitId);
    return unit ? unit.code : '';
  }

  onSwitchUser(event: Event): void {
    const val = (event.target as HTMLSelectElement).value;
    if (val) {
      this.auth.switchAccount(val);
    }
  }
}
