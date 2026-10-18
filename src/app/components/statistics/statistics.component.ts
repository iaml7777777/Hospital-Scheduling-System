import { Component, inject, computed, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { DataService } from '../../services/data.service';
import { AuthService } from '../../services/auth.service';
import { RuleCheckerService } from '../../services/rule-checker.service';
import { Nurse, Shift, ScheduleCell } from '../../models/schedule.models';

@Component({
  selector: 'app-statistics',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="page-container">
      <div class="card" style="margin-bottom: 20px;">
        <div class="stat-header">
          <div>
            <h2>
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <line x1="18" y1="20" x2="18" y2="10"></line>
                <line x1="12" y1="20" x2="12" y2="4"></line>
                <line x1="6" y1="20" x2="6" y2="14"></line>
              </svg>
              排班統計與公平度分析報表 (UI-07, FR-30, FR-42)
            </h2>
            <p class="subtitle" style="font-size: 0.85rem; color: #64748b; margin-top: 4px;">
              提供同仁各班班數、時數、最長連續出勤統計，及夜班、假日班公平度長條圖與週期工時合規檢核表。
            </p>
          </div>

          <div class="filter-group">
            <label>護理單位：</label>
            <select [(ngModel)]="selectedUnitId" (change)="onFilterChange()">
              <option *ngFor="let u of units()" [value]="u.unit_id">{{ u.code }} - {{ u.name }}</option>
            </select>

            <label style="margin-left: 10px;">月份：</label>
            <select [(ngModel)]="selectedMonth" (change)="onFilterChange()">
              <option *ngFor="let m of [1,2,3,4,5,6,7,8,9,10,11,12]" [value]="m">{{ selectedYear }}年 {{ m }}月</option>
            </select>
          </div>
        </div>
      </div>

      <!-- Fairness Visual Charts Grid -->
      <div class="charts-grid">
        <!-- Night Shift Distribution Chart -->
        <div class="card">
          <div class="card-header">
            <h3>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#6366f1" stroke-width="2">
                <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path>
              </svg>
              夜班分配公平度長條圖 (BR-S3)
            </h3>
            <span class="badge badge-primary">平均基準：{{ nightStats().avg.toFixed(1) }} 班</span>
          </div>

          <div class="chart-container">
            <div class="chart-legend-row">
              <span class="legend-chip normal">■ 正常區間</span>
              <span class="legend-chip warning">■ 差距 ≥ 2.5 班 (不平均)</span>
              <span class="legend-chip dashed">-- 平均基準線</span>
            </div>

            <div class="bar-chart-body">
              <div class="bar-col" *ngFor="let item of nightStats().data">
                <div class="bar-track">
                  <div
                    class="bar-fill"
                    [style.height.%]="getBarPercent(item.count, nightStats().max)"
                    [ngClass]="item.isUnfair ? 'bar-warning' : 'bar-normal'"
                  >
                    <span class="bar-tooltip">{{ item.count }} 班</span>
                  </div>
                  <!-- Avg Line -->
                  <div class="avg-line" [style.bottom.%]="getBarPercent(nightStats().avg, nightStats().max)"></div>
                </div>
                <div class="bar-nurse-label" [title]="item.name">{{ item.name }}</div>
              </div>
            </div>
          </div>
        </div>

        <!-- Weekend & Holiday Distribution Chart -->
        <div class="card">
          <div class="card-header">
            <h3>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#0d9488" stroke-width="2">
                <rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect>
              </svg>
              例假日與國假出勤公平度 (BR-S4)
            </h3>
            <span class="badge badge-primary">平均基準：{{ holidayStats().avg.toFixed(1) }} 班</span>
          </div>

          <div class="chart-container">
            <div class="chart-legend-row">
              <span class="legend-chip normal">■ 正常區間</span>
              <span class="legend-chip warning">■ 差距 ≥ 2.5 班 (不平均)</span>
              <span class="legend-chip dashed">-- 平均基準線</span>
            </div>

            <div class="bar-chart-body">
              <div class="bar-col" *ngFor="let item of holidayStats().data">
                <div class="bar-track">
                  <div
                    class="bar-fill"
                    [style.height.%]="getBarPercent(item.count, holidayStats().max)"
                    [ngClass]="item.isUnfair ? 'bar-warning' : 'bar-teal'"
                  >
                    <span class="bar-tooltip">{{ item.count }} 班</span>
                  </div>
                  <!-- Avg Line -->
                  <div class="avg-line" [style.bottom.%]="getBarPercent(holidayStats().avg, holidayStats().max)"></div>
                </div>
                <div class="bar-nurse-label" [title]="item.name">{{ item.name }}</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Individual Details Table -->
      <div class="card">
        <div class="card-header">
          <h3>個人班次與工時統計表 (FR-30)</h3>
          <span class="badge badge-neutral">在職同仁共 {{ nurseStatsList().length }} 人</span>
        </div>

        <div class="table-responsive">
          <table class="data-table">
            <thead>
              <tr>
                <th>員工編號</th>
                <th>姓名</th>
                <th>層級</th>
                <th>白班 (D)</th>
                <th>小夜 (E)</th>
                <th>大夜 (N)</th>
                <th>休假天數</th>
                <th>假日出勤</th>
                <th>總工時</th>
                <th>最長連上</th>
                <th>合規判定</th>
              </tr>
            </thead>
            <tbody>
              <tr *ngFor="let r of nurseStatsList()">
                <td>#{{ r.nurse.emp_no }}</td>
                <td><strong>{{ r.nurse.name }}</strong></td>
                <td><span class="badge badge-neutral">{{ r.nurse.level }}</span></td>
                <td>{{ r.dCount }}</td>
                <td>{{ r.eCount }}</td>
                <td>{{ r.nCount }}</td>
                <td>
                  <span [style.color]="r.offCount < 8 ? 'var(--danger)' : 'inherit'">
                    {{ r.offCount }} 日
                  </span>
                </td>
                <td>{{ r.weekendCount }}</td>
                <td>
                  <strong>{{ r.totalHours }} 小時</strong>
                  <span style="font-size: 0.72rem; color: #94a3b8;"> / {{ r.nurse.max_month_hours }}h</span>
                </td>
                <td>
                  <span [style.color]="r.maxConsecutive > 6 ? 'var(--danger)' : 'inherit'">
                    {{ r.maxConsecutive }} 天
                  </span>
                </td>
                <td>
                  <span
                    class="badge"
                    [ngClass]="r.offCount >= 8 && r.maxConsecutive <= 6 && r.totalHours <= r.nurse.max_month_hours ? 'badge-success' : 'badge-danger'"
                  >
                    {{ r.offCount >= 8 && r.maxConsecutive <= 6 && r.totalHours <= r.nurse.max_month_hours ? '合格' : '需檢討' }}
                  </span>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <!-- Four-Week Cycle Work Time & Rest Days Table (FR-42) -->
      <div class="card">
        <div class="card-header">
          <h3>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path>
            </svg>
            勞基法 §30-1 / §36 四週彈性工時週期合規檢核表 (FR-42)
          </h3>
          <span class="badge badge-primary">四週制 (28日週期)</span>
        </div>

        <div class="table-responsive">
          <table class="data-table">
            <thead>
              <tr>
                <th>同仁姓名</th>
                <th>工時制度</th>
                <th>週期法定例假 (應 ≥ 4)</th>
                <th>週期休息日 (應 ≥ 4)</th>
                <th>例休合計 (應 ≥ 8)</th>
                <th>週期正常工時 (上限 160h)</th>
                <th>勞基法 §36 判定</th>
              </tr>
            </thead>
            <tbody>
              <tr *ngFor="let r of nurseStatsList()">
                <td><strong>{{ r.nurse.name }}</strong></td>
                <td>四週彈性工時 (§30-1)</td>
                <td>{{ Math.floor(r.offCount / 2) }} 日 (例假)</td>
                <td>{{ Math.ceil(r.offCount / 2) }} 日 (休息日)</td>
                <td><strong>{{ r.offCount }} 日</strong></td>
                <td>{{ r.totalHours }} 小時</td>
                <td>
                  <span class="badge" [ngClass]="r.offCount >= 8 ? 'badge-success' : 'badge-danger'">
                    {{ r.offCount >= 8 ? '合規 (≥ 8日)' : '未達 8 日' }}
                  </span>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .stat-header {
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

      .filter-group {
        display: flex;
        align-items: center;
        gap: 8px;

        label {
          font-size: 0.85rem;
          color: #475569;
          font-weight: 500;
        }

        select {
          padding: 6px 10px;
          border-radius: 6px;
          border: 1px solid var(--border-color);
          background: #fff;
          font-size: 0.85rem;
        }
      }
    }

    .charts-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 20px;
      margin-bottom: 20px;
    }

    .chart-container {
      padding: 10px 0;

      .chart-legend-row {
        display: flex;
        gap: 14px;
        font-size: 0.75rem;
        margin-bottom: 16px;

        .legend-chip {
          display: flex;
          align-items: center;
          gap: 4px;

          &.normal { color: #0284c7; }
          &.warning { color: #f59e0b; }
          &.dashed { color: #94a3b8; }
        }
      }

      .bar-chart-body {
        display: flex;
        align-items: flex-end;
        height: 180px;
        gap: 8px;
        padding-bottom: 24px;
        position: relative;
        border-bottom: 1px solid var(--border-color);

        .bar-col {
          flex: 1;
          height: 100%;
          display: flex;
          flex-direction: column;
          align-items: center;
          position: relative;

          .bar-track {
            flex: 1;
            width: 100%;
            display: flex;
            align-items: flex-end;
            position: relative;
          }

          .bar-fill {
            width: 100%;
            border-radius: 4px 4px 0 0;
            position: relative;
            transition: height 0.3s ease;

            &:hover .bar-tooltip {
              opacity: 1;
            }

            .bar-tooltip {
              opacity: 0;
              position: absolute;
              top: -24px;
              left: 50%;
              transform: translateX(-50%);
              background: #0f172a;
              color: #fff;
              padding: 2px 6px;
              border-radius: 4px;
              font-size: 0.7rem;
              white-space: nowrap;
              pointer-events: none;
              transition: opacity 0.2s;
            }

            &.bar-normal { background: #0284c7; }
            &.bar-teal { background: #0d9488; }
            &.bar-warning { background: #f59e0b; }
          }

          .avg-line {
            position: absolute;
            left: 0;
            right: 0;
            border-top: 2px dashed #94a3b8;
            pointer-events: none;
            z-index: 2;
          }

          .bar-nurse-label {
            position: absolute;
            bottom: -22px;
            font-size: 0.7rem;
            color: #64748b;
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
            max-width: 44px;
          }
        }
      }
    }
  `],
})
export class StatisticsComponent {
  private dataService = inject(DataService);
  private ruleChecker = inject(RuleCheckerService);
  Math = Math;

  selectedUnitId = 1;
  selectedYear = 2026;
  selectedMonth = 10;

  units = computed(() => this.dataService.units());

  unitNurses = computed(() =>
    this.dataService.nurses().filter((n) => n.unit_id === this.selectedUnitId && n.is_active)
  );

  unitShifts = computed(() =>
    this.dataService.shifts().filter((s) => s.unit_id === this.selectedUnitId && s.is_active)
  );

  currentSchedule = computed(() =>
    this.dataService
      .schedules()
      .find((s) => s.unit_id === this.selectedUnitId && s.year === this.selectedYear && s.month === this.selectedMonth)
  );

  onFilterChange(): void {
    // triggers computed signals
  }

  nurseStatsList = computed(() => {
    const sched = this.currentSchedule();
    const nurses = this.unitNurses();
    const shifts = this.dataService.shifts();
    const holidays = this.dataService.holidays();
    const cells = sched
      ? this.dataService.scheduleCells().filter((c) => c.schedule_id === sched.schedule_id)
      : [];

    const dShift = shifts.find((s) => s.code === 'D')?.shift_id;
    const eShift = shifts.find((s) => s.code === 'E')?.shift_id;
    const nShift = shifts.find((s) => s.code === 'N')?.shift_id;

    return nurses.map((nurse) => {
      const nCells = cells.filter((c) => c.nurse_id === nurse.nurse_id);
      let dCount = 0;
      let eCount = 0;
      let nCount = 0;
      let offCount = 0;
      let weekendCount = 0;
      let totalHours = 0;
      let consecutive = 0;
      let maxConsecutive = 0;

      for (const cell of nCells) {
        const isWk = this.ruleChecker.getDayType(cell.work_date, holidays) !== 'W';
        if (cell.shift_id) {
          const shift = shifts.find((s) => s.shift_id === cell.shift_id);
          totalHours += shift?.work_hours || 8;
          consecutive++;
          if (consecutive > maxConsecutive) maxConsecutive = consecutive;
          if (isWk) weekendCount++;

          if (cell.shift_id === dShift) dCount++;
          else if (cell.shift_id === eShift) eCount++;
          else if (cell.shift_id === nShift) nCount++;
        } else {
          offCount++;
          consecutive = 0;
        }
      }

      return {
        nurse,
        dCount,
        eCount,
        nCount,
        nightTotal: eCount + nCount,
        offCount,
        weekendCount,
        totalHours,
        maxConsecutive,
      };
    });
  });

  nightStats = computed(() => {
    const list = this.nurseStatsList().filter((i) => i.nurse.can_night);
    if (list.length === 0) return { avg: 0, max: 1, data: [] };

    const total = list.reduce((sum, item) => sum + item.nightTotal, 0);
    const avg = total / list.length;
    const max = Math.max(...list.map((i) => i.nightTotal), 10);

    const data = list.map((item) => ({
      name: item.nurse.name,
      count: item.nightTotal,
      isUnfair: Math.abs(item.nightTotal - avg) >= 2.5,
    }));

    return { avg, max, data };
  });

  holidayStats = computed(() => {
    const list = this.nurseStatsList();
    if (list.length === 0) return { avg: 0, max: 1, data: [] };

    const total = list.reduce((sum, item) => sum + item.weekendCount, 0);
    const avg = total / list.length;
    const max = Math.max(...list.map((i) => i.weekendCount), 8);

    const data = list.map((item) => ({
      name: item.nurse.name,
      count: item.weekendCount,
      isUnfair: Math.abs(item.weekendCount - avg) >= 2.5,
    }));

    return { avg, max, data };
  });

  getBarPercent(val: number, max: number): number {
    return Math.min(100, Math.max(5, (val / max) * 100));
  }
}
