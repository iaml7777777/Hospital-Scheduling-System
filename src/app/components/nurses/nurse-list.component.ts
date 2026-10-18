import { Component, inject, computed, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { DataService } from '../../services/data.service';
import { AuthService } from '../../services/auth.service';
import {
  Nurse,
  NurseLevel,
  EmploymentType,
  NurseProtection,
  Preference,
  PrefType,
} from '../../models/schedule.models';

@Component({
  selector: 'app-nurse-list',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="page-container">
      <div class="card" style="margin-bottom: 20px;">
        <div class="header-action-row">
          <div>
            <h2>
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
                <circle cx="9" cy="7" r="4"></circle>
                <path d="M23 21v-2a4 4 0 0 0-3-3.87"></path>
                <path d="M16 3.13a4 4 0 0 1 0 7.75"></path>
              </svg>
              護理人員資料與偏好維護 (UI-08, UI-08a)
            </h2>
            <p class="subtitle" style="font-size: 0.85rem; color: #64748b; margin-top: 4px;">
              維護同仁基本資格（資深帶班、可值夜、在職狀態）、勞基法特殊保護期間（妊娠/哺乳）及個人排班偏好。
            </p>
          </div>

          <div class="header-controls">
            <select [(ngModel)]="selectedUnitId" [disabled]="!auth.isAdmin()">
              <option *ngFor="let u of units()" [value]="u.unit_id">{{ u.code }} - {{ u.name }}</option>
            </select>
            <button class="btn btn-primary" (click)="openCreateModal()">+ 新增護理人員</button>
          </div>
        </div>
      </div>

      <!-- Nurse Directory Table Card -->
      <div class="card">
        <div class="card-header">
          <h3>單位同仁清單</h3>
          <span class="badge badge-primary">在職同仁：{{ unitNurses().length }} 人</span>
        </div>

        <div class="table-responsive">
          <table class="data-table">
            <thead>
              <tr>
                <th>員工編號</th>
                <th>姓名</th>
                <th>性別</th>
                <th>層級</th>
                <th>聘用型態</th>
                <th>帶班資格</th>
                <th>值夜限制</th>
                <th>保護期間</th>
                <th>月工時/應休</th>
                <th>每週換班同意</th>
                <th>狀態</th>
                <th>操作</th>
              </tr>
            </thead>
            <tbody>
              <tr *ngFor="let n of unitNurses()">
                <td><strong>#{{ n.emp_no }}</strong></td>
                <td>{{ n.name }}</td>
                <td>{{ n.sex === 'M' ? '男' : '女' }}</td>
                <td><span class="badge badge-neutral">{{ n.level }}</span></td>
                <td>{{ n.employment_type === 'F' ? '全職' : '兼職' }}</td>
                <td>
                  <span class="badge" [ngClass]="n.can_lead ? 'badge-primary' : 'badge-neutral'">
                    {{ n.can_lead ? '資深帶班' : '一般' }}
                  </span>
                </td>
                <td>
                  <span class="badge" [ngClass]="n.can_night ? 'badge-success' : 'badge-danger'">
                    {{ n.can_night ? '可值夜' : '不可排夜班' }}
                  </span>
                </td>
                <td>
                  <span *ngIf="getProtectionLabel(n.nurse_id) as pLabel" class="badge badge-purple">
                    {{ pLabel }}
                  </span>
                  <span *ngIf="!getProtectionLabel(n.nurse_id)" style="color: #94a3b8; font-size: 0.8rem;">-</span>
                </td>
                <td style="font-size: 0.82rem;">
                  {{ n.max_month_hours }}h / {{ n.monthly_off_days }}休
                </td>
                <td>
                  <span class="badge" [ngClass]="n.shift_change_consent ? 'badge-success' : 'badge-neutral'">
                    {{ n.shift_change_consent ? '已同意(>1次/週)' : '未同意' }}
                  </span>
                </td>
                <td>
                  <span class="badge" [ngClass]="n.is_active ? 'badge-success' : 'badge-danger'">
                    {{ n.is_active ? '在職' : '離職' }}
                  </span>
                </td>
                <td>
                  <button class="btn btn-outline-primary btn-sm" (click)="openEditModal(n)">
                    編輯 / 偏好
                  </button>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <!-- UI-08a Nurse Edit & Preferences Modal -->
      <div class="modal-overlay" *ngIf="editingNurse()" (click)="closeEditModal()">
        <div class="modal-content nurse-edit-modal" (click)="$event.stopPropagation()">
          <div class="card-header">
            <h3>{{ isCreating ? '新增護理人員' : '編輯同仁資料與個人排班偏好 (UI-08a)' }}</h3>
            <button class="btn btn-sm" (click)="closeEditModal()">✕</button>
          </div>

          <form (ngSubmit)="saveNurse()">
            <div class="edit-modal-layout">
              <!-- Left Column: Basic & Legal Info -->
              <div class="edit-col">
                <h4 class="section-title">基本資料與資格</h4>

                <div class="form-row">
                  <div class="form-group flex-1">
                    <label>員工編號 *</label>
                    <input type="text" [(ngModel)]="currentForm.emp_no" name="emp_no" required />
                  </div>
                  <div class="form-group flex-1">
                    <label>同仁姓名 *</label>
                    <input type="text" [(ngModel)]="currentForm.name" name="name" required />
                  </div>
                </div>

                <div class="form-row">
                  <div class="form-group flex-1">
                    <label>性別 * (勞基法 §49)</label>
                    <select [(ngModel)]="currentForm.sex" name="sex">
                      <option value="F">女性 (Female)</option>
                      <option value="M">男性 (Male)</option>
                    </select>
                  </div>
                  <div class="form-group flex-1">
                    <label>護理層級</label>
                    <select [(ngModel)]="currentForm.level" name="level">
                      <option value="N">N (新進)</option>
                      <option value="N1">N1</option>
                      <option value="N2">N2</option>
                      <option value="N3">N3 (資深)</option>
                      <option value="N4">N4 (督導/專家)</option>
                    </select>
                  </div>
                </div>

                <div class="form-row">
                  <div class="form-group flex-1">
                    <label>聘用型態</label>
                    <select [(ngModel)]="currentForm.employment_type" name="employment_type">
                      <option value="F">全職 (Full-time)</option>
                      <option value="P">兼職 (Part-time)</option>
                    </select>
                  </div>
                  <div class="form-group flex-1">
                    <label>聯絡電話</label>
                    <input type="text" [(ngModel)]="currentForm.phone" name="phone" placeholder="09xx-xxx-xxx" />
                  </div>
                </div>

                <div class="form-row">
                  <div class="form-group flex-1">
                    <label>月工時上限 (時) *</label>
                    <input type="number" [(ngModel)]="currentForm.max_month_hours" name="max_month_hours" (change)="checkZeroHours()" />
                    <div class="hint">若填 0 系統自動修正為 184h</div>
                  </div>
                  <div class="form-group flex-1">
                    <label>每月應休天數 *</label>
                    <input type="number" [(ngModel)]="currentForm.monthly_off_days" name="monthly_off_days" />
                  </div>
                </div>

                <h4 class="section-title" style="margin-top: 14px;">排班授權與勞基法同意</h4>
                <div class="checkbox-group">
                  <label class="check-item">
                    <input type="checkbox" [(ngModel)]="currentForm.can_lead" name="can_lead" />
                    <span><strong>可帶班人員</strong> (滿足各班資深人員配置)</span>
                  </label>
                  <label class="check-item">
                    <input type="checkbox" [(ngModel)]="currentForm.can_night" name="can_night" />
                    <span><strong>可排夜班</strong> (勾選始得排定小夜/大夜)</span>
                  </label>
                  <label class="check-item">
                    <input type="checkbox" [(ngModel)]="currentForm.shift_change_consent" name="shift_change_consent" />
                    <span><strong>本人同意每週更換班次超過一次</strong> (勞基法 §34 第1項書面同意)</span>
                  </label>
                  <label class="check-item">
                    <input type="checkbox" [(ngModel)]="currentForm.is_active" name="is_active" />
                    <span><strong>在職狀態</strong> (納入排班演算)</span>
                  </label>
                </div>

                <!-- Legal Protection Period (FR-36) -->
                <h4 class="section-title" style="margin-top: 14px;">母性健康與夜間工作保護 (FR-36)</h4>
                <div class="protection-box">
                  <div class="form-row">
                    <div class="form-group flex-1">
                      <label>保護類型</label>
                      <select [(ngModel)]="protectionForm.type" name="pType">
                        <option value="NONE">無保護限制</option>
                        <option value="P">妊娠期間 (懷孕禁止夜間工作)</option>
                        <option value="B">哺乳期間 (產後一年內禁止夜間)</option>
                        <option value="H">健康/正當理由申報不宜夜間</option>
                      </select>
                    </div>
                  </div>
                  <div class="form-row" *ngIf="protectionForm.type !== 'NONE'">
                    <div class="form-group flex-1">
                      <label>起日</label>
                      <input type="date" [(ngModel)]="protectionForm.startDate" name="pStart" />
                    </div>
                    <div class="form-group flex-1">
                      <label>訖日</label>
                      <input type="date" [(ngModel)]="protectionForm.endDate" name="pEnd" />
                    </div>
                  </div>
                </div>
              </div>

              <!-- Right Column: Personal Scheduling Preferences (FR-15) -->
              <div class="edit-col">
                <h4 class="section-title">個人排班偏好設定 (FR-15)</h4>
                <p class="section-subtitle">
                  可設定固定班別、不排特定班別或固定星期幾休假，排班引擎將列入加權最佳化考量。
                </p>

                <div class="pref-list">
                  <div class="pref-item-card" *ngFor="let p of nursePrefs; let idx = index">
                    <div class="pref-item-header">
                      <span class="badge badge-primary">偏好 #{{ idx + 1 }}</span>
                      <button type="button" class="btn btn-sm btn-danger" (click)="removePref(idx)">✕ 刪除</button>
                    </div>

                    <div class="form-row">
                      <div class="form-group flex-1">
                        <label>偏好類型</label>
                        <select [(ngModel)]="p.pref_type" [name]="'pref_type_' + idx">
                          <option value="F">F - 固定班別</option>
                          <option value="X">X - 不排此班</option>
                          <option value="O">O - 固定星期休</option>
                        </select>
                      </div>

                      <div class="form-group flex-1" *ngIf="p.pref_type !== 'O'">
                        <label>對應班別</label>
                        <select [(ngModel)]="p.shift_id" [name]="'shift_' + idx">
                          <option *ngFor="let s of unitShifts()" [value]="s.shift_id">
                            {{ s.code }} ({{ s.name }})
                          </option>
                        </select>
                      </div>
                    </div>

                    <div class="form-row">
                      <div class="form-group flex-1">
                        <label>適用星期</label>
                        <select [(ngModel)]="p.weekday" [name]="'weekday_' + idx">
                          <option [value]="null">每天 (不限星期)</option>
                          <option [value]="0">每週日</option>
                          <option [value]="1">每週一</option>
                          <option [value]="2">每週二</option>
                          <option [value]="3">每週三</option>
                          <option [value]="4">每週四</option>
                          <option [value]="5">每週五</option>
                          <option [value]="6">每週六</option>
                        </select>
                      </div>
                      <div class="form-group flex-1">
                        <label>偏好強度 (預設10)</label>
                        <input type="number" [(ngModel)]="p.strength" [name]="'strength_' + idx" min="1" max="50" />
                      </div>
                    </div>
                  </div>

                  <button type="button" class="btn btn-outline-primary btn-sm" (click)="addPref()">
                    + 新增一項偏好設定
                  </button>
                </div>
              </div>
            </div>

            <div class="modal-footer" style="display: flex; justify-content: flex-end; gap: 10px; margin-top: 24px;">
              <button type="button" class="btn btn-secondary" (click)="closeEditModal()">取消</button>
              <button type="submit" class="btn btn-primary">儲存人員資料與偏好</button>
            </div>
          </form>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .header-action-row {
      display: flex;
      justify-content: space-between;
      align-items: center;
      flex-wrap: wrap;
      gap: 16px;

      h2 {
        font-size: 1.25rem;
        font-weight: 700;
        display: flex;
        align-items: center;
        gap: 8px;
      }

      .header-controls {
        display: flex;
        gap: 10px;
        align-items: center;

        select {
          padding: 6px 12px;
          border-radius: 6px;
          border: 1px solid var(--border-color);
          background: #fff;
          font-size: 0.88rem;
        }
      }
    }

    .nurse-edit-modal {
      max-width: 900px;
    }

    .edit-modal-layout {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 24px;
    }

    .section-title {
      font-size: 0.95rem;
      font-weight: 600;
      color: #1e293b;
      margin-bottom: 10px;
      padding-bottom: 4px;
      border-bottom: 1px solid var(--border-color);
    }

    .section-subtitle {
      font-size: 0.78rem;
      color: #64748b;
      margin-bottom: 14px;
    }

    .form-row {
      display: flex;
      gap: 12px;

      .flex-1 { flex: 1; }
    }

    .checkbox-group {
      display: flex;
      flex-direction: column;
      gap: 8px;
      background: #f8fafc;
      padding: 12px;
      border-radius: 8px;
      border: 1px solid var(--border-color);

      .check-item {
        display: flex;
        align-items: center;
        gap: 8px;
        font-size: 0.82rem;
        cursor: pointer;
      }
    }

    .protection-box {
      background: #faf5ff;
      border: 1px solid #e9d5ff;
      padding: 12px;
      border-radius: 8px;
    }

    .pref-list {
      display: flex;
      flex-direction: column;
      gap: 12px;

      .pref-item-card {
        background: #f8fafc;
        border: 1px solid var(--border-color);
        padding: 12px;
        border-radius: 8px;

        .pref-item-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 8px;
        }
      }
    }
  `],
})
export class NurseListComponent {
  auth = inject(AuthService);
  private dataService = inject(DataService);

  selectedUnitId = 1;
  isCreating = false;
  editingNurse = signal<Nurse | null>(null);

  // Form State
  currentForm: Partial<Nurse> = {};
  nursePrefs: Preference[] = [];
  protectionForm = {
    type: 'NONE',
    startDate: '2026-06-01',
    endDate: '2027-02-28',
  };

  units = computed(() => this.dataService.units());
  unitNurses = computed(() =>
    this.dataService.nurses().filter((n) => n.unit_id === this.selectedUnitId)
  );
  unitShifts = computed(() =>
    this.dataService.shifts().filter((s) => s.unit_id === this.selectedUnitId && s.is_active)
  );

  getProtectionLabel(nurseId: number): string | null {
    const p = this.dataService.nurseProtections().find((pt) => pt.nurse_id === nurseId);
    if (!p) return null;
    if (p.protection_type === 'P') return '妊娠保護';
    if (p.protection_type === 'B') return '哺乳保護';
    return '健康理由保護';
  }

  openCreateModal(): void {
    this.isCreating = true;
    this.currentForm = {
      unit_id: this.selectedUnitId,
      emp_no: `N${1000 + this.unitNurses().length + 1}`,
      name: '',
      sex: 'F',
      level: 'N1',
      employment_type: 'F',
      can_lead: false,
      can_night: true,
      max_month_hours: 184,
      monthly_off_days: 8,
      is_active: true,
      shift_change_consent: false,
    };
    this.nursePrefs = [];
    this.protectionForm = { type: 'NONE', startDate: '', endDate: '' };
    this.editingNurse.set(this.currentForm as Nurse);
  }

  openEditModal(nurse: Nurse): void {
    this.isCreating = false;
    this.currentForm = { ...nurse };

    // Load preferences
    this.nursePrefs = JSON.parse(
      JSON.stringify(this.dataService.preferences().filter((p) => p.nurse_id === nurse.nurse_id))
    );

    // Load protection
    const p = this.dataService.nurseProtections().find((pt) => pt.nurse_id === nurse.nurse_id);
    if (p) {
      this.protectionForm = {
        type: p.protection_type,
        startDate: p.start_date,
        endDate: p.end_date,
      };
    } else {
      this.protectionForm = { type: 'NONE', startDate: '', endDate: '' };
    }

    this.editingNurse.set(nurse);
  }

  closeEditModal(): void {
    this.editingNurse.set(null);
  }

  checkZeroHours(): void {
    if (!this.currentForm.max_month_hours || this.currentForm.max_month_hours <= 0) {
      alert('月工時上限不得為 0，系統已自動調整回法定基準 184 小時！');
      this.currentForm.max_month_hours = 184;
    }
  }

  addPref(): void {
    const firstShiftId = this.unitShifts()[0]?.shift_id || 1;
    this.nursePrefs.push({
      pref_id: Date.now() + Math.floor(Math.random() * 1000),
      nurse_id: this.currentForm.nurse_id || 0,
      pref_type: 'F',
      shift_id: firstShiftId,
      weekday: null,
      strength: 10,
    });
  }

  removePref(index: number): void {
    this.nursePrefs.splice(index, 1);
  }

  saveNurse(): void {
    if (!this.currentForm.name || !this.currentForm.emp_no) {
      alert('請填妥員工編號與姓名！');
      return;
    }

    this.checkZeroHours();

    let nurseId = this.currentForm.nurse_id;
    if (this.isCreating) {
      const all = this.dataService.nurses();
      const maxId = all.reduce((m, n) => Math.max(m, n.nurse_id), 0);
      nurseId = maxId + 1;
      this.currentForm.nurse_id = nurseId;
    }

    const savedNurse: Nurse = {
      nurse_id: nurseId!,
      unit_id: this.currentForm.unit_id || this.selectedUnitId,
      emp_no: this.currentForm.emp_no!,
      name: this.currentForm.name!,
      sex: this.currentForm.sex || 'F',
      level: this.currentForm.level || 'N',
      employment_type: this.currentForm.employment_type || 'F',
      can_lead: !!this.currentForm.can_lead,
      can_night: !!this.currentForm.can_night,
      max_month_hours: this.currentForm.max_month_hours || 184,
      monthly_off_days: this.currentForm.monthly_off_days || 8,
      is_active: this.currentForm.is_active ?? true,
      phone: this.currentForm.phone,
      shift_change_consent: !!this.currentForm.shift_change_consent,
    };

    this.dataService.saveNurse(savedNurse);

    // Save preferences
    const validPrefs = this.nursePrefs.map((p) => ({ ...p, nurse_id: nurseId! }));
    this.dataService.savePreferences(nurseId!, validPrefs);

    // Save protections
    if (this.protectionForm.type !== 'NONE') {
      const p: NurseProtection = {
        protection_id: Date.now(),
        nurse_id: nurseId!,
        protection_type: this.protectionForm.type as any,
        start_date: this.protectionForm.startDate || '2026-01-01',
        end_date: this.protectionForm.endDate || '2026-12-31',
        note: '母性健康保護紀錄',
      };
      this.dataService.saveProtections(nurseId!, [p]);
    } else {
      this.dataService.saveProtections(nurseId!, []);
    }

    this.closeEditModal();
  }
}
