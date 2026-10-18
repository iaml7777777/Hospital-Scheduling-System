import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AuthService } from '../../../services/auth.service';
import { DataService } from '../../../services/data.service';

@Component({
  selector: 'app-header',
  standalone: true,
  imports: [CommonModule],
  template: `
    <header class="header">
      <div class="header-left">
        <div class="page-title-group">
          <h1 class="page-title">智慧護理排班系統</h1>
          <span class="system-status-pill">
            <span class="status-dot"></span>
            勞基法合規檢核已啟用
          </span>
        </div>
      </div>

      <div class="header-right">
        <!-- Current Unit Tag -->
        <div class="unit-tag" *ngIf="currentUnitName()">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path>
          </svg>
          <span>所屬單位：{{ currentUnitName() }}</span>
        </div>

        <!-- Today Date Badge -->
        <div class="date-badge">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect>
            <line x1="16" y1="2" x2="16" y2="6"></line>
            <line x1="8" y1="2" x2="8" y2="6"></line>
            <line x1="3" y1="10" x2="21" y2="10"></line>
          </svg>
          <span>{{ todayFormatted }}</span>
        </div>

        <!-- Reset Seed Data Button -->
        <button class="btn btn-sm btn-secondary" (click)="resetDemoData()" title="重置回初始示範資料">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <polyline points="1 4 1 10 7 10"></polyline>
            <polyline points="23 20 23 14 17 14"></polyline>
            <path d="M20.49 9A9 9 0 0 0 5.64 5.64L1 10m22 4l-4.64 4.36A9 9 0 0 1 3.51 15"></path>
          </svg>
          <span>重設示範資料</span>
        </button>
      </div>
    </header>
  `,
  styles: [`
    .header {
      height: 60px;
      background: #ffffff;
      border-bottom: 1px solid var(--border-color);
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 0 24px;
      z-index: 10;
    }

    .header-left {
      display: flex;
      align-items: center;
    }

    .page-title-group {
      display: flex;
      align-items: center;
      gap: 12px;

      .page-title {
        font-size: 1.15rem;
        font-weight: 700;
        color: var(--text-main);
      }

      .system-status-pill {
        display: inline-flex;
        align-items: center;
        gap: 6px;
        background: #f0fdf4;
        color: #15803d;
        border: 1px solid #bbf7d0;
        padding: 3px 8px;
        border-radius: 9999px;
        font-size: 0.75rem;
        font-weight: 500;

        .status-dot {
          width: 6px;
          height: 6px;
          border-radius: 50%;
          background: #22c55e;
          box-shadow: 0 0 0 2px rgba(34, 197, 94, 0.25);
        }
      }
    }

    .header-right {
      display: flex;
      align-items: center;
      gap: 14px;
    }

    .unit-tag {
      display: flex;
      align-items: center;
      gap: 6px;
      font-size: 0.82rem;
      font-weight: 600;
      color: #0284c7;
      background: #f0f9ff;
      border: 1px solid #bae6fd;
      padding: 5px 10px;
      border-radius: 6px;
    }

    .date-badge {
      display: flex;
      align-items: center;
      gap: 6px;
      font-size: 0.82rem;
      color: #64748b;
      background: #f8fafc;
      border: 1px solid var(--border-color);
      padding: 5px 10px;
      border-radius: 6px;
    }
  `],
})
export class HeaderComponent {
  auth = inject(AuthService);
  private dataService = inject(DataService);

  todayFormatted = new Intl.DateTimeFormat('zh-TW', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    weekday: 'long',
  }).format(new Date());

  currentUnitName(): string {
    const user = this.auth.currentUser();
    if (!user) return '';
    if (user.role === 'A') return '全院所有單位 (系統管理員)';
    const unit = this.dataService.units().find((u) => u.unit_id === user.unit_id);
    return unit ? `${unit.code} - ${unit.name}` : '';
  }

  resetDemoData(): void {
    if (confirm('確定要重設為初始示範資料嗎？所有已修改的班表與設定將會還原。')) {
      this.dataService.resetToDefaults();
      alert('已成功重設為初始示範資料！');
      window.location.reload();
    }
  }
}
