import { Component, inject, OnInit, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { DataService } from '../../services/data.service';
import { AuthService } from '../../services/auth.service';
import { SchedulerService } from '../../services/scheduler.service';
import { RuleCheckerService, CheckResult } from '../../services/rule-checker.service';
import { ExportService } from '../../services/export.service';
import {
  Unit,
  Shift,
  Nurse,
  Schedule,
  ScheduleCell,
  Violation,
  OffType,
} from '../../models/schedule.models';

@Component({
  selector: 'app-schedule-view',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="page-container">
      <!-- Toolbar & Filters -->
      <div class="card" style="margin-bottom: 16px; padding: 16px 20px;">
        <div class="toolbar-wrapper">
          <div class="filter-controls">
            <!-- Unit Selection -->
            <div class="control-item">
              <label>護理單位：</label>
              <select [(ngModel)]="selectedUnitId" (change)="onUnitOrDateChange()" [disabled]="!auth.isAdmin()">
                <option *ngFor="let u of units()" [value]="u.unit_id">{{ u.code }} - {{ u.name }}</option>
              </select>
            </div>

            <!-- Year Selection -->
            <div class="control-item">
              <label>年份：</label>
              <select [(ngModel)]="selectedYear" (change)="onUnitOrDateChange()">
                <option [value]="2026">2026 年</option>
                <option [value]="2027">2027 年</option>
              </select>
            </div>

            <!-- Month Selection -->
            <div class="control-item">
              <label>月份：</label>
              <select [(ngModel)]="selectedMonth" (change)="onUnitOrDateChange()">
                <option *ngFor="let m of [1,2,3,4,5,6,7,8,9,10,11,12]" [value]="m">{{ m }} 月</option>
              </select>
            </div>

            <!-- Pin retention checkbox -->
            <div class="control-checkbox">
              <label>
                <input type="checkbox" [(ngModel)]="keepPinned" />
                <span>排班時保留釘選格</span>
              </label>
            </div>
          </div>

          <!-- Schedule Actions -->
          <div class="action-buttons">
            <!-- Start / Re-schedule button -->
            <button
              class="btn btn-primary"
              (click)="onAutoSchedule()"
              [disabled]="currentSchedule()?.status === 'C' || isSolving"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <polygon points="5 3 19 12 5 21 5 3"></polygon>
              </svg>
              <span>{{ hasCells() ? '重新自動排班' : '開始自動排班' }}</span>
            </button>

            <!-- Re-check rules only -->
            <button
              class="btn btn-secondary"
              (click)="onRecheck()"
              [disabled]="!hasCells()"
              title="不改班，以現行規則重新檢核"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
                <polyline points="22 4 12 14.01 9 11.01"></polyline>
              </svg>
              <span>重新檢核</span>
            </button>

            <!-- Publish Schedule -->
            <button
              *ngIf="currentSchedule()?.status === 'D'"
              class="btn btn-success"
              (click)="onPublish()"
              [disabled]="!canPublish()"
              [title]="canPublish() ? '公布班表供人員查看' : '必須修正違規數需為 0 才可公布'"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <circle cx="12" cy="12" r="10"></circle>
                <line x1="2" y1="12" x2="22" y2="12"></line>
                <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"></path>
              </svg>
              <span>公布班表</span>
            </button>

            <!-- Rollback to Draft -->
            <button
              *ngIf="currentSchedule()?.status === 'P'"
              class="btn btn-warning"
              (click)="onRollbackDraft()"
            >
              退回草稿
            </button>

            <!-- Close Schedule -->
            <button
              *ngIf="currentSchedule()?.status === 'P'"
              class="btn btn-secondary"
              (click)="onCloseSchedule()"
            >
              月底結案
            </button>

            <!-- Export CSV -->
            <button
              class="btn btn-outline-primary"
              (click)="onExportCsv()"
              [disabled]="!hasCells()"
              title="匯出符合 Excel 中文編碼之 CSV 報表"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                <polyline points="7 10 12 15 17 10"></polyline>
                <line x1="12" y1="15" x2="12" y2="3"></line>
              </svg>
              <span>匯出 CSV</span>
            </button>
          </div>
        </div>
      </div>

      <!-- 4 Core Indicators & Status Banner -->
      <div class="metrics-grid">
        <!-- Must Fix (Hard count) -->
        <div class="metric-card" [class.danger-border]="hardCount() > 0">
          <div class="metric-icon" [ngClass]="hardCount() > 0 ? 'red' : 'green'">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <circle cx="12" cy="12" r="10"></circle>
              <line x1="12" y1="8" x2="12" y2="12"></line>
              <line x1="12" y1="16" x2="12.01" y2="16"></line>
            </svg>
          </div>
          <div class="metric-info">
            <div class="metric-value" [style.color]="hardCount() > 0 ? 'var(--danger)' : 'var(--success)'">
              {{ hardCount() }} 件
            </div>
            <div class="metric-label">必須修正 (硬性規則/法規)</div>
          </div>
        </div>

        <!-- Suggestions (Soft count) -->
        <div class="metric-card">
          <div class="metric-icon amber">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path>
              <line x1="12" y1="9" x2="12" y2="13"></line>
              <line x1="12" y1="17" x2="12.01" y2="17"></line>
            </svg>
          </div>
          <div class="metric-info">
            <div class="metric-value">{{ softCount() }} 件</div>
            <div class="metric-label">建議調整 (軟性規則/公平度)</div>
          </div>
        </div>

        <!-- Quality Score -->
        <div class="metric-card">
          <div class="metric-icon purple">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon>
            </svg>
          </div>
          <div class="metric-info">
            <div class="metric-value">{{ qualityScore() }} 分</div>
            <div class="metric-label">班表品質指數</div>
          </div>
        </div>

        <!-- Nurses count & Status -->
        <div class="metric-card">
          <div class="metric-icon blue">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
              <circle cx="9" cy="7" r="4"></circle>
            </svg>
          </div>
          <div class="metric-info">
            <div class="metric-value">{{ unitNurses().length }} 人</div>
            <div class="metric-label">
              狀態：
              <span class="badge" [ngClass]="scheduleStatusBadge()">{{ scheduleStatusText() }}</span>
            </div>
          </div>
        </div>
      </div>

      <!-- Main Schedule Grid Table -->
      <div class="card" style="padding: 12px; margin-bottom: 20px;">
        <div class="grid-legend">
          <div class="legend-items">
            <span class="legend-title">班別圖例：</span>
            <span *ngFor="let s of unitShifts()" class="legend-badge" [style.background]="s.color">
              {{ s.code }} ({{ s.name }} {{ s.start_time }}-{{ s.end_time }})
            </span>
            <span class="legend-badge" style="background: #94a3b8;">
              休 (R:例假 / S:休息日 / H:國假 / A:特休)
            </span>
            <span class="legend-desc">
              <span class="legend-dot-pin"></span> 釘選格子
            </span>
            <span class="legend-desc" style="color: var(--danger); font-weight: 600;">
              [紅框] 違規項目
            </span>
          </div>
          <div class="grid-tip">💡 點擊任何格子可手動調整班別或釘選</div>
        </div>

        <!-- Matrix Container -->
        <div class="matrix-container" *ngIf="hasCells(); else emptyGrid">
          <table class="schedule-matrix">
            <thead>
              <tr>
                <th class="sticky-col">護理人員 ({{ unitNurses().length }})</th>
                <th
                  *ngFor="let day of daysArray()"
                  [class.col-weekend]="isWeekend(day)"
                  [class.col-holiday]="isHoliday(day)"
                >
                  <div class="day-num">{{ day }}</div>
                  <div class="day-name">{{ getWeekdayName(day) }}</div>
                </th>
                <th>上班</th>
                <th>休假</th>
                <th>夜班</th>
                <th>總工時</th>
                <th>最長連上</th>
              </tr>
            </thead>
            <tbody>
              <tr *ngFor="let nurse of unitNurses()">
                <!-- Sticky Nurse Column -->
                <td class="sticky-col">
                  <div class="nurse-row-header">
                    <div class="nurse-name-box">
                      <span class="nurse-name">{{ nurse.name }}</span>
                      <span class="nurse-emp">#{{ nurse.emp_no }}</span>
                    </div>
                    <div class="nurse-tags">
                      <span class="nurse-level-tag">{{ nurse.level }}</span>
                      <span *ngIf="nurse.can_lead" class="lead-tag" title="可帶班資深人員">資深</span>
                      <span *ngIf="!nurse.can_night" class="no-night-tag" title="不可排夜班">無夜</span>
                    </div>
                  </div>
                </td>

                <!-- Day Cells -->
                <td
                  *ngFor="let day of daysArray()"
                  class="grid-cell"
                  [class.col-weekend]="isWeekend(day)"
                  [class.col-holiday]="isHoliday(day)"
                  [class.has-violation]="hasViolation(nurse.nurse_id, day)"
                  (click)="openCellModal(nurse, day)"
                >
                  <!-- Pin Indicator Dot -->
                  <span *ngIf="isCellPinned(nurse.nurse_id, day)" class="cell-pin-dot" title="已釘選保留"></span>

                  <!-- Shift / Off Display -->
                  <ng-container *ngIf="getCellShift(nurse.nurse_id, day) as shift; else offBlock">
                    <span class="shift-badge" [style.background]="shift.color">
                      {{ shift.code }}
                    </span>
                  </ng-container>
                  <ng-template #offBlock>
                    <span class="off-badge">
                      {{ getCellOffLabel(nurse.nurse_id, day) }}
                    </span>
                  </ng-template>
                </td>

                <!-- Nurse Stats Columns -->
                <td><strong>{{ getNurseStat(nurse.nurse_id, 'workDays') }}</strong></td>
                <td>{{ getNurseStat(nurse.nurse_id, 'offDays') }}</td>
                <td>
                  <span [style.color]="getNurseStat(nurse.nurse_id, 'nightShifts') > 10 ? 'var(--danger)' : 'inherit'">
                    {{ getNurseStat(nurse.nurse_id, 'nightShifts') }}
                  </span>
                </td>
                <td>{{ getNurseStat(nurse.nurse_id, 'totalHours') }}h</td>
                <td>
                  <span [style.color]="getNurseStat(nurse.nurse_id, 'maxConsecutive') > 6 ? 'var(--danger)' : 'inherit'">
                    {{ getNurseStat(nurse.nurse_id, 'maxConsecutive') }} 天
                  </span>
                </td>
              </tr>

              <!-- Daily Staffing Demand vs Actual Footer Rows -->
              <tr *ngFor="let shift of unitShifts()" class="staffing-stat-row">
                <td class="sticky-col stat-header">
                  <span class="shift-mini-dot" [style.background]="shift.color"></span>
                  {{ shift.name }} 實到 / 需求
                </td>
                <td
                  *ngFor="let day of daysArray()"
                  [class.shortage-cell]="isDailyShiftShortage(shift.shift_id, day)"
                >
                  <span class="stat-actual">{{ getDailyShiftActual(shift.shift_id, day) }}</span>
                  <span class="stat-sep">/</span>
                  <span class="stat-req">{{ getDailyShiftRequired(shift.shift_id, day) }}</span>
                </td>
                <td colspan="5" style="background: #f8fafc;"></td>
              </tr>
            </tbody>
          </table>
        </div>

        <ng-template #emptyGrid>
          <div class="empty-state">
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" stroke-width="1.5">
              <rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect>
              <line x1="16" y1="2" x2="16" y2="6"></line>
              <line x1="8" y1="2" x2="8" y2="6"></line>
              <line x1="3" y1="10" x2="21" y2="10"></line>
            </svg>
            <h3>尚未產生當月份班表</h3>
            <p>請點擊上方「開始自動排班」按鈕，系統將自動套用最佳化演算法產生符合法規之班表。</p>
            <button class="btn btn-primary" (click)="onAutoSchedule()">開始自動排班</button>
          </div>
        </ng-template>
      </div>

      <!-- Violations & Suggestions Panel -->
      <div class="card" *ngIf="violations().length > 0">
        <div class="card-header">
          <h3>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <circle cx="12" cy="12" r="10"></circle>
              <line x1="12" y1="8" x2="12" y2="12"></line>
              <line x1="12" y1="16" x2="12.01" y2="16"></line>
            </svg>
            排班檢核結果清單 (共 {{ violations().length }} 項)
          </h3>
          <span class="badge badge-neutral">按規則扣分排序</span>
        </div>

        <div class="violations-list">
          <div
            *ngFor="let v of violations()"
            class="violation-row"
            [ngClass]="v.severity === 'H' ? 'viol-hard' : 'viol-soft'"
          >
            <div class="viol-badge-col">
              <span class="badge" [ngClass]="v.severity === 'H' ? 'badge-danger' : 'badge-warning'">
                {{ v.severity === 'H' ? '必須修正' : '建議調整' }}
              </span>
              <span class="rule-code-badge">{{ v.rule_code }}</span>
            </div>

            <div class="viol-content-col">
              <div class="viol-message">{{ v.message }}</div>
              <div class="viol-sub" *ngIf="v.law_ref">
                <span class="law-tag">法條依據：{{ v.law_ref }}</span>
              </div>
            </div>

            <div class="viol-penalty-col">
              <span class="penalty-tag">-{{ v.penalty }} 分</span>
            </div>
          </div>
        </div>
      </div>

      <!-- UI-04a Cell Edit Popover / Modal -->
      <div class="modal-overlay" *ngIf="editingCell()" (click)="closeCellModal()">
        <div class="modal-content" (click)="$event.stopPropagation()">
          <div class="card-header">
            <h3>
              調整班別格：{{ editingNurse()?.name }} ({{ editingCell()?.work_date }})
            </h3>
            <button class="btn btn-sm" (click)="closeCellModal()">✕</button>
          </div>

          <form (ngSubmit)="saveCellModal()">
            <div class="form-group">
              <label>指定班別或休假：</label>
              <div class="shift-options-grid">
                <!-- Option Off -->
                <label class="shift-option" [class.selected]="tempShiftId === null">
                  <input type="radio" [value]="null" [(ngModel)]="tempShiftId" name="shiftOpt" />
                  <span class="opt-label">休假 (OFF)</span>
                </label>

                <!-- Shifts -->
                <label
                  *ngFor="let s of unitShifts()"
                  class="shift-option"
                  [class.selected]="tempShiftId === s.shift_id"
                  [style.border-color]="tempShiftId === s.shift_id ? s.color : '#e2e8f0'"
                >
                  <input type="radio" [value]="s.shift_id" [(ngModel)]="tempShiftId" name="shiftOpt" />
                  <span class="shift-mini-dot" [style.background]="s.color"></span>
                  <span class="opt-label">{{ s.code }} ({{ s.name }})</span>
                </label>
              </div>
            </div>

            <!-- Off Type if off selected -->
            <div class="form-group" *ngIf="tempShiftId === null">
              <label>休假類型 (勞基法標註假別)：</label>
              <select [(ngModel)]="tempOffType" name="offType">
                <option value="R">例假 (法定強制)</option>
                <option value="S">休息日</option>
                <option value="H">國定假日</option>
                <option value="A">特別休假 (特休)</option>
                <option value="O">其他假別 (婚、喪、病、事假等)</option>
              </select>
            </div>

            <!-- Pinning Checkbox -->
            <div class="form-group">
              <label style="display: flex; align-items: center; gap: 8px; cursor: pointer;">
                <input type="checkbox" [(ngModel)]="tempIsPinned" name="isPinned" />
                <strong>釘選此格子 (重新排班時保持不動)</strong>
              </label>
            </div>

            <!-- Emergency Reason (FR-35, 勞基法 §40) -->
            <div class="form-group">
              <label>因天災、突發事件出勤理由 (選填，供 §40 報請主管機關核備)：</label>
              <input type="text" [(ngModel)]="tempEmergencyReason" name="emergencyReason" placeholder="例如: 颱風天大量傷患緊急動員" />
            </div>

            <div style="display: flex; justify-content: flex-end; gap: 10px; margin-top: 20px;">
              <button type="button" class="btn btn-secondary" (click)="closeCellModal()">取消</button>
              <button type="submit" class="btn btn-primary">儲存並即時檢核</button>
            </div>
          </form>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .toolbar-wrapper {
      display: flex;
      justify-content: space-between;
      align-items: center;
      flex-wrap: wrap;
      gap: 16px;
    }

    .filter-controls {
      display: flex;
      align-items: center;
      gap: 14px;
      flex-wrap: wrap;

      .control-item {
        display: flex;
        align-items: center;
        gap: 6px;

        label {
          font-size: 0.85rem;
          font-weight: 500;
          color: #475569;
        }

        select {
          padding: 6px 10px;
          border-radius: 6px;
          border: 1px solid var(--border-color);
          background: #fff;
          font-size: 0.85rem;
        }
      }

      .control-checkbox {
        display: flex;
        align-items: center;
        font-size: 0.85rem;
        color: #334155;
        cursor: pointer;
        user-select: none;

        label {
          display: flex;
          align-items: center;
          gap: 6px;
          cursor: pointer;
        }
      }
    }

    .action-buttons {
      display: flex;
      align-items: center;
      gap: 8px;
      flex-wrap: wrap;
    }

    .metrics-grid {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 14px;
      margin-bottom: 16px;

      .metric-card {
        background: #fff;
        border: 1px solid var(--border-color);
        border-radius: 10px;
        padding: 14px 18px;
        display: flex;
        align-items: center;
        gap: 14px;

        &.danger-border {
          border-color: var(--danger);
          background: #fffbfa;
        }

        .metric-icon {
          width: 44px;
          height: 44px;
          border-radius: 10px;
          display: flex;
          align-items: center;
          justify-content: center;

          &.red { background: #fee2e2; color: #dc2626; }
          &.green { background: #d1fae5; color: #059669; }
          &.amber { background: #fef3c7; color: #d97706; }
          &.purple { background: #ede9fe; color: #7c3aed; }
          &.blue { background: #e0f2fe; color: #0284c7; }
        }

        .metric-value {
          font-size: 1.25rem;
          font-weight: 700;
          line-height: 1.2;
        }

        .metric-label {
          font-size: 0.78rem;
          color: #64748b;
          margin-top: 2px;
        }
      }
    }

    .grid-legend {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 6px 8px 12px 8px;
      font-size: 0.8rem;
      flex-wrap: wrap;
      gap: 10px;

      .legend-items {
        display: flex;
        align-items: center;
        gap: 8px;
        flex-wrap: wrap;
      }

      .legend-badge {
        color: #fff;
        padding: 2px 8px;
        border-radius: 4px;
        font-size: 0.75rem;
        font-weight: 600;
      }

      .legend-dot-pin {
        display: inline-block;
        width: 8px;
        height: 8px;
        border-radius: 50%;
        background: var(--purple);
      }

      .grid-tip {
        color: #0284c7;
        font-weight: 500;
      }
    }

    .nurse-row-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 6px;

      .nurse-name-box {
        display: flex;
        flex-direction: column;

        .nurse-name {
          font-weight: 600;
          font-size: 0.88rem;
          color: #0f172a;
        }

        .nurse-emp {
          font-size: 0.7rem;
          color: #94a3b8;
        }
      }

      .nurse-tags {
        display: flex;
        gap: 3px;

        .nurse-level-tag {
          font-size: 0.65rem;
          background: #f1f5f9;
          padding: 1px 4px;
          border-radius: 3px;
          color: #475569;
        }

        .lead-tag {
          font-size: 0.65rem;
          background: #dbeafe;
          color: #1d4ed8;
          padding: 1px 4px;
          border-radius: 3px;
          font-weight: 600;
        }

        .no-night-tag {
          font-size: 0.65rem;
          background: #fce7f3;
          color: #be185d;
          padding: 1px 4px;
          border-radius: 3px;
        }
      }
    }

    .day-num {
      font-size: 0.88rem;
      font-weight: 700;
    }

    .day-name {
      font-size: 0.7rem;
      color: #64748b;
    }

    .staffing-stat-row {
      background: #f8fafc;
      font-size: 0.78rem;

      .stat-header {
        font-weight: 600;
        color: #475569;
        display: flex;
        align-items: center;
        gap: 6px;
      }

      .stat-actual { font-weight: 700; color: #0f172a; }
      .stat-sep { color: #94a3b8; margin: 0 1px; }
      .stat-req { color: #64748b; }

      .shortage-cell {
        background: #fee2e2 !important;
        .stat-actual { color: #dc2626; }
      }
    }

    .shift-mini-dot {
      width: 8px;
      height: 8px;
      border-radius: 50%;
      display: inline-block;
    }

    .empty-state {
      padding: 60px 20px;
      text-align: center;
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 12px;

      h3 { font-size: 1.15rem; color: #334155; }
      p { font-size: 0.88rem; color: #64748b; max-width: 460px; margin-bottom: 8px; }
    }

    .violations-list {
      display: flex;
      flex-direction: column;
      gap: 8px;

      .violation-row {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 10px 14px;
        border-radius: 8px;
        gap: 14px;

        &.viol-hard {
          background: #fef2f2;
          border-left: 4px solid var(--danger);
        }

        &.viol-soft {
          background: #fffbeb;
          border-left: 4px solid var(--warning);
        }

        .viol-badge-col {
          display: flex;
          align-items: center;
          gap: 8px;
          min-width: 140px;

          .rule-code-badge {
            font-size: 0.75rem;
            font-weight: 600;
            color: #64748b;
          }
        }

        .viol-content-col {
          flex: 1;

          .viol-message {
            font-size: 0.86rem;
            color: #1e293b;
            font-weight: 500;
          }

          .viol-sub {
            margin-top: 3px;

            .law-tag {
              font-size: 0.72rem;
              background: rgba(0, 0, 0, 0.05);
              padding: 2px 6px;
              border-radius: 4px;
              color: #475569;
            }
          }
        }

        .penalty-tag {
          font-size: 0.78rem;
          color: #94a3b8;
          font-weight: 600;
        }
      }
    }

    .shift-options-grid {
      display: grid;
      grid-template-columns: repeat(2, 1fr);
      gap: 8px;
      margin-top: 6px;

      .shift-option {
        display: flex;
        align-items: center;
        gap: 8px;
        padding: 10px;
        border: 1px solid var(--border-color);
        border-radius: 8px;
        cursor: pointer;
        transition: all 0.15s;

        &.selected {
          background: #f0fdf4;
          border-width: 2px;
        }

        .opt-label {
          font-size: 0.85rem;
          font-weight: 500;
        }
      }
    }
  `],
})
export class ScheduleViewComponent implements OnInit {
  auth = inject(AuthService);
  private dataService = inject(DataService);
  private scheduler = inject(SchedulerService);
  private ruleChecker = inject(RuleCheckerService);
  private exportService = inject(ExportService);
  private route = inject(ActivatedRoute);

  selectedUnitId = 1;
  selectedYear = 2026;
  selectedMonth = 10;
  keepPinned = true;
  isSolving = false;

  // Active schedule state
  currentSchedule = signal<Schedule | null>(null);
  cells = signal<ScheduleCell[]>([]);
  violations = signal<Violation[]>([]);
  lastResult = signal<CheckResult | null>(null);

  // Cell editing state
  editingCell = signal<ScheduleCell | null>(null);
  editingNurse = signal<Nurse | null>(null);
  tempShiftId: number | null = null;
  tempOffType: OffType = 'R';
  tempIsPinned = false;
  tempEmergencyReason = '';

  units = computed(() => this.dataService.units());

  unitNurses = computed(() =>
    this.dataService.nurses().filter((n) => n.unit_id === this.selectedUnitId && n.is_active)
  );

  unitShifts = computed(() =>
    this.dataService.shifts().filter((s) => s.unit_id === this.selectedUnitId && s.is_active)
  );

  hasCells = computed(() => this.cells().length > 0);
  hardCount = computed(() => this.lastResult()?.hardCount ?? this.currentSchedule()?.hard_count ?? 0);
  softCount = computed(() => this.lastResult()?.softCount ?? this.currentSchedule()?.soft_count ?? 0);
  qualityScore = computed(() => this.lastResult()?.qualityScore ?? this.currentSchedule()?.quality_score ?? 100);

  daysInMonth = computed(() => new Date(this.selectedYear, this.selectedMonth, 0).getDate());
  daysArray = computed(() => Array.from({ length: this.daysInMonth() }, (_, i) => i + 1));

  ngOnInit(): void {
    // Check query params
    this.route.queryParams.subscribe((p) => {
      if (p['unitId']) {
        this.selectedUnitId = Number(p['unitId']);
      } else if (this.auth.currentUser()?.unit_id) {
        this.selectedUnitId = this.auth.currentUser()!.unit_id!;
      }
      this.loadScheduleData();
    });
  }

  loadScheduleData(): void {
    const sched = this.dataService
      .schedules()
      .find((s) => s.unit_id === this.selectedUnitId && s.year === this.selectedYear && s.month === this.selectedMonth);

    if (sched) {
      this.currentSchedule.set(sched);
      const schedCells = this.dataService
        .scheduleCells()
        .filter((c) => c.schedule_id === sched.schedule_id);
      this.cells.set(schedCells);

      // Re-evaluate to get person stats & violations
      const unit = this.dataService.units().find((u) => u.unit_id === this.selectedUnitId)!;
      const res = this.ruleChecker.evaluateSchedule(
        unit,
        this.selectedYear,
        this.selectedMonth,
        schedCells,
        this.unitNurses(),
        this.unitShifts(),
        this.daysInMonth()
      );
      this.lastResult.set(res);
      this.violations.set(res.violations);
    } else {
      this.currentSchedule.set(null);
      this.cells.set([]);
      this.violations.set([]);
      this.lastResult.set(null);
    }
  }

  onUnitOrDateChange(): void {
    this.loadScheduleData();
  }

  onAutoSchedule(): void {
    const unit = this.dataService.units().find((u) => u.unit_id === this.selectedUnitId);
    if (!unit) return;

    this.isSolving = true;
    setTimeout(() => {
      const { schedule, cells, result } = this.scheduler.generateSchedule(
        unit,
        this.selectedYear,
        this.selectedMonth,
        this.keepPinned
      );

      this.currentSchedule.set(schedule);
      this.cells.set(cells);
      this.violations.set(result.violations);
      this.lastResult.set(result);

      // Save to DataService
      this.dataService.saveSchedule(schedule, cells, result.violations);
      this.isSolving = false;
    }, 150);
  }

  onRecheck(): void {
    const unit = this.dataService.units().find((u) => u.unit_id === this.selectedUnitId);
    if (!unit) return;

    const res = this.ruleChecker.evaluateSchedule(
      unit,
      this.selectedYear,
      this.selectedMonth,
      this.cells(),
      this.unitNurses(),
      this.unitShifts(),
      this.daysInMonth()
    );

    this.lastResult.set(res);
    this.violations.set(res.violations);

    if (this.currentSchedule()) {
      const updated: Schedule = {
        ...this.currentSchedule()!,
        hard_count: res.hardCount,
        soft_count: res.softCount,
        total_penalty: res.totalPenalty,
        quality_score: res.qualityScore,
      };
      this.currentSchedule.set(updated);
      this.dataService.saveSchedule(updated, this.cells(), res.violations);
    }
  }

  canPublish(): boolean {
    return this.hasCells() && this.hardCount() === 0;
  }

  onPublish(): void {
    if (!this.canPublish()) {
      alert('班表仍有硬性法規違規項目尚未清除，依法不得公布！');
      return;
    }
    if (confirm('確定要公布本月班表嗎？公布後護理同仁將可查看其班表並提出換班申請。')) {
      this.dataService.updateScheduleStatus(this.currentSchedule()!.schedule_id, 'P');
      this.loadScheduleData();
    }
  }

  onRollbackDraft(): void {
    if (confirm('確定要退回為草稿狀態嗎？退回後護理同仁將暫時無法查看。')) {
      this.dataService.updateScheduleStatus(this.currentSchedule()!.schedule_id, 'D');
      this.loadScheduleData();
    }
  }

  onCloseSchedule(): void {
    if (confirm('結案後班表將轉為唯讀封存，不可再修改格子或受理換班。確定要結案嗎？')) {
      this.dataService.updateScheduleStatus(this.currentSchedule()!.schedule_id, 'C');
      this.loadScheduleData();
    }
  }

  onExportCsv(): void {
    const unit = this.dataService.units().find((u) => u.unit_id === this.selectedUnitId);
    if (!unit || !this.currentSchedule()) return;

    this.exportService.exportScheduleToCsv(
      unit,
      this.currentSchedule()!,
      this.cells(),
      this.unitNurses(),
      this.unitShifts(),
      this.daysInMonth()
    );
  }

  // --- Grid Cell Display Helpers ---

  formatDate(day: number): string {
    const m = String(this.selectedMonth).padStart(2, '0');
    const d = String(day).padStart(2, '0');
    return `${this.selectedYear}-${m}-${d}`;
  }

  isWeekend(day: number): boolean {
    const d = new Date(this.selectedYear, this.selectedMonth - 1, day);
    const w = d.getDay();
    return w === 0 || w === 6;
  }

  isHoliday(day: number): boolean {
    const dateStr = this.formatDate(day);
    return this.dataService.holidays().some((h) => h.holiday_date === dateStr && !h.is_makeup_workday);
  }

  getWeekdayName(day: number): string {
    const d = new Date(this.selectedYear, this.selectedMonth - 1, day);
    const names = ['日', '一', '二', '三', '四', '五', '六'];
    return names[d.getDay()];
  }

  getCell(nurseId: number, day: number): ScheduleCell | undefined {
    const dateStr = this.formatDate(day);
    return this.cells().find((c) => c.nurse_id === nurseId && c.work_date === dateStr);
  }

  getCellShift(nurseId: number, day: number): Shift | null {
    const cell = this.getCell(nurseId, day);
    if (!cell || cell.shift_id === null) return null;
    return this.unitShifts().find((s) => s.shift_id === cell.shift_id) || null;
  }

  getCellOffLabel(nurseId: number, day: number): string {
    const cell = this.getCell(nurseId, day);
    if (!cell) return '休';
    return cell.off_type ? `休(${cell.off_type})` : '休';
  }

  isCellPinned(nurseId: number, day: number): boolean {
    const cell = this.getCell(nurseId, day);
    return cell?.is_pinned ?? false;
  }

  hasViolation(nurseId: number, day: number): boolean {
    const dateStr = this.formatDate(day);
    return this.violations().some(
      (v) => v.severity === 'H' && v.nurse_id === nurseId && v.work_date === dateStr
    );
  }

  getNurseStat(nurseId: number, field: string): number {
    const stat = this.lastResult()?.personStats.get(nurseId);
    if (!stat) return 0;
    return (stat as any)[field] || 0;
  }

  // --- Daily Staffing stats ---
  getDailyShiftActual(shiftId: number, day: number): number {
    const dateStr = this.formatDate(day);
    const stat = this.lastResult()?.dailyStaffing.get(dateStr)?.get(shiftId);
    return stat?.actual || 0;
  }

  getDailyShiftRequired(shiftId: number, day: number): number {
    const dateStr = this.formatDate(day);
    const stat = this.lastResult()?.dailyStaffing.get(dateStr)?.get(shiftId);
    return stat?.required || 0;
  }

  isDailyShiftShortage(shiftId: number, day: number): boolean {
    const act = this.getDailyShiftActual(shiftId, day);
    const req = this.getDailyShiftRequired(shiftId, day);
    return act < req;
  }

  scheduleStatusBadge(): string {
    const st = this.currentSchedule()?.status;
    if (st === 'P') return 'badge-success';
    if (st === 'C') return 'badge-purple';
    return 'badge-warning';
  }

  scheduleStatusText(): string {
    const st = this.currentSchedule()?.status;
    if (st === 'P') return '已公布';
    if (st === 'C') return '已結案';
    return '草稿';
  }

  // --- UI-04a Cell Modal Actions ---

  openCellModal(nurse: Nurse, day: number): void {
    if (this.currentSchedule()?.status === 'C') {
      alert('班表已結案，無法手動調整！');
      return;
    }

    const cell = this.getCell(nurse.nurse_id, day);
    if (!cell) return;

    this.editingNurse.set(nurse);
    this.editingCell.set(cell);
    this.tempShiftId = cell.shift_id;
    this.tempOffType = cell.off_type || 'R';
    this.tempIsPinned = cell.is_pinned;
    this.tempEmergencyReason = cell.emergency_reason || '';
  }

  closeCellModal(): void {
    this.editingCell.set(null);
    this.editingNurse.set(null);
  }

  saveCellModal(): void {
    const cell = this.editingCell();
    if (!cell) return;

    cell.shift_id = this.tempShiftId;
    cell.off_type = this.tempShiftId === null ? this.tempOffType : null;
    cell.is_pinned = this.tempIsPinned;
    cell.emergency_reason = this.tempEmergencyReason;

    // Immediately re-evaluate and save
    this.onRecheck();
    this.closeCellModal();
  }
}
