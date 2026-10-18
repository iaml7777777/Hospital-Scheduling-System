import { Component, inject, OnInit, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AuthService } from '../../services/auth.service';
import { DataService } from '../../services/data.service';
import { Shift, Nurse, ScheduleCell, Schedule } from '../../models/schedule.models';

interface CalendarDay {
  date: Date;
  dateStr: string;
  dayNumber: number;
  isCurrentMonth: boolean;
  isWeekend: boolean;
  isHoliday: boolean;
  holidayName?: string;
  shift: Shift | null;
  cell: ScheduleCell | null;
}

@Component({
  selector: 'app-my-schedule',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="page-container">
      <!-- Header Banner -->
      <div class="card" style="margin-bottom: 20px;">
        <div class="my-header">
          <div>
            <h2>
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect>
                <line x1="16" y1="2" x2="16" y2="6"></line>
                <line x1="8" y1="2" x2="8" y2="6"></line>
                <line x1="3" y1="10" x2="21" y2="10"></line>
              </svg>
              我的個人排班月曆
            </h2>
            <p class="text-muted">
              {{ currentNurse()?.name }} 護理師 ({{ currentNurse()?.level }}) |
              所屬單位：{{ currentUnit()?.name }} ({{ currentUnit()?.code }})
            </p>
          </div>

          <div class="month-selector">
            <button class="btn btn-secondary btn-sm" (click)="changeMonth(-1)">◀ 上個月</button>
            <span class="current-month-text">{{ selectedYear }} 年 {{ selectedMonth }} 月</span>
            <button class="btn btn-secondary btn-sm" (click)="changeMonth(1)">下個月 ▶</button>
          </div>
        </div>
      </div>

      <!-- Notice when schedule is draft or not yet created -->
      <div *ngIf="!isSchedulePublished()" class="card draft-notice">
        <div class="notice-icon">
          <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="#d97706" stroke-width="2">
            <circle cx="12" cy="12" r="10"></circle>
            <line x1="12" y1="8" x2="12" y2="12"></line>
            <line x1="12" y1="16" x2="12.01" y2="16"></line>
          </svg>
        </div>
        <div>
          <h3>{{ selectedYear }} 年 {{ selectedMonth }} 月班表編排中</h3>
          <p>
            依系統權限規範，護理長尚未公布正式班表前暫不開放預覽。公布後您將可在此查看班表並進行找人換班。
          </p>
        </div>
      </div>

      <!-- Published Schedule Content -->
      <ng-container *ngIf="isSchedulePublished()">
        <!-- Personal Monthly Statistics (FR-26) -->
        <div class="metrics-grid">
          <div class="metric-card">
            <div class="metric-icon blue">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect>
              </svg>
            </div>
            <div class="metric-info">
              <div class="metric-value">{{ personalStats().workDays }} 天</div>
              <div class="metric-label">當月上班總天數</div>
            </div>
          </div>

          <div class="metric-card">
            <div class="metric-icon green">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <circle cx="12" cy="12" r="10"></circle>
              </svg>
            </div>
            <div class="metric-info">
              <div class="metric-value">{{ personalStats().offDays }} 天</div>
              <div class="metric-label">當月休假總天數</div>
            </div>
          </div>

          <div class="metric-card">
            <div class="metric-icon purple">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path>
              </svg>
            </div>
            <div class="metric-info">
              <div class="metric-value">{{ personalStats().nightShifts }} 班</div>
              <div class="metric-label">夜班次數 (小夜+大夜)</div>
            </div>
          </div>

          <div class="metric-card">
            <div class="metric-icon amber">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <circle cx="12" cy="12" r="10"></circle>
                <polyline points="12 6 12 12 16 14"></polyline>
              </svg>
            </div>
            <div class="metric-info">
              <div class="metric-value">{{ personalStats().totalHours }} 小時</div>
              <div class="metric-label">當月總工時 (上限 {{ currentNurse()?.max_month_hours || 184 }}h)</div>
            </div>
          </div>
        </div>

        <!-- Monthly Calendar View -->
        <div class="card calendar-card">
          <!-- Weekday Headers -->
          <div class="calendar-header-grid">
            <div class="weekday weekend">星期日 (Sun)</div>
            <div class="weekday">星期一 (Mon)</div>
            <div class="weekday">星期二 (Tue)</div>
            <div class="weekday">星期三 (Wed)</div>
            <div class="weekday">星期四 (Thu)</div>
            <div class="weekday">星期五 (Fri)</div>
            <div class="weekday weekend">星期六 (Sat)</div>
          </div>

          <!-- Calendar Days Grid -->
          <div class="calendar-days-grid">
            <div
              *ngFor="let day of calendarDays()"
              class="cal-day-cell"
              [class.not-current-month]="!day.isCurrentMonth"
              [class.is-weekend]="day.isWeekend"
              [class.is-holiday]="day.isHoliday"
            >
              <div class="cal-day-top">
                <span class="cal-day-num">{{ day.dayNumber }}</span>
                <span *ngIf="day.holidayName" class="holiday-pill">{{ day.holidayName }}</span>
              </div>

              <!-- Shift Card or Off Card -->
              <div class="cal-shift-content" *ngIf="day.isCurrentMonth">
                <ng-container *ngIf="day.shift; else offDayBlock">
                  <div class="shift-card" [style.border-left-color]="day.shift.color">
                    <div class="shift-name-row">
                      <span class="shift-code-tag" [style.background]="day.shift.color">
                        {{ day.shift.code }}
                      </span>
                      <strong>{{ day.shift.name }}</strong>
                    </div>
                    <div class="shift-time">{{ day.shift.start_time }} - {{ day.shift.end_time }}</div>
                    <div class="shift-hours">工時：{{ day.shift.work_hours }}h</div>

                    <!-- UI-11a "找人換班" Button on Work Days -->
                    <button
                      *ngIf="canRequestSwap(day.dateStr)"
                      class="btn btn-outline-primary btn-sm swap-btn"
                      (click)="openSwapModal(day)"
                    >
                      找人換班
                    </button>
                  </div>
                </ng-container>

                <ng-template #offDayBlock>
                  <div class="off-day-card">
                    <span class="off-title">休假</span>
                    <span class="off-sub">{{ getOffTypeLabel(day.cell?.off_type) }}</span>
                  </div>
                </ng-template>
              </div>
            </div>
          </div>
        </div>
      </ng-container>

      <!-- UI-11a Swap Request Modal -->
      <div class="modal-overlay" *ngIf="swapTargetDay()" (click)="closeSwapModal()">
        <div class="modal-content" (click)="$event.stopPropagation()">
          <div class="card-header">
            <h3>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M16 3h5v5"></path>
                <path d="M4 20L21 3"></path>
              </svg>
              提出換班申請
            </h3>
            <button class="btn btn-sm" (click)="closeSwapModal()">✕</button>
          </div>

          <div class="swap-form-info">
            <div class="info-row">
              <span class="label">您欲調換的班別：</span>
              <strong>
                {{ swapTargetDay()?.dateStr }} - {{ swapTargetDay()?.shift?.name }} ({{ swapTargetDay()?.shift?.code }})
              </strong>
            </div>
          </div>

          <form (ngSubmit)="submitSwapRequest()">
            <div class="form-group">
              <label>想跟哪位同仁換班？ *</label>
              <select [(ngModel)]="selectedColleagueId" name="colleague" required (change)="onColleagueChange()">
                <option [value]="null">-- 請選擇同仁 --</option>
                <option *ngFor="let n of colleagues()" [value]="n.nurse_id">
                  {{ n.name }} (#{{ n.emp_no }} - {{ n.level }})
                </option>
              </select>
            </div>

            <div class="form-group" *ngIf="selectedColleagueId">
              <label>對方的哪一天班別？ *</label>
              <select [(ngModel)]="selectedColleagueDate" name="colleagueDate" required>
                <option value="">-- 請選擇日期班別 --</option>
                <option *ngFor="let s of colleagueAvailableShifts()" [value]="s.work_date">
                  {{ s.work_date }} - {{ s.shiftName }} ({{ s.shiftCode }})
                </option>
              </select>
            </div>

            <div class="form-group">
              <label>換班事由 *</label>
              <textarea
                [(ngModel)]="swapReason"
                name="reason"
                required
                rows="3"
                placeholder="請輸入換班事由 (例如: 10/28 家中有事需調班)"
              ></textarea>
            </div>

            <div class="modal-footer" style="display: flex; justify-content: flex-end; gap: 10px; margin-top: 20px;">
              <button type="button" class="btn btn-secondary" (click)="closeSwapModal()">取消</button>
              <button
                type="submit"
                class="btn btn-primary"
                [disabled]="!selectedColleagueId || !selectedColleagueDate || !swapReason"
              >
                送出申請 (待對方同意)
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .my-header {
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
        color: var(--text-main);
      }

      .text-muted {
        font-size: 0.85rem;
        color: #64748b;
        margin-top: 4px;
      }

      .month-selector {
        display: flex;
        align-items: center;
        gap: 12px;

        .current-month-text {
          font-weight: 700;
          font-size: 1.05rem;
          color: #0f172a;
        }
      }
    }

    .draft-notice {
      display: flex;
      align-items: center;
      gap: 20px;
      background: #fffbeb;
      border: 1px solid #fef3c7;
      padding: 24px;

      h3 {
        font-size: 1.15rem;
        color: #92400e;
        margin-bottom: 6px;
      }

      p {
        font-size: 0.88rem;
        color: #b45309;
        line-height: 1.5;
      }
    }

    .metrics-grid {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 14px;
      margin-bottom: 20px;

      .metric-card {
        background: #fff;
        border: 1px solid var(--border-color);
        border-radius: 10px;
        padding: 16px;
        display: flex;
        align-items: center;
        gap: 14px;

        .metric-icon {
          width: 44px;
          height: 44px;
          border-radius: 10px;
          display: flex;
          align-items: center;
          justify-content: center;

          &.blue { background: #e0f2fe; color: #0284c7; }
          &.green { background: #d1fae5; color: #059669; }
          &.purple { background: #ede9fe; color: #7c3aed; }
          &.amber { background: #fef3c7; color: #d97706; }
        }

        .metric-value {
          font-size: 1.25rem;
          font-weight: 700;
          color: #0f172a;
        }

        .metric-label {
          font-size: 0.78rem;
          color: #64748b;
          margin-top: 2px;
        }
      }
    }

    .calendar-card {
      padding: 0;
      overflow: hidden;
    }

    .calendar-header-grid {
      display: grid;
      grid-template-columns: repeat(7, 1fr);
      background: #f1f5f9;
      border-bottom: 1px solid var(--border-color);

      .weekday {
        padding: 12px;
        text-align: center;
        font-size: 0.82rem;
        font-weight: 600;
        color: #475569;

        &.weekend {
          color: #0284c7;
        }
      }
    }

    .calendar-days-grid {
      display: grid;
      grid-template-columns: repeat(7, 1fr);
      background: var(--border-color);
      gap: 1px;

      .cal-day-cell {
        background: #fff;
        min-height: 120px;
        padding: 8px;
        display: flex;
        flex-direction: column;

        &.not-current-month {
          background: #fafafa;
          opacity: 0.4;
        }

        &.is-weekend {
          background: #fcfcfd;
        }

        &.is-holiday {
          background: #fff1f2;
        }

        .cal-day-top {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 6px;

          .cal-day-num {
            font-weight: 700;
            font-size: 0.88rem;
            color: #1e293b;
          }

          .holiday-pill {
            font-size: 0.65rem;
            color: #be123c;
            background: #ffe4e6;
            padding: 1px 4px;
            border-radius: 3px;
          }
        }

        .cal-shift-content {
          flex: 1;
        }

        .shift-card {
          background: #f8fafc;
          border: 1px solid #e2e8f0;
          border-left: 4px solid #0284c7;
          border-radius: 6px;
          padding: 8px;
          font-size: 0.78rem;

          .shift-name-row {
            display: flex;
            align-items: center;
            gap: 6px;
            margin-bottom: 4px;

            .shift-code-tag {
              color: #fff;
              font-weight: 700;
              padding: 1px 5px;
              border-radius: 3px;
              font-size: 0.72rem;
            }
          }

          .shift-time {
            color: #64748b;
            margin-bottom: 2px;
          }

          .shift-hours {
            color: #475569;
            font-weight: 500;
            margin-bottom: 6px;
          }

          .swap-btn {
            width: 100%;
            padding: 3px 6px;
            font-size: 0.72rem;
          }
        }

        .off-day-card {
          background: #f1f5f9;
          border-radius: 6px;
          padding: 12px 8px;
          text-align: center;
          display: flex;
          flex-direction: column;
          gap: 2px;

          .off-title {
            font-weight: 600;
            color: #64748b;
            font-size: 0.82rem;
          }

          .off-sub {
            font-size: 0.7rem;
            color: #94a3b8;
          }
        }
      }
    }

    .swap-form-info {
      background: #f0f9ff;
      border: 1px solid #bae6fd;
      padding: 12px;
      border-radius: 8px;
      margin-bottom: 16px;
      font-size: 0.85rem;

      .info-row {
        color: #0369a1;
      }
    }
  `],
})
export class MyScheduleComponent implements OnInit {
  private auth = inject(AuthService);
  private dataService = inject(DataService);

  selectedYear = 2026;
  selectedMonth = 10;

  // Swap modal
  swapTargetDay = signal<CalendarDay | null>(null);
  selectedColleagueId: number | null = null;
  selectedColleagueDate = '';
  swapReason = '';

  currentNurse = computed(() => {
    const user = this.auth.currentUser();
    if (!user?.nurse_id) return null;
    return this.dataService.nurses().find((n) => n.nurse_id === user.nurse_id) || null;
  });

  currentUnit = computed(() => {
    const nurse = this.currentNurse();
    if (!nurse) return null;
    return this.dataService.units().find((u) => u.unit_id === nurse.unit_id) || null;
  });

  currentSchedule = computed(() => {
    const unit = this.currentUnit();
    if (!unit) return null;
    return (
      this.dataService
        .schedules()
        .find((s) => s.unit_id === unit.unit_id && s.year === this.selectedYear && s.month === this.selectedMonth) ||
      null
    );
  });

  isSchedulePublished = computed(() => {
    const s = this.currentSchedule();
    return s?.status === 'P' || s?.status === 'C';
  });

  colleagues = computed(() => {
    const nurse = this.currentNurse();
    if (!nurse) return [];
    return this.dataService
      .nurses()
      .filter((n) => n.unit_id === nurse.unit_id && n.nurse_id !== nurse.nurse_id && n.is_active);
  });

  ngOnInit(): void {
    // defaults
  }

  changeMonth(delta: number): void {
    let m = this.selectedMonth + delta;
    let y = this.selectedYear;
    if (m > 12) {
      m = 1;
      y++;
    } else if (m < 1) {
      m = 12;
      y--;
    }
    this.selectedYear = y;
    this.selectedMonth = m;
  }

  calendarDays = computed(() => {
    const days: CalendarDay[] = [];
    const year = this.selectedYear;
    const month = this.selectedMonth;

    const firstDay = new Date(year, month - 1, 1);
    const startWeekday = firstDay.getDay(); // 0: Sun
    const totalDays = new Date(year, month, 0).getDate();

    const nurse = this.currentNurse();
    const sched = this.currentSchedule();
    const allCells = sched
      ? this.dataService.scheduleCells().filter((c) => c.schedule_id === sched.schedule_id && c.nurse_id === nurse?.nurse_id)
      : [];
    const shifts = this.dataService.shifts();
    const holidays = this.dataService.holidays();

    // Previous month filler days
    const prevMonthTotalDays = new Date(year, month - 1, 0).getDate();
    for (let i = startWeekday - 1; i >= 0; i--) {
      const dayNum = prevMonthTotalDays - i;
      const d = new Date(year, month - 2, dayNum);
      days.push({
        date: d,
        dateStr: d.toISOString().split('T')[0],
        dayNumber: dayNum,
        isCurrentMonth: false,
        isWeekend: d.getDay() === 0 || d.getDay() === 6,
        isHoliday: false,
        shift: null,
        cell: null,
      });
    }

    // Current month days
    for (let day = 1; day <= totalDays; day++) {
      const d = new Date(year, month - 1, day);
      const mStr = String(month).padStart(2, '0');
      const dStr = String(day).padStart(2, '0');
      const dateStr = `${year}-${mStr}-${dStr}`;

      const hol = holidays.find((h) => h.holiday_date === dateStr && !h.is_makeup_workday);
      const cell = allCells.find((c) => c.work_date === dateStr) || null;
      const shift = cell?.shift_id ? shifts.find((s) => s.shift_id === cell.shift_id) || null : null;

      days.push({
        date: d,
        dateStr,
        dayNumber: day,
        isCurrentMonth: true,
        isWeekend: d.getDay() === 0 || d.getDay() === 6,
        isHoliday: !!hol,
        holidayName: hol?.name,
        shift,
        cell,
      });
    }

    // Next month filler days to complete rows of 7
    const remaining = (7 - (days.length % 7)) % 7;
    for (let i = 1; i <= remaining; i++) {
      const d = new Date(year, month, i);
      days.push({
        date: d,
        dateStr: d.toISOString().split('T')[0],
        dayNumber: i,
        isCurrentMonth: false,
        isWeekend: d.getDay() === 0 || d.getDay() === 6,
        isHoliday: false,
        shift: null,
        cell: null,
      });
    }

    return days;
  });

  personalStats = computed(() => {
    let workDays = 0;
    let offDays = 0;
    let nightShifts = 0;
    let totalHours = 0;

    for (const d of this.calendarDays()) {
      if (!d.isCurrentMonth) continue;
      if (d.shift) {
        workDays++;
        totalHours += d.shift.work_hours;
        if (d.shift.is_night) nightShifts++;
      } else {
        offDays++;
      }
    }

    return { workDays, offDays, nightShifts, totalHours };
  });

  getOffTypeLabel(offType?: string | null): string {
    switch (offType) {
      case 'R': return '法定例假';
      case 'S': return '休息日';
      case 'H': return '國定假日休';
      case 'A': return '特別休假';
      case 'O': return '其他請休';
      default: return '例假';
    }
  }

  canRequestSwap(dateStr: string): boolean {
    const today = new Date().toISOString().split('T')[0];
    return dateStr >= today && this.currentSchedule()?.status === 'P';
  }

  openSwapModal(day: CalendarDay): void {
    this.swapTargetDay.set(day);
    this.selectedColleagueId = null;
    this.selectedColleagueDate = '';
    this.swapReason = '';
  }

  closeSwapModal(): void {
    this.swapTargetDay.set(null);
  }

  onColleagueChange(): void {
    this.selectedColleagueDate = '';
  }

  colleagueAvailableShifts = computed(() => {
    const cid = this.selectedColleagueId;
    const sched = this.currentSchedule();
    if (!cid || !sched) return [];

    const shifts = this.dataService.shifts();
    const today = new Date().toISOString().split('T')[0];

    const colleagueCells = this.dataService
      .scheduleCells()
      .filter((c) => c.schedule_id === sched.schedule_id && c.nurse_id === cid && c.shift_id !== null && c.work_date >= today);

    return colleagueCells.map((c) => {
      const shift = shifts.find((s) => s.shift_id === c.shift_id);
      return {
        work_date: c.work_date,
        shiftId: c.shift_id,
        shiftName: shift?.name || '班別',
        shiftCode: shift?.code || '班',
      };
    });
  });

  submitSwapRequest(): void {
    const nurse = this.currentNurse();
    const sched = this.currentSchedule();
    const targetDay = this.swapTargetDay();
    if (!nurse || !sched || !targetDay || !this.selectedColleagueId || !this.selectedColleagueDate) return;

    this.dataService.addSwapRequest({
      schedule_id: sched.schedule_id,
      requester_id: nurse.nurse_id,
      requester_date: targetDay.dateStr,
      target_id: this.selectedColleagueId,
      target_date: this.selectedColleagueDate,
      reason: this.swapReason,
      status: 'P', // 待對方同意
    });

    alert('換班申請已送出！請等待對方同仁於換班專區點擊「同意」，護理長核准後即生效對調。');
    this.closeSwapModal();
  }
}
