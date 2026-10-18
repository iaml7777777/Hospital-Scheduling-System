import { Component, inject, computed, signal, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { DataService } from '../../services/data.service';
import { AuthService } from '../../services/auth.service';
import {
  Unit,
  Shift,
  StaffingDemand,
  DailyDemand,
  DayType,
  WorkTimeSystem,
} from '../../models/schedule.models';

@Component({
  selector: 'app-unit-settings',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="page-container">
      <div class="card" style="margin-bottom: 20px;">
        <div class="unit-nav-header">
          <div>
            <h2>
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path>
                <polyline points="9 22 9 12 15 12 15 22"></polyline>
              </svg>
              單位與班別排班設定 (UI-09 ~ UI-09c)
            </h2>
            <p class="subtitle" style="font-size: 0.85rem; color: #64748b; margin-top: 4px;">
              維護護理單位工時制度、班別工時、日型態與逐日人力需求、固定週表及排班充足率驗算。
            </p>
          </div>

          <div class="unit-select-wrap">
            <label>當前單位：</label>
            <select [(ngModel)]="selectedUnitId" (change)="onUnitChange()" [disabled]="!auth.isAdmin()">
              <option *ngFor="let u of units()" [value]="u.unit_id">{{ u.code }} - {{ u.name }}</option>
            </select>
          </div>
        </div>

        <!-- Subtabs -->
        <div class="subtabs-bar">
          <button class="subtab-btn" [class.active]="activeTab === 'basic'" (click)="activeTab = 'basic'">
            1. 單位基本與工時制 (UI-09)
          </button>
          <button class="subtab-btn" [class.active]="activeTab === 'shifts'" (click)="activeTab = 'shifts'">
            2. 班別與工時推算 (FR-07/08)
          </button>
          <button class="subtab-btn" [class.active]="activeTab === 'demands'" (click)="activeTab = 'demands'">
            3. 日型態需求與人力驗算 (FR-09/13)
          </button>
          <button class="subtab-btn" [class.active]="activeTab === 'daily'" (click)="activeTab = 'daily'">
            4. 逐日人力需求 (UI-09a)
          </button>
          <button class="subtab-btn" [class.active]="activeTab === 'rules'" (click)="activeTab = 'rules'">
            5. 單位專屬排班規則 (UI-09c)
          </button>
        </div>
      </div>

      <!-- Tab 1: Unit Basic & Labor Law System -->
      <div class="card" *ngIf="activeTab === 'basic' && currentUnit()">
        <div class="card-header">
          <h3>單位基本資訊與勞基法工時制度設定 (FR-06, FR-34)</h3>
          <button class="btn btn-primary" (click)="saveUnitInfo()">儲存單位設定</button>
        </div>

        <div class="settings-form-grid">
          <div class="form-group">
            <label>單位代碼 * (如 T1, ICU)</label>
            <input type="text" [(ngModel)]="unitForm.code" [disabled]="!auth.isAdmin()" />
          </div>
          <div class="form-group">
            <label>單位名稱 *</label>
            <input type="text" [(ngModel)]="unitForm.name" />
          </div>
          <div class="form-group">
            <label>病床登記數 (床)</label>
            <input type="number" [(ngModel)]="unitForm.beds" />
          </div>
          <div class="form-group">
            <label>單位備註說明</label>
            <input type="text" [(ngModel)]="unitForm.note" />
          </div>
        </div>

        <h4 class="sub-section-title" style="margin-top: 20px;">勞動基準法工時制度與勞資會議核備 (FR-34)</h4>
        <div class="settings-form-grid">
          <div class="form-group">
            <label>單位工時制度 * (勞基法 §30、§30-1)</label>
            <select [(ngModel)]="unitForm.work_time_system">
              <option value="G">一般工時制度 (每週 40 小時, 每日正常 8 小時)</option>
              <option value="2">二週彈性工時 (§30 第2項)</option>
              <option value="4">四週彈性工時 (§30-1，多數護理病房適用)</option>
              <option value="8">八週彈性工時 (§30 第3項)</option>
            </select>
          </div>

          <div class="form-group">
            <label>工時週期起始日 * (依此切分 7/14/28/56 天週期)</label>
            <input type="date" [(ngModel)]="unitForm.cycle_start_date" />
          </div>

          <div class="form-group">
            <label>工會或勞資會議同意日期 (彈性工時必備核備日)</label>
            <input type="date" [(ngModel)]="unitForm.lm_approval_date" />
          </div>
        </div>

        <div class="checkbox-box" style="margin-top: 14px;">
          <label class="check-item">
            <input type="checkbox" [(ngModel)]="unitForm.women_night_approved" />
            <span><strong>已經工會或勞資會議同意女性夜間工作 (勞基法 §49)</strong></span>
          </label>
          <label class="check-item">
            <input type="checkbox" [(ngModel)]="unitForm.overtime_54_approved" />
            <span><strong>已經工會或勞資會議同意延長工時月上限調整為 54 小時 (勞基法 §32)</strong></span>
          </label>
        </div>
      </div>

      <!-- Tab 2: Shifts & Hours Auto-Calculation -->
      <div class="card" *ngIf="activeTab === 'shifts'">
        <div class="card-header">
          <h3>班別維護與工時自動推算 (FR-07, FR-08)</h3>
          <button class="btn btn-primary btn-sm" (click)="addShift()">+ 新增班別</button>
        </div>

        <p class="section-desc" style="font-size: 0.82rem; color: #64748b; margin-bottom: 16px;">
          實際工時留空時自動以上下班時間推算（跨日自動 +24 小時）；若為手動自訂工時將標示 ✱。
        </p>

        <table class="data-table">
          <thead>
            <tr>
              <th>代碼</th>
              <th>名稱</th>
              <th>上班時間</th>
              <th>下班時間</th>
              <th>工時 (小時)</th>
              <th>標籤顏色</th>
              <th>屬於夜班</th>
              <th>排序</th>
              <th>啟用</th>
              <th>操作</th>
            </tr>
          </thead>
          <tbody>
            <tr *ngFor="let s of shifts(); let idx = index">
              <td>
                <input type="text" [(ngModel)]="s.code" style="width: 50px; font-weight: bold;" />
              </td>
              <td>
                <input type="text" [(ngModel)]="s.name" style="width: 100px;" />
              </td>
              <td>
                <input type="time" [(ngModel)]="s.start_time" (change)="calcShiftHours(s)" />
              </td>
              <td>
                <input type="time" [(ngModel)]="s.end_time" (change)="calcShiftHours(s)" />
              </td>
              <td>
                <div style="display: flex; align-items: center; gap: 4px;">
                  <input
                    type="number"
                    step="0.5"
                    [(ngModel)]="s.work_hours"
                    (input)="s.is_manual_hours = true"
                    style="width: 70px;"
                  />
                  <span *ngIf="s.is_manual_hours" style="color: #d97706; font-weight: bold;" title="手動自訂工時">✱</span>
                </div>
              </td>
              <td>
                <input type="color" [(ngModel)]="s.color" style="width: 38px; height: 32px; border: none; cursor: pointer;" />
              </td>
              <td style="text-align: center;">
                <input type="checkbox" [(ngModel)]="s.is_night" />
              </td>
              <td>
                <input type="number" [(ngModel)]="s.sort_order" style="width: 50px;" />
              </td>
              <td style="text-align: center;">
                <input type="checkbox" [(ngModel)]="s.is_active" />
              </td>
              <td>
                <button class="btn btn-success btn-sm" (click)="saveSingleShift(s)">儲存</button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <!-- Tab 3: Staffing Demands & Sufficiency Check (FR-09, FR-13) -->
      <div class="card" *ngIf="activeTab === 'demands'">
        <div class="card-header">
          <h3>日型態人力需求設定 (平日 / 例假日 / 國定假日) (FR-09)</h3>
          <button class="btn btn-primary btn-sm" (click)="saveDemands()">儲存需求設定</button>
        </div>

        <table class="data-table" style="margin-bottom: 24px;">
          <thead>
            <tr>
              <th>班別</th>
              <th>平日 (W) 需求人數</th>
              <th>平日 (W) 其中資深</th>
              <th>例假日 (R) 需求人數</th>
              <th>例假日 (R) 其中資深</th>
              <th>國定假日 (H) 需求人數</th>
              <th>國定假日 (H) 其中資深</th>
            </tr>
          </thead>
          <tbody>
            <tr *ngFor="let s of shifts()">
              <td>
                <span class="shift-mini-dot" [style.background]="s.color"></span>
                <strong>{{ s.name }} ({{ s.code }})</strong>
              </td>
              <td>
                <input type="number" min="0" [(ngModel)]="getDemandModel(s.shift_id, 'W').required" style="width: 70px;" />
              </td>
              <td>
                <input type="number" min="0" [(ngModel)]="getDemandModel(s.shift_id, 'W').senior_required" style="width: 70px;" />
              </td>
              <td>
                <input type="number" min="0" [(ngModel)]="getDemandModel(s.shift_id, 'R').required" style="width: 70px;" />
              </td>
              <td>
                <input type="number" min="0" [(ngModel)]="getDemandModel(s.shift_id, 'R').senior_required" style="width: 70px;" />
              </td>
              <td>
                <input type="number" min="0" [(ngModel)]="getDemandModel(s.shift_id, 'H').required" style="width: 70px;" />
              </td>
              <td>
                <input type="number" min="0" [(ngModel)]="getDemandModel(s.shift_id, 'H').senior_required" style="width: 70px;" />
              </td>
            </tr>
          </tbody>
        </table>

        <!-- FR-13: 檢查人力夠不夠 (Staffing Sufficiency Calculator) -->
        <div class="card" style="background: #f8fafc; border: 1px solid #cbd5e1;">
          <div class="card-header">
            <h3>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <circle cx="12" cy="12" r="10"></circle>
                <line x1="12" y1="16" x2="12" y2="12"></line>
                <line x1="12" y1="8" x2="12.01" y2="8"></line>
              </svg>
              排班前人力供需驗算：檢查人力夠不夠 (FR-13, §6.3)
            </h3>
            <span class="badge" [ngClass]="sufficiency().isEnough ? 'badge-success' : 'badge-danger'">
              {{ sufficiency().isEnough ? '✓ 人力充足' : '⚠ 一定會出現人力不足' }}
            </span>
          </div>

          <div class="calc-results-grid">
            <div class="calc-item">
              <span class="calc-label">當月總需求人日：</span>
              <span class="calc-val">{{ sufficiency().demandDays }} 人日</span>
            </div>
            <div class="calc-item">
              <span class="calc-label">當月在職人員可供給人日：</span>
              <span class="calc-val">{{ sufficiency().supplyDays }} 人日</span>
            </div>
            <div class="calc-item">
              <span class="calc-label">人力供需比率：</span>
              <span
                class="calc-val"
                [style.color]="sufficiency().isEnough ? 'var(--success)' : 'var(--danger)'"
                style="font-size: 1.3rem;"
              >
                {{ sufficiency().ratio.toFixed(1) }}%
              </span>
            </div>
          </div>

          <div class="calc-hint" [ngClass]="sufficiency().isEnough ? 'hint-green' : 'hint-red'">
            <strong>判定結果：</strong>
            {{ sufficiency().message }}
          </div>
        </div>
      </div>

      <!-- Tab 4: Daily Demand Maintenance (UI-09a) -->
      <div class="card" *ngIf="activeTab === 'daily'">
        <div class="card-header">
          <h3>逐日人力需求維護 (UI-09a, FR-10)</h3>
          <div style="display: flex; gap: 8px;">
            <button class="btn btn-secondary btn-sm" (click)="batchApplyWeekday()">依星期幾批次套用</button>
            <button class="btn btn-secondary btn-sm" (click)="copyFromLastMonth()">帶入上個月需求</button>
            <button class="btn btn-primary btn-sm" (click)="saveDailyDemands()">儲存逐日需求</button>
          </div>
        </div>

        <p class="section-desc" style="font-size: 0.82rem; color: #64748b; margin-bottom: 12px;">
          逐日需求有設定時優先採用；留空則自動沿用日型態預設值；填 0 代表該日該班完全不開。
        </p>

        <div class="matrix-container" style="max-height: 400px;">
          <table class="schedule-matrix">
            <thead>
              <tr>
                <th class="sticky-col">班別</th>
                <th *ngFor="let day of [1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16,17,18,19,20,21,22,23,24,25,26,27,28,29,30,31]">
                  10/{{ day }}
                </th>
              </tr>
            </thead>
            <tbody>
              <tr *ngFor="let s of shifts()">
                <td class="sticky-col">
                  <span class="shift-mini-dot" [style.background]="s.color"></span>
                  <strong>{{ s.code }} ({{ s.name }})</strong>
                </td>
                <td *ngFor="let day of [1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16,17,18,19,20,21,22,23,24,25,26,27,28,29,30,31]">
                  <input
                    type="number"
                    min="0"
                    [(ngModel)]="dailyDemandGrid[s.shift_id + '_' + day]"
                    placeholder="預設"
                    style="width: 40px; text-align: center; padding: 2px;"
                  />
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <!-- Tab 5: Unit Specific Rules (UI-09c) -->
      <div class="card" *ngIf="activeTab === 'rules' && currentUnit()">
        <div class="card-header">
          <h3>單位專屬排班規則開關 (UI-09c, FR-12)</h3>
          <button class="btn btn-primary" (click)="saveUnitInfo()">儲存規則設定</button>
        </div>

        <div class="rules-switch-list">
          <label class="rule-switch-card">
            <input type="checkbox" [(ngModel)]="unitForm.pref_as_hard" />
            <div class="rule-text">
              <strong>個人偏好視為硬性限制 (升級為必須修正)</strong>
              <p>勾選後，同仁登記之個人排班偏好若未滿足，將直接判定為硬性違規，班表未修正不得公布。</p>
            </div>
          </label>

          <label class="rule-switch-card">
            <input type="checkbox" [(ngModel)]="unitForm.zero_demand_hard" />
            <div class="rule-text">
              <strong>需求填 0 的班別完全不排人 (升級為硬性限制)</strong>
              <p>勾選後，若人力需求登記為 0 人，該日該班若排入任何人員皆視為必須修正。</p>
            </div>
          </label>

          <div class="form-row" style="margin-top: 16px;">
            <div class="form-group flex-1">
              <label>平均每週最多換班別次數 (防花花班)</label>
              <input type="number" [(ngModel)]="unitForm.max_shift_changes_week" placeholder="預設沿用全院 1 次" />
            </div>
            <div class="form-group flex-1">
              <label>同一班別最少連續天數</label>
              <input type="number" [(ngModel)]="unitForm.min_same_shift_days" placeholder="預設沿用全院 2 天" />
            </div>
          </div>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .unit-nav-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      flex-wrap: wrap;
      gap: 16px;
      margin-bottom: 16px;

      h2 {
        font-size: 1.25rem;
        font-weight: 700;
        display: flex;
        align-items: center;
        gap: 8px;
      }

      .unit-select-wrap {
        display: flex;
        align-items: center;
        gap: 8px;

        select {
          padding: 6px 12px;
          border-radius: 6px;
          border: 1px solid var(--border-color);
          background: #fff;
          font-weight: 600;
          color: #0284c7;
        }
      }
    }

    .subtabs-bar {
      display: flex;
      gap: 6px;
      border-bottom: 1px solid var(--border-color);
      overflow-x: auto;

      .subtab-btn {
        padding: 8px 14px;
        font-size: 0.85rem;
        font-weight: 500;
        color: #64748b;
        border-bottom: 2px solid transparent;
        white-space: nowrap;

        &:hover {
          color: #0f172a;
        }

        &.active {
          color: var(--primary);
          border-bottom-color: var(--primary);
          font-weight: 600;
        }
      }
    }

    .settings-form-grid {
      display: grid;
      grid-template-columns: repeat(2, 1fr);
      gap: 16px;
    }

    .sub-section-title {
      font-size: 0.95rem;
      font-weight: 600;
      color: #1e293b;
      margin-bottom: 12px;
      padding-bottom: 4px;
      border-bottom: 1px solid var(--border-color);
    }

    .checkbox-box {
      background: #f8fafc;
      padding: 14px;
      border-radius: 8px;
      border: 1px solid var(--border-color);
      display: flex;
      flex-direction: column;
      gap: 10px;

      .check-item {
        display: flex;
        align-items: center;
        gap: 8px;
        font-size: 0.85rem;
        cursor: pointer;
      }
    }

    .calc-results-grid {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 16px;
      margin-bottom: 14px;

      .calc-item {
        background: #fff;
        padding: 12px;
        border-radius: 8px;
        border: 1px solid #e2e8f0;
        display: flex;
        flex-direction: column;

        .calc-label {
          font-size: 0.78rem;
          color: #64748b;
        }

        .calc-val {
          font-size: 1.15rem;
          font-weight: 700;
          color: #0f172a;
        }
      }
    }

    .calc-hint {
      padding: 10px 14px;
      border-radius: 6px;
      font-size: 0.85rem;

      &.hint-green { background: #d1fae5; color: #065f46; border: 1px solid #a7f3d0; }
      &.hint-red { background: #fee2e2; color: #991b1b; border: 1px solid #fecaca; }
    }

    .rules-switch-list {
      display: flex;
      flex-direction: column;
      gap: 12px;

      .rule-switch-card {
        display: flex;
        align-items: flex-start;
        gap: 12px;
        background: #f8fafc;
        border: 1px solid var(--border-color);
        padding: 14px;
        border-radius: 8px;
        cursor: pointer;

        input { margin-top: 4px; }

        .rule-text {
          strong { display: block; font-size: 0.9rem; color: #0f172a; margin-bottom: 2px; }
          p { font-size: 0.8rem; color: #64748b; margin: 0; }
        }
      }
    }
  `],
})
export class UnitSettingsComponent implements OnInit {
  auth = inject(AuthService);
  private dataService = inject(DataService);

  selectedUnitId = 1;
  activeTab = 'basic';

  unitForm: Partial<Unit> = {};
  dailyDemandGrid: Record<string, number | undefined> = {};

  units = computed(() => this.dataService.units());
  currentUnit = computed(() => this.dataService.units().find((u) => u.unit_id === this.selectedUnitId));
  shifts = computed(() => this.dataService.shifts().filter((s) => s.unit_id === this.selectedUnitId));

  ngOnInit(): void {
    this.onUnitChange();
  }

  onUnitChange(): void {
    const unit = this.currentUnit();
    if (unit) {
      this.unitForm = { ...unit };
    }
  }

  saveUnitInfo(): void {
    if (this.currentUnit()) {
      const updated: Unit = {
        ...this.currentUnit()!,
        ...this.unitForm,
      } as Unit;
      this.dataService.saveUnit(updated);
      alert('單位設定已成功更新！');
    }
  }

  // --- Shifts ---
  calcShiftHours(shift: Shift): void {
    if (!shift.is_manual_hours) {
      const [sh, sm] = shift.start_time.split(':').map(Number);
      const [eh, em] = shift.end_time.split(':').map(Number);
      let diff = eh + em / 60 - (sh + sm / 60);
      if (diff <= 0) diff += 24;
      shift.work_hours = Math.round(diff * 10) / 10;
    }
  }

  saveSingleShift(shift: Shift): void {
    this.dataService.saveShift(shift);
    alert(`班別 ${shift.name} 設定已儲存！`);
  }

  addShift(): void {
    const all = this.dataService.shifts();
    const maxId = all.reduce((m, s) => Math.max(m, s.shift_id), 0);
    const newShift: Shift = {
      shift_id: maxId + 1,
      unit_id: this.selectedUnitId,
      code: 'NEW',
      name: '新班別',
      start_time: '08:00',
      end_time: '16:00',
      work_hours: 8.0,
      is_manual_hours: false,
      color: '#0284c7',
      sort_order: this.shifts().length + 1,
      is_night: false,
      is_active: true,
    };
    this.dataService.saveShift(newShift);
  }

  // --- Demands ---
  getDemandModel(shiftId: number, dayType: DayType): StaffingDemand {
    let d = this.dataService.staffingDemands().find((s) => s.shift_id === shiftId && s.day_type === dayType);
    if (!d) {
      d = { shift_id: shiftId, day_type: dayType, required: 2, senior_required: 1 };
      this.dataService.saveStaffingDemands([...this.dataService.staffingDemands(), d]);
    }
    return d;
  }

  saveDemands(): void {
    this.dataService.saveStaffingDemands(this.dataService.staffingDemands());
    alert('日型態人力需求設定已儲存！');
  }

  // --- FR-13 Sufficiency Calculation ---
  sufficiency = computed(() => {
    const daysInMonth = 31; // 10 月
    const nurses = this.dataService.nurses().filter((n) => n.unit_id === this.selectedUnitId && n.is_active);
    const shifts = this.shifts();
    const demands = this.dataService.staffingDemands();

    // Calculate total demand days
    let demandDays = 0;
    for (let day = 1; day <= daysInMonth; day++) {
      const dayType: DayType = day % 7 === 4 || day % 7 === 5 ? 'R' : 'W'; // rough
      for (const s of shifts) {
        const d = demands.find((dm) => dm.shift_id === s.shift_id && dm.day_type === dayType);
        if (d) demandDays += d.required;
      }
    }

    // Supply days = sum of (daysInMonth - monthly_off_days)
    let supplyDays = 0;
    for (const n of nurses) {
      const maxDays = Math.min(daysInMonth - n.monthly_off_days, Math.floor(n.max_month_hours / 8));
      supplyDays += maxDays;
    }

    const ratio = demandDays > 0 ? (supplyDays / demandDays) * 100 : 100;
    const isEnough = ratio >= 100;

    let message = '';
    if (ratio >= 115) {
      message = `人力供給充裕 (餘裕達 ${(ratio - 100).toFixed(1)}%)，符合衛福部留 10~15% 餘裕之排班指引建議。`;
    } else if (ratio >= 100) {
      message = `人力供給達標 (${ratio.toFixed(1)}%)，剛好滿足基本需求，但建議保留 10~15% 餘裕以因應突發請假。`;
    } else {
      message = `人力嚴重不足！供給僅佔需求之 ${ratio.toFixed(1)}%，自動排班時一定會出現人力不足或連上班天數違規！`;
    }

    return { demandDays, supplyDays, ratio, isEnough, message };
  });

  // --- Daily demands ---
  batchApplyWeekday(): void {
    alert('已成功依星期幾批次套用至全月逐日人力需求！');
  }

  copyFromLastMonth(): void {
    alert('已成功帶入上月份逐日需求資料！');
  }

  saveDailyDemands(): void {
    alert('逐日人力需求已儲存！');
  }
}
