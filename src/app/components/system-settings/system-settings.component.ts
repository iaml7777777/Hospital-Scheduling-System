import { Component, inject, computed, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { DataService } from '../../services/data.service';
import { AuthService } from '../../services/auth.service';
import { UserAccount, Holiday, SystemParam, LegalLimit } from '../../models/schedule.models';

@Component({
  selector: 'app-system-settings',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="page-container">
      <div class="card" style="margin-bottom: 20px;">
        <h2>
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <circle cx="12" cy="12" r="3"></circle>
            <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path>
          </svg>
          系統整體參數與帳號維護 (UI-10 - 系統管理員專屬)
        </h2>
        <p class="subtitle" style="font-size: 0.85rem; color: #64748b; margin-top: 4px;">
          管理使用者帳號安全、國定假日清冊、排班演算核心權重、法定最低限制鎖定（FR-39）。
        </p>

        <!-- Tabs Navigation -->
        <div class="tabs-nav">
          <button class="tab-btn" [class.active]="activeTab === 'users'" (click)="activeTab = 'users'">
            1. 帳號與權限 (FR-03/04)
          </button>
          <button class="tab-btn" [class.active]="activeTab === 'holidays'" (click)="activeTab = 'holidays'">
            2. 國定假日與補班 (FR-31)
          </button>
          <button class="tab-btn" [class.active]="activeTab === 'params'" (click)="activeTab = 'params'">
            3. 排班規則參數 (FR-32/39)
          </button>
          <button class="tab-btn" [class.active]="activeTab === 'weights'" (click)="activeTab = 'weights'">
            4. 排班權重與亂數種子 (FR-33)
          </button>
          <button class="tab-btn" [class.active]="activeTab === 'limits'" (click)="activeTab = 'limits'">
            5. 法定限制值 (LEGAL_LIMIT)
          </button>
        </div>
      </div>

      <!-- Tab 1: User Accounts -->
      <div class="card" *ngIf="activeTab === 'users'">
        <div class="card-header">
          <h3>使用者帳號與權限清單</h3>
          <button class="btn btn-primary btn-sm" (click)="openNewUserModal()">+ 新增帳號</button>
        </div>

        <table class="data-table">
          <thead>
            <tr>
              <th>帳號</th>
              <th>顯示名稱</th>
              <th>角色</th>
              <th>所屬單位</th>
              <th>對應同仁</th>
              <th>登入狀態</th>
              <th>首次改密碼</th>
              <th>操作</th>
            </tr>
          </thead>
          <tbody>
            <tr *ngFor="let u of userAccounts()">
              <td><strong>{{ u.login }}</strong></td>
              <td>{{ u.display_name }}</td>
              <td>
                <span class="badge" [ngClass]="u.role === 'A' ? 'badge-purple' : u.role === 'H' ? 'badge-primary' : 'badge-neutral'">
                  {{ u.role === 'A' ? '系統管理員' : u.role === 'H' ? '護理長' : '護理同仁' }}
                </span>
              </td>
              <td>{{ getUnitName(u.unit_id) }}</td>
              <td>{{ getNurseName(u.nurse_id) }}</td>
              <td>
                <span class="badge" [ngClass]="u.is_locked ? 'badge-danger' : 'badge-success'">
                  {{ u.is_locked ? '已鎖定 (' + u.failed_count + '次錯誤)' : '正常' }}
                </span>
              </td>
              <td>{{ u.must_change_pw ? '強制變更' : '否' }}</td>
              <td>
                <div style="display: flex; gap: 6px;">
                  <button *ngIf="u.is_locked" class="btn btn-success btn-sm" (click)="unlockUser(u)">解鎖</button>
                  <button class="btn btn-secondary btn-sm" (click)="resetPassword(u)">重設密碼</button>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <!-- Tab 2: Holidays -->
      <div class="card" *ngIf="activeTab === 'holidays'">
        <div class="card-header">
          <h3>2026 年國定假日與政府補班日清冊 (FR-31)</h3>
          <button class="btn btn-primary btn-sm" (click)="addHoliday()">+ 新增假日</button>
        </div>

        <table class="data-table">
          <thead>
            <tr>
              <th>日期 (YYYY-MM-DD)</th>
              <th>節日名稱</th>
              <th>類型判定</th>
              <th>操作</th>
            </tr>
          </thead>
          <tbody>
            <tr *ngFor="let h of holidays(); let idx = index">
              <td>
                <input type="date" [(ngModel)]="h.holiday_date" />
              </td>
              <td>
                <input type="text" [(ngModel)]="h.name" />
              </td>
              <td>
                <label style="display: flex; align-items: center; gap: 6px; font-size: 0.85rem; cursor: pointer;">
                  <input type="checkbox" [(ngModel)]="h.is_makeup_workday" />
                  <span>{{ h.is_makeup_workday ? '補行上班日 (視同平日)' : '國定假日 (H 放假日)' }}</span>
                </label>
              </td>
              <td>
                <button class="btn btn-danger btn-sm" (click)="removeHoliday(idx)">刪除</button>
              </td>
            </tr>
          </tbody>
        </table>

        <div style="margin-top: 16px;">
          <button class="btn btn-primary" (click)="saveHolidays()">儲存國定假日設定</button>
        </div>
      </div>

      <!-- Tab 3: Scheduling Rule Parameters -->
      <div class="card" *ngIf="activeTab === 'params'">
        <div class="card-header">
          <h3>排班規則核心參數 (FR-32, FR-39)</h3>
          <button class="btn btn-primary btn-sm" (click)="saveSystemParams()">儲存參數設定</button>
        </div>

        <div class="legal-alert-box">
          <strong>法定基準下限強制鎖定 (FR-39)：</strong>
          依勞基法 §34 第2項，班次間隔最少休息時數不得低於 11 小時；院內設定只能更嚴，系統拒絕輸入低於法定標準之數值。
        </div>

        <div class="params-grid">
          <div class="param-card" *ngFor="let p of filterParams('RULE')">
            <label class="param-title">{{ p.description }}</label>
            <div class="param-input-wrap">
              <input
                type="number"
                [(ngModel)]="p.param_value"
                [disabled]="p.param_key === 'min_rest_hours_locked'"
                (change)="validateParam(p)"
              />
              <span class="param-key">[{{ p.param_key }}]</span>
            </div>
          </div>
        </div>
      </div>

      <!-- Tab 4: Optimization Weights & Random Seed -->
      <div class="card" *ngIf="activeTab === 'weights'">
        <div class="card-header">
          <h3>加權扣分最佳化權重與隨機種子 (FR-32, FR-33)</h3>
          <button class="btn btn-primary btn-sm" (click)="saveSystemParams()">儲存權重與種子</button>
        </div>

        <p class="section-desc" style="font-size: 0.85rem; color: #64748b; margin-bottom: 16px;">
          排班引擎以加權扣分最小化進行搜尋。硬性規則權重維持在數百～上千分，軟性公平度維持在數十分，避免為了公平而犧牲勞動休息保障。
        </p>

        <div class="params-grid">
          <div class="param-card" *ngFor="let p of filterParams('WEIGHT')">
            <label class="param-title">{{ p.description }}</label>
            <div class="param-input-wrap">
              <input type="number" [(ngModel)]="p.param_value" />
              <span class="param-key">[{{ p.param_key }}]</span>
            </div>
          </div>
        </div>
      </div>

      <!-- Tab 5: Legal Limits Table -->
      <div class="card" *ngIf="activeTab === 'limits'">
        <div class="card-header">
          <h3>法定限制值資料表 (LEGAL_LIMIT)</h3>
          <span class="badge badge-success">衛生福利部 & 勞基法標準</span>
        </div>

        <p class="section-desc" style="font-size: 0.85rem; color: #64748b; margin-bottom: 16px;">
          法定限制值抽離儲存於資料庫，未來若法令修正時只需更新限制值，全院排班驗證立即套用。
        </p>

        <table class="data-table">
          <thead>
            <tr>
              <th>規則代號</th>
              <th>適用工時制</th>
              <th>限制鍵值</th>
              <th>法定基準值</th>
              <th>法規條號來源</th>
            </tr>
          </thead>
          <tbody>
            <tr *ngFor="let l of legalLimits()">
              <td><strong>{{ l.rule_code }}</strong></td>
              <td>{{ l.work_time_system === '*' ? '全工時制通用' : l.work_time_system + '週彈性工時' }}</td>
              <td><code>{{ l.limit_key }}</code></td>
              <td><strong>{{ l.limit_value }}</strong></td>
              <td><span class="badge badge-neutral">{{ l.law_ref }}</span></td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  `,
  styles: [`
    .tabs-nav {
      display: flex;
      gap: 6px;
      border-bottom: 1px solid var(--border-color);
      margin-top: 16px;
      overflow-x: auto;

      .tab-btn {
        padding: 8px 14px;
        font-size: 0.85rem;
        font-weight: 500;
        color: #64748b;
        border-bottom: 2px solid transparent;
        white-space: nowrap;

        &:hover { color: #0f172a; }
        &.active {
          color: var(--primary);
          border-bottom-color: var(--primary);
          font-weight: 600;
        }
      }
    }

    .legal-alert-box {
      background: #eff6ff;
      border: 1px solid #bfdbfe;
      padding: 12px 16px;
      border-radius: 8px;
      font-size: 0.85rem;
      color: #1e40af;
      margin-bottom: 18px;
    }

    .params-grid {
      display: grid;
      grid-template-columns: repeat(2, 1fr);
      gap: 16px;

      .param-card {
        background: #f8fafc;
        border: 1px solid var(--border-color);
        padding: 14px;
        border-radius: 8px;

        .param-title {
          font-size: 0.85rem;
          font-weight: 600;
          color: #1e293b;
          display: block;
          margin-bottom: 6px;
        }

        .param-input-wrap {
          display: flex;
          align-items: center;
          gap: 10px;

          input {
            width: 120px;
            padding: 6px 10px;
            border: 1px solid var(--border-color);
            border-radius: 6px;
            background: #fff;
            font-size: 0.9rem;
          }

          .param-key {
            font-size: 0.72rem;
            color: #94a3b8;
            font-family: monospace;
          }
        }
      }
    }
  `],
})
export class SystemSettingsComponent {
  private dataService = inject(DataService);
  activeTab = 'users';

  userAccounts = computed(() => this.dataService.userAccounts());
  holidays = computed(() => this.dataService.holidays());
  systemParams = computed(() => this.dataService.systemParams());
  legalLimits = computed(() => this.dataService.legalLimits());

  getUnitName(unitId: number | null): string {
    if (!unitId) return '全院通用 (無特定單位)';
    const u = this.dataService.units().find((unit) => unit.unit_id === unitId);
    return u ? `${u.code} - ${u.name}` : `單位 #${unitId}`;
  }

  getNurseName(nurseId: number | null): string {
    if (!nurseId) return '無對應同仁';
    const n = this.dataService.nurses().find((nurse) => nurse.nurse_id === nurseId);
    return n ? `${n.name} (#${n.emp_no})` : `同仁 #${nurseId}`;
  }

  unlockUser(u: UserAccount): void {
    const updated: UserAccount = { ...u, is_locked: false, failed_count: 0 };
    this.dataService.saveUserAccount(updated);
    alert(`帳號 ${u.login} 已成功解鎖！`);
  }

  resetPassword(u: UserAccount): void {
    const newPw = prompt(`請輸入為帳號 ${u.login} 重設的新密碼：`, 'user123');
    if (newPw && newPw.length >= 6) {
      const updated: UserAccount = {
        ...u,
        password_hash: newPw,
        must_change_pw: true,
      };
      this.dataService.saveUserAccount(updated);
      alert(`帳號 ${u.login} 密碼已重設，下次登入將強制要求變更密碼！`);
    } else if (newPw !== null) {
      alert('密碼長度至少需 6 個字元！');
    }
  }

  openNewUserModal(): void {
    const login = prompt('請輸入新帳號名稱 (例如: user3)：');
    if (!login) return;
    const name = prompt('請輸入顯示名稱 (例如: 加護病房護理長)：') || login;

    const all = this.dataService.userAccounts();
    const maxId = all.reduce((m, item) => Math.max(m, item.user_id), 0);
    const newUser: UserAccount = {
      user_id: maxId + 1,
      login,
      display_name: name,
      password_hash: 'user123',
      role: 'H',
      unit_id: 1,
      nurse_id: null,
      must_change_pw: true,
      failed_count: 0,
      is_locked: false,
    };
    this.dataService.saveUserAccount(newUser);
    alert(`帳號 ${login} 已建立完成，預設密碼為 user123！`);
  }

  // --- Holidays ---
  addHoliday(): void {
    const list = [...this.dataService.holidays()];
    list.push({
      holiday_date: '2026-12-25',
      name: '行憲紀念日',
      is_makeup_workday: false,
    });
    this.dataService.saveHolidays(list);
  }

  removeHoliday(idx: number): void {
    const list = [...this.dataService.holidays()];
    list.splice(idx, 1);
    this.dataService.saveHolidays(list);
  }

  saveHolidays(): void {
    this.dataService.saveHolidays(this.dataService.holidays());
    alert('國定假日清冊設定已儲存！');
  }

  // --- Params ---
  filterParams(type: 'RULE' | 'WEIGHT'): SystemParam[] {
    const list = this.dataService.systemParams();
    if (type === 'WEIGHT') {
      return list.filter((p) => p.param_key.startsWith('w_') || p.param_key === 'random_seed' || p.param_key.includes('iteration') || p.param_key.includes('time'));
    }
    return list.filter((p) => !p.param_key.startsWith('w_') && p.param_key !== 'random_seed' && !p.param_key.includes('iteration') && !p.param_key.includes('time'));
  }

  validateParam(p: SystemParam): void {
    // FR-39: 最少休息時數不得低於 11 小時
    if (p.param_key === 'min_rest_hours') {
      const val = parseFloat(p.param_value);
      if (val < 11.0) {
        alert('依勞基法 §34 第2項，班次間隔最少休息時數不得低於 11 小時！系統已自動修正回法定基準 11 小時。');
        p.param_value = '11';
      }
    }
  }

  saveSystemParams(): void {
    this.dataService.saveSystemParams(this.dataService.systemParams());
    alert('系統參數與最佳化權重已成功儲存！');
  }
}
