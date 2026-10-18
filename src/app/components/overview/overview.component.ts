import { Component, inject, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { DataService } from '../../services/data.service';
import { AuthService } from '../../services/auth.service';

@Component({
  selector: 'app-overview',
  standalone: true,
  imports: [CommonModule, RouterModule],
  template: `
    <div class="page-container">
      <!-- Welcome Hero Banner -->
      <div class="hero-card">
        <div class="hero-content">
          <div class="greeting-badge">排班管理總覽</div>
          <h2>歡迎回來，{{ auth.currentUser()?.display_name }}</h2>
          <p>
            本月為 2026 年 10 月。系統已自動套用衛生福利部《合理護理排班指引》與勞動基準法第 30、34、36、49 條規範。
          </p>
        </div>
        <div class="hero-actions">
          <a routerLink="/schedule" class="btn btn-primary">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect>
              <line x1="16" y1="2" x2="16" y2="6"></line>
              <line x1="8" y1="2" x2="8" y2="6"></line>
              <line x1="3" y1="10" x2="21" y2="10"></line>
            </svg>
            進入班表作業
          </a>
          <a routerLink="/leaves" class="btn btn-secondary">
            審核休假 ({{ pendingLeavesCount() }})
          </a>
        </div>
      </div>

      <!-- Quick Metrics Cards -->
      <div class="metrics-grid">
        <div class="metric-card">
          <div class="metric-icon blue">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
              <circle cx="9" cy="7" r="4"></circle>
            </svg>
          </div>
          <div class="metric-info">
            <div class="metric-value">{{ totalNursesCount() }} 人</div>
            <div class="metric-label">全院在職護理人員</div>
          </div>
        </div>

        <div class="metric-card">
          <div class="metric-icon green">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
              <polyline points="22 4 12 14.01 9 11.01"></polyline>
            </svg>
          </div>
          <div class="metric-info">
            <div class="metric-value">{{ activeUnitsCount() }} 個單位</div>
            <div class="metric-label">運作中護理單位</div>
          </div>
        </div>

        <div class="metric-card">
          <div class="metric-icon amber">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
              <line x1="16" y1="13" x2="8" y2="13"></line>
            </svg>
          </div>
          <div class="metric-info">
            <div class="metric-value">{{ pendingLeavesCount() }} 件</div>
            <div class="metric-label">待審核休假申請</div>
          </div>
        </div>

        <div class="metric-card">
          <div class="metric-icon purple">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M16 3h5v5"></path>
              <path d="M4 20L21 3"></path>
            </svg>
          </div>
          <div class="metric-info">
            <div class="metric-value">{{ pendingSwapsCount() }} 件</div>
            <div class="metric-label">待處理換班申請</div>
          </div>
        </div>
      </div>

      <!-- Unit Overview Grid -->
      <div class="card">
        <div class="card-header">
          <h3>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path>
            </svg>
            各單位排班與人力狀態摘要
          </h3>
          <span class="badge badge-primary">2026 年 10 月</span>
        </div>

        <div class="units-grid">
          <div class="unit-box" *ngFor="let u of units()">
            <div class="unit-box-header">
              <div>
                <span class="badge badge-neutral" style="margin-right: 6px;">{{ u.code }}</span>
                <strong>{{ u.name }}</strong>
              </div>
              <span class="badge" [ngClass]="getScheduleStatusClass(u.unit_id)">
                {{ getScheduleStatusLabel(u.unit_id) }}
              </span>
            </div>

            <div class="unit-details-list">
              <div class="detail-row">
                <span>登記床位數：</span>
                <strong>{{ u.beds }} 床</strong>
              </div>
              <div class="detail-row">
                <span>在職人員數：</span>
                <strong>{{ getUnitNurseCount(u.unit_id) }} 位護理人員</strong>
              </div>
              <div class="detail-row">
                <span>工時制度：</span>
                <strong>{{ getWorkTimeSystemName(u.work_time_system) }}</strong>
              </div>
              <div class="detail-row">
                <span>排班品質評分：</span>
                <span class="score-text">{{ getScheduleQuality(u.unit_id) }}</span>
              </div>
            </div>

            <div class="unit-box-footer">
              <a [routerLink]="['/schedule']" [queryParams]="{ unitId: u.unit_id }" class="btn btn-outline-primary btn-sm">
                查看班表
              </a>
              <a [routerLink]="['/units']" class="btn btn-secondary btn-sm">
                單位設定
              </a>
            </div>
          </div>
        </div>
      </div>

      <!-- Labor Law & Protection Notice Banner -->
      <div class="card" style="background: #fdfbf7; border-color: #fde68a;">
        <div class="card-header" style="border-color: #fef08a;">
          <h3 style="color: #92400e;">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path>
            </svg>
            勞動基準法排班合規重點防護機制
          </h3>
        </div>
        <div class="law-protection-grid">
          <div class="protection-item">
            <strong>§34 連續休息 11 小時保障</strong>
            <p>嚴格限制更換班次時應有連續 11 小時以上之休息時間，系統杜絕「夜接白」違規情事。</p>
          </div>
          <div class="protection-item">
            <strong>§49 妊娠與哺乳同仁夜間工作禁止</strong>
            <p>依法嚴格禁止妊娠或哺乳期間（產後一年內）女性同仁排入 22:00～06:00 夜間工作。</p>
          </div>
          <div class="protection-item">
            <strong>§36 四週彈性例假與休息日</strong>
            <p>四週內至少應有 4 日例假、4 日休息日，且每 2 週內至少應有 2 日例假，連續上班不得逾 6 日。</p>
          </div>
          <div class="protection-item">
            <strong>§30-1 單日與週期工時限制</strong>
            <p>四週彈性工時每日正常工時不得超過 10 小時，全月排定工時上限依規檢核。</p>
          </div>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .hero-card {
      background: linear-gradient(135deg, #0284c7 0%, #0369a1 100%);
      color: #fff;
      border-radius: 14px;
      padding: 28px;
      margin-bottom: 24px;
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 24px;
      box-shadow: 0 10px 25px -5px rgba(2, 132, 199, 0.3);

      .greeting-badge {
        display: inline-block;
        background: rgba(255, 255, 255, 0.2);
        padding: 4px 10px;
        border-radius: 9999px;
        font-size: 0.75rem;
        font-weight: 600;
        margin-bottom: 8px;
      }

      h2 {
        font-size: 1.5rem;
        font-weight: 700;
        margin-bottom: 6px;
      }

      p {
        font-size: 0.88rem;
        opacity: 0.9;
        max-width: 600px;
        line-height: 1.5;
      }

      .hero-actions {
        display: flex;
        gap: 12px;
        flex-shrink: 0;

        .btn-primary {
          background: #ffffff;
          color: #0284c7;
          font-weight: 600;
          &:hover {
            background: #f0f9ff;
          }
        }

        .btn-secondary {
          background: rgba(255, 255, 255, 0.15);
          color: #fff;
          border-color: rgba(255, 255, 255, 0.3);
          &:hover {
            background: rgba(255, 255, 255, 0.25);
          }
        }
      }
    }

    .metrics-grid {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 16px;
      margin-bottom: 24px;

      .metric-card {
        background: #fff;
        border: 1px solid var(--border-color);
        border-radius: 12px;
        padding: 18px;
        display: flex;
        align-items: center;
        gap: 16px;
        box-shadow: 0 1px 3px rgba(0, 0, 0, 0.04);

        .metric-icon {
          width: 48px;
          height: 48px;
          border-radius: 12px;
          display: flex;
          align-items: center;
          justify-content: center;

          &.blue { background: #e0f2fe; color: #0284c7; }
          &.green { background: #d1fae5; color: #059669; }
          &.amber { background: #fef3c7; color: #d97706; }
          &.purple { background: #ede9fe; color: #7c3aed; }
        }

        .metric-value {
          font-size: 1.35rem;
          font-weight: 700;
          color: #0f172a;
          line-height: 1.2;
        }

        .metric-label {
          font-size: 0.8rem;
          color: #64748b;
          margin-top: 2px;
        }
      }
    }

    .units-grid {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 16px;

      .unit-box {
        border: 1px solid var(--border-color);
        border-radius: 10px;
        padding: 16px;
        background: #fafafa;
        display: flex;
        flex-direction: column;
        justify-content: space-between;

        .unit-box-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 12px;
          padding-bottom: 8px;
          border-bottom: 1px solid #f1f5f9;
        }

        .unit-details-list {
          display: flex;
          flex-direction: column;
          gap: 6px;
          font-size: 0.85rem;
          margin-bottom: 16px;

          .detail-row {
            display: flex;
            justify-content: space-between;
            color: #475569;
          }

          .score-text {
            font-weight: 700;
            color: #059669;
          }
        }

        .unit-box-footer {
          display: flex;
          gap: 8px;
        }
      }
    }

    .law-protection-grid {
      display: grid;
      grid-template-columns: repeat(2, 1fr);
      gap: 16px;

      .protection-item {
        background: #fff;
        padding: 14px;
        border-radius: 8px;
        border: 1px solid #fef3c7;

        strong {
          display: block;
          font-size: 0.88rem;
          color: #92400e;
          margin-bottom: 4px;
        }

        p {
          font-size: 0.8rem;
          color: #78350f;
          line-height: 1.4;
        }
      }
    }
  `],
})
export class OverviewComponent {
  auth = inject(AuthService);
  private dataService = inject(DataService);

  units = computed(() => this.dataService.units());

  totalNursesCount = computed(() => this.dataService.nurses().filter((n) => n.is_active).length);
  activeUnitsCount = computed(() => this.dataService.units().length);
  pendingLeavesCount = computed(() => this.dataService.leaveRequests().filter((r) => r.status === 'P').length);
  pendingSwapsCount = computed(() => this.dataService.swapRequests().filter((s) => s.status === 'P' || s.status === 'G').length);

  getUnitNurseCount(unitId: number): number {
    return this.dataService.nurses().filter((n) => n.unit_id === unitId && n.is_active).length;
  }

  getWorkTimeSystemName(sys: string): string {
    switch (sys) {
      case 'G': return '一般工時 (8h/日, 40h/週)';
      case '2': return '二週彈性工時';
      case '4': return '四週彈性工時 (護理常用)';
      case '8': return '八週彈性工時';
      default: return '四週彈性工時';
    }
  }

  getScheduleStatusLabel(unitId: number): string {
    const s = this.dataService.schedules().find((sc) => sc.unit_id === unitId && sc.year === 2026 && sc.month === 10);
    if (!s) return '尚未排班';
    if (s.status === 'D') return '草稿編排中';
    if (s.status === 'P') return '已正式公布';
    return '已結案唯讀';
  }

  getScheduleStatusClass(unitId: number): string {
    const s = this.dataService.schedules().find((sc) => sc.unit_id === unitId && sc.year === 2026 && sc.month === 10);
    if (!s) return 'badge-neutral';
    if (s.status === 'D') return 'badge-warning';
    if (s.status === 'P') return 'badge-success';
    return 'badge-purple';
  }

  getScheduleQuality(unitId: number): string {
    const s = this.dataService.schedules().find((sc) => sc.unit_id === unitId && sc.year === 2026 && sc.month === 10);
    if (!s) return '無評分';
    return `${s.quality_score} 分 (${s.hard_count === 0 ? '無必須修正' : s.hard_count + ' 處待修'})`;
  }
}
