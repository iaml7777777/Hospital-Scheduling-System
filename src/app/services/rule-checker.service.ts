import { Injectable, inject } from '@angular/core';
import {
  Unit,
  Shift,
  Nurse,
  ScheduleCell,
  StaffingDemand,
  DailyDemand,
  LeaveRequest,
  Preference,
  NurseProtection,
  Holiday,
  Violation,
  SystemParam,
  DayType,
  Severity,
} from '../models/schedule.models';
import { DataService } from './data.service';

export interface ParamConfig {
  min_rest_hours: number;
  max_consecutive_days: number;
  min_monthly_off_days: number;
  default_max_month_hours: number;
  max_night_shifts_suggested: number;
  w_approved_leave: number;
  w_staffing: number;
  w_rest_hours: number;
  w_senior: number;
  w_consecutive: number;
  w_work_hours: number;
  w_overstaffing: number;
  w_night_fairness: number;
  w_holiday_fairness: number;
  w_preference: number;
  w_isolated_off: number;
}

export interface CheckResult {
  violations: Violation[];
  hardCount: number;
  softCount: number;
  totalPenalty: number;
  qualityScore: number;
  personStats: Map<
    number,
    {
      nurseId: number;
      workDays: number;
      offDays: number;
      nightShifts: number;
      weekendShifts: number;
      totalHours: number;
      maxConsecutive: number;
    }
  >;
  dailyStaffing: Map<
    string,
    Map<
      number,
      {
        shiftId: number;
        required: number;
        actual: number;
        seniorRequired: number;
        seniorActual: number;
      }
    >
  >;
}

@Injectable({
  providedIn: 'root',
})
export class RuleCheckerService {
  private dataService = inject(DataService);

  /**
   * Evaluates all rules on a monthly schedule
   */
  evaluateSchedule(
    unit: Unit,
    year: number,
    month: number,
    cells: ScheduleCell[],
    nurses: Nurse[],
    shifts: Shift[],
    daysInMonth: number,
    previousMonthEndCells: ScheduleCell[] = []
  ): CheckResult {
    const violations: Violation[] = [];
    let totalPenalty = 0;

    // Load active settings and weights
    const params = this.getParamMap();
    const holidays = this.dataService.holidays();
    const protections = this.dataService.nurseProtections();
    const preferences = this.dataService.preferences();
    const staffingDemands = this.dataService.staffingDemands();
    const dailyDemands = this.dataService.dailyDemands();
    const leaveRequests = this.dataService
      .leaveRequests()
      .filter((r) => r.status === 'A');

    // Build lookup maps
    const activeNurses = nurses.filter((n) => n.unit_id === unit.unit_id && n.is_active);
    const nurseMap = new Map(nurses.map((n) => [n.nurse_id, n]));
    const shiftMap = new Map(shifts.map((s) => [s.shift_id, s]));

    // Group cells by date and by nurse
    const cellsByDate = new Map<string, ScheduleCell[]>();
    const cellsByNurse = new Map<number, ScheduleCell[]>();

    for (let day = 1; day <= daysInMonth; day++) {
      const dateStr = this.formatDate(year, month, day);
      cellsByDate.set(dateStr, []);
    }

    for (const nurse of activeNurses) {
      cellsByNurse.set(nurse.nurse_id, []);
    }

    for (const cell of cells) {
      if (cellsByDate.has(cell.work_date)) {
        cellsByDate.get(cell.work_date)!.push(cell);
      }
      if (cellsByNurse.has(cell.nurse_id)) {
        cellsByNurse.get(cell.nurse_id)!.push(cell);
      }
    }

    // Sort cells for each nurse by date
    for (const [, nCells] of cellsByNurse) {
      nCells.sort((a, b) => a.work_date.localeCompare(b.work_date));
    }

    // 1. Staffing Demand Evaluation (BR-H1, BR-H2, BR-S1, BR-G1)
    const dailyStaffing = new Map<string, Map<number, any>>();

    for (let day = 1; day <= daysInMonth; day++) {
      const dateStr = this.formatDate(year, month, day);
      const dayType = this.getDayType(dateStr, holidays);
      const dayCells = cellsByDate.get(dateStr) || [];
      const shiftCounts = new Map<number, { actual: number; seniorActual: number }>();

      for (const shift of shifts) {
        if (!shift.is_active || shift.unit_id !== unit.unit_id) continue;
        shiftCounts.set(shift.shift_id, { actual: 0, seniorActual: 0 });
      }

      for (const cell of dayCells) {
        if (cell.shift_id && shiftCounts.has(cell.shift_id)) {
          const entry = shiftCounts.get(cell.shift_id)!;
          entry.actual++;
          const nurse = nurseMap.get(cell.nurse_id);
          if (nurse?.can_lead) {
            entry.seniorActual++;
          }
        }
      }

      const dayShiftMap = new Map<number, any>();
      dailyStaffing.set(dateStr, dayShiftMap);

      for (const shift of shifts) {
        if (!shift.is_active || shift.unit_id !== unit.unit_id) continue;
        const req = this.getDemandRequirement(shift.shift_id, dateStr, dayType, staffingDemands, dailyDemands);
        const actualEntry = shiftCounts.get(shift.shift_id) || { actual: 0, seniorActual: 0 };

        dayShiftMap.set(shift.shift_id, {
          shiftId: shift.shift_id,
          required: req.required,
          actual: actualEntry.actual,
          seniorRequired: req.seniorRequired,
          seniorActual: actualEntry.seniorActual,
        });

        // BR-H1: 人力不足
        if (actualEntry.actual < req.required) {
          const shortage = req.required - actualEntry.actual;
          const penalty = params.w_staffing * shortage;
          totalPenalty += penalty;
          violations.push({
            rule_code: 'BR-H1',
            severity: 'H',
            work_date: dateStr,
            shift_id: shift.shift_id,
            shift_code: shift.code,
            message: `${dateStr} ${shift.name} 人力不足：需求 ${req.required} 人，實際僅 ${actualEntry.actual} 人 (缺 ${shortage} 人)`,
            penalty,
          });
        }

        // BR-S1: 人力超編
        if (actualEntry.actual > req.required && req.required > 0) {
          const surplus = actualEntry.actual - req.required;
          const penalty = params.w_overstaffing * surplus;
          totalPenalty += penalty;
          violations.push({
            rule_code: 'BR-S1',
            severity: 'S',
            work_date: dateStr,
            shift_id: shift.shift_id,
            shift_code: shift.code,
            message: `${dateStr} ${shift.name} 人力超編：需求 ${req.required} 人，實際 ${actualEntry.actual} 人`,
            penalty,
          });
        }

        // Unit rule: zero_demand_hard
        if (req.required === 0 && actualEntry.actual > 0 && unit.zero_demand_hard) {
          const penalty = params.w_staffing * actualEntry.actual;
          totalPenalty += penalty;
          violations.push({
            rule_code: 'BR-H1',
            severity: 'H',
            work_date: dateStr,
            shift_id: shift.shift_id,
            shift_code: shift.code,
            message: `${dateStr} 單位設定需求為 0 不得排班，但 ${shift.name} 排了 ${actualEntry.actual} 人`,
            penalty,
          });
        }

        // BR-H2: 該班無資深人員
        if (req.seniorRequired > 0 && actualEntry.seniorActual < req.seniorRequired) {
          const penalty = params.w_senior * (req.seniorRequired - actualEntry.seniorActual);
          totalPenalty += penalty;
          violations.push({
            rule_code: 'BR-H2',
            severity: 'H',
            work_date: dateStr,
            shift_id: shift.shift_id,
            shift_code: shift.code,
            message: `${dateStr} ${shift.name} 資深人員不足：需求 ${req.seniorRequired} 人，實際 ${actualEntry.seniorActual} 人`,
            penalty,
          });
        }
      }
    }

    // 2. Individual Nurse Rules Evaluation
    const personStats = new Map<
      number,
      {
        nurseId: number;
        workDays: number;
        offDays: number;
        nightShifts: number;
        weekendShifts: number;
        totalHours: number;
        maxConsecutive: number;
      }
    >();

    const nightShiftCounts: number[] = [];
    const weekendShiftCounts: number[] = [];

    for (const nurse of activeNurses) {
      const nCells = cellsByNurse.get(nurse.nurse_id) || [];
      const nurseProtects = protections.filter((p) => p.nurse_id === nurse.nurse_id);
      const nursePrefs = preferences.filter((p) => p.nurse_id === nurse.nurse_id);
      const nurseLeaves = leaveRequests.filter((l) => l.nurse_id === nurse.nurse_id);

      let workDays = 0;
      let offDays = 0;
      let nightShifts = 0;
      let weekendShifts = 0;
      let totalHours = 0;
      let consecutiveWork = 0;
      let maxConsecutive = 0;

      // Check last month continuation for consecutive work
      const prevCellsForNurse = previousMonthEndCells.filter((c) => c.nurse_id === nurse.nurse_id);
      if (prevCellsForNurse.length > 0) {
        prevCellsForNurse.sort((a, b) => b.work_date.localeCompare(a.work_date));
        for (const pCell of prevCellsForNurse) {
          if (pCell.shift_id) {
            consecutiveWork++;
          } else {
            break;
          }
        }
      }

      // Track shift history for rest hours, flowers shifts, single-day off
      const shiftSequence: { date: string; shift: Shift | null; cell: ScheduleCell }[] = [];

      for (let day = 1; day <= daysInMonth; day++) {
        const dateStr = this.formatDate(year, month, day);
        const cell = nCells.find((c) => c.work_date === dateStr);
        const shift = cell?.shift_id ? shiftMap.get(cell.shift_id) || null : null;
        shiftSequence.push({ date: dateStr, shift, cell: cell! });

        const dayType = this.getDayType(dateStr, holidays);
        const isWeekendOrHoliday = dayType === 'R' || dayType === 'H';

        if (shift) {
          workDays++;
          totalHours += shift.work_hours;
          consecutiveWork++;
          if (consecutiveWork > maxConsecutive) {
            maxConsecutive = consecutiveWork;
          }

          if (shift.is_night) {
            nightShifts++;
          }

          if (isWeekendOrHoliday) {
            weekendShifts++;
          }

          // BR-H8: 排到不可值夜人員
          if (shift.is_night && !nurse.can_night) {
            totalPenalty += params.w_staffing;
            violations.push({
              rule_code: 'BR-H8',
              severity: 'H',
              nurse_id: nurse.nurse_id,
              nurse_name: nurse.name,
              work_date: dateStr,
              shift_id: shift.shift_id,
              shift_code: shift.code,
              message: `${nurse.name} 於 ${dateStr} 排定夜班(${shift.code})，違反「不可排夜班」限制`,
              penalty: params.w_staffing,
            });
          }

          // BR-L7: 妊娠、哺乳保護 (22:00-06:00 夜間工作禁止, 勞基法 §49, §30-1)
          const isProtected = nurseProtects.some(
            (p) => (p.protection_type === 'P' || p.protection_type === 'B') &&
                   dateStr >= p.start_date && dateStr <= p.end_date
          );
          if (isProtected && this.isNightWindowShift(shift)) {
            totalPenalty += 2000;
            violations.push({
              rule_code: 'BR-L7',
              severity: 'H',
              nurse_id: nurse.nurse_id,
              nurse_name: nurse.name,
              work_date: dateStr,
              shift_id: shift.shift_id,
              shift_code: shift.code,
              message: `${nurse.name} 於 ${dateStr} 妊娠/哺乳保護期間排入夜間班次(${shift.name} ${shift.start_time}-${shift.end_time})`,
              penalty: 2000,
              law_ref: '勞動基準法 §49、§30-1',
            });
          }

          // BR-L8: 女性夜間工作保護 (若無工會/勞資會議同意，女性不得排 22:00-06:00)
          if (nurse.sex === 'F' && !unit.women_night_approved && this.isNightWindowShift(shift)) {
            totalPenalty += 2000;
            violations.push({
              rule_code: 'BR-L8',
              severity: 'H',
              nurse_id: nurse.nurse_id,
              nurse_name: nurse.name,
              work_date: dateStr,
              shift_id: shift.shift_id,
              shift_code: shift.code,
              message: `${nurse.name} 於 ${dateStr} 排入夜間班次，單位尚未取得工會或勞資會議同意女性夜間工作`,
              penalty: 2000,
              law_ref: '勞動基準法 §49',
            });
          }

          // BR-L1: 每日正常工時上限 (勞基法 §30)
          if (shift.work_hours > 10.0) {
            totalPenalty += 2000;
            violations.push({
              rule_code: 'BR-L1',
              severity: 'H',
              nurse_id: nurse.nurse_id,
              nurse_name: nurse.name,
              work_date: dateStr,
              shift_id: shift.shift_id,
              shift_code: shift.code,
              message: `${nurse.name} 於 ${dateStr} 單日排定工時 ${shift.work_hours} 小時超過法定上限 10 小時`,
              penalty: 2000,
              law_ref: '勞動基準法 §30-1',
            });
          }
        } else {
          // Off day
          offDays++;
          consecutiveWork = 0;
        }

        // BR-H7: 已核准休假被佔用
        const leave = nurseLeaves.find((l) => l.leave_date === dateStr);
        if (leave) {
          if ((leave.leave_type === 'L' || leave.leave_type === 'P') && shift) {
            totalPenalty += params.w_approved_leave;
            violations.push({
              rule_code: 'BR-H7',
              severity: 'H',
              nurse_id: nurse.nurse_id,
              nurse_name: nurse.name,
              work_date: dateStr,
              shift_id: shift?.shift_id,
              message: `${nurse.name} 於 ${dateStr} 已核准休假/預休，但被排班(${shift.code})`,
              penalty: params.w_approved_leave,
            });
          } else if (leave.leave_type === 'S' && (!shift || shift.shift_id !== leave.shift_id)) {
            const expectedShift = shiftMap.get(leave.shift_id || 0);
            totalPenalty += params.w_approved_leave;
            violations.push({
              rule_code: 'BR-H7',
              severity: 'H',
              nurse_id: nurse.nurse_id,
              nurse_name: nurse.name,
              work_date: dateStr,
              message: `${nurse.name} 於 ${dateStr} 已核准指定班別(${expectedShift?.name || '指定班'})，但實際排為 ${shift ? shift.name : '休假'}`,
              penalty: params.w_approved_leave,
            });
          }
        }

        // BR-S5: 個人排班偏好檢查
        for (const pref of nursePrefs) {
          const dateObj = new Date(dateStr);
          const weekday = dateObj.getDay();
          const matchWeekday = pref.weekday === null || pref.weekday === undefined || pref.weekday === weekday;

          if (matchWeekday) {
            let prefViolated = false;
            let reasonMsg = '';

            if (pref.pref_type === 'F' && pref.shift_id && shift?.shift_id !== pref.shift_id) {
              const wanted = shiftMap.get(pref.shift_id)?.name;
              prefViolated = true;
              reasonMsg = `期望固定班別(${wanted})未滿足`;
            } else if (pref.pref_type === 'X' && pref.shift_id && shift?.shift_id === pref.shift_id) {
              const avoided = shiftMap.get(pref.shift_id)?.name;
              prefViolated = true;
              reasonMsg = `排入不排班別(${avoided})`;
            } else if (pref.pref_type === 'O' && shift) {
              prefViolated = true;
              reasonMsg = `固定星期休未滿足(被排班)`;
            }

            if (prefViolated) {
              const isHard = unit.pref_as_hard;
              const penalty = isHard ? params.w_staffing : params.w_preference * (pref.strength / 10);
              totalPenalty += penalty;
              violations.push({
                rule_code: 'BR-S5',
                severity: isHard ? 'H' : 'S',
                nurse_id: nurse.nurse_id,
                nurse_name: nurse.name,
                work_date: dateStr,
                message: `${nurse.name} 於 ${dateStr} 個人排班偏好未滿足：${reasonMsg}`,
                penalty,
              });
            }
          }
        }
      }

      // Check shift intervals: BR-H3 / BR-L5 (連續休息不足 11 小時)
      for (let i = 0; i < shiftSequence.length - 1; i++) {
        const curr = shiftSequence[i];
        const next = shiftSequence[i + 1];

        if (curr.shift && next.shift) {
          const restHours = this.calculateRestHours(curr.shift, next.shift);
          if (restHours < params.min_rest_hours) {
            // Hard violation (勞基法 §34 第2項)
            totalPenalty += params.w_rest_hours;
            violations.push({
              rule_code: 'BR-H3',
              severity: 'H',
              nurse_id: nurse.nurse_id,
              nurse_name: nurse.name,
              work_date: next.date,
              shift_id: next.shift.shift_id,
              shift_code: next.shift.code,
              message: `${nurse.name} 於 ${curr.date}(${curr.shift.code}) 接 ${next.date}(${next.shift.code})，休息間隔僅 ${restHours} 小時 (< ${params.min_rest_hours} 小時)`,
              penalty: params.w_rest_hours,
              law_ref: '勞動基準法 §34 第2項',
            });
          } else if (restHours < 12.0) {
            // BR-G2: 指引建議休息達 12 小時 (軟規則)
            violations.push({
              rule_code: 'BR-G2',
              severity: 'S',
              nurse_id: nurse.nurse_id,
              nurse_name: nurse.name,
              work_date: next.date,
              shift_id: next.shift.shift_id,
              shift_code: next.shift.code,
              message: `${nurse.name} 於 ${curr.date}(${curr.shift.code}) 接 ${next.date}(${next.shift.code})，休息時間 ${restHours} 小時未達衛福部指引建議的 12 小時`,
              penalty: 15,
            });
          }
        }
      }

      // BR-H4: 連續上班超過上限
      if (maxConsecutive > params.max_consecutive_days) {
        const penalty = params.w_consecutive * (maxConsecutive - params.max_consecutive_days);
        totalPenalty += penalty;
        violations.push({
          rule_code: 'BR-H4',
          severity: 'H',
          nurse_id: nurse.nurse_id,
          nurse_name: nurse.name,
          message: `${nurse.name} 最長連續上班達 ${maxConsecutive} 天，超過上限 ${params.max_consecutive_days} 天`,
          penalty,
          law_ref: '勞動基準法 §36',
        });
      }

      // BR-H5: 月休天數不足
      const reqOffDays = Math.max(nurse.monthly_off_days, params.min_monthly_off_days);
      if (offDays < reqOffDays) {
        const shortage = reqOffDays - offDays;
        const penalty = params.w_consecutive * shortage;
        totalPenalty += penalty;
        violations.push({
          rule_code: 'BR-H5',
          severity: 'H',
          nurse_id: nurse.nurse_id,
          nurse_name: nurse.name,
          message: `${nurse.name} 當月休假 ${offDays} 天，未達應休 ${reqOffDays} 天 (缺 ${shortage} 天)`,
          penalty,
        });
      }

      // BR-H6: 月工時超過上限
      if (totalHours > nurse.max_month_hours) {
        const overtime = totalHours - nurse.max_month_hours;
        const penalty = params.w_work_hours * (overtime / 8);
        totalPenalty += penalty;
        violations.push({
          rule_code: 'BR-H6',
          severity: 'H',
          nurse_id: nurse.nurse_id,
          nurse_name: nurse.name,
          message: `${nurse.name} 當月總工時 ${totalHours} 小時，超過個人上限 ${nurse.max_month_hours} 小時`,
          penalty,
        });
      }

      // BR-L3: 四週彈性例假與休息日 (每 2 週 ≥ 2 例假, 4 週例假 + 休息日 ≥ 8)
      if (offDays < 8) {
        violations.push({
          rule_code: 'BR-L3',
          severity: 'H',
          nurse_id: nurse.nurse_id,
          nurse_name: nurse.name,
          message: `${nurse.name} 四週內休假僅 ${offDays} 日，未達法定四週例假及休息日合計 8 日下限`,
          penalty: 2000,
          law_ref: '勞動基準法 §36 第2項',
        });
      }

      // BR-S2: 每月夜班數超過上限
      if (nightShifts > params.max_night_shifts_suggested) {
        const penalty = 50 * (nightShifts - params.max_night_shifts_suggested);
        totalPenalty += penalty;
        violations.push({
          rule_code: 'BR-S2',
          severity: 'S',
          nurse_id: nurse.nurse_id,
          nurse_name: nurse.name,
          message: `${nurse.name} 當月夜班 ${nightShifts} 班，超過建議上限 ${params.max_night_shifts_suggested} 班`,
          penalty,
        });
      }

      // BR-S6: 單日零星休假 (前後都上班的孤立休假 >= 3 次)
      let isolatedOffCount = 0;
      for (let i = 1; i < shiftSequence.length - 1; i++) {
        if (!shiftSequence[i].shift && shiftSequence[i - 1].shift && shiftSequence[i + 1].shift) {
          isolatedOffCount++;
        }
      }
      if (isolatedOffCount >= 3) {
        const penalty = params.w_isolated_off * isolatedOffCount;
        totalPenalty += penalty;
        violations.push({
          rule_code: 'BR-S6',
          severity: 'S',
          nurse_id: nurse.nurse_id,
          nurse_name: nurse.name,
          message: `${nurse.name} 單日零星休假達 ${isolatedOffCount} 次，易造成身心疲憊，建議連續安排休假`,
          penalty,
        });
      }

      // BR-G3 / BR-S7: 花花班檢查 (一週內三班並存或頻繁換班)
      let currentShiftId: number | null = null;
      let sameShiftStreak = 0;
      let shiftChanges = 0;
      for (const item of shiftSequence) {
        if (item.shift) {
          if (currentShiftId === null) {
            currentShiftId = item.shift.shift_id;
            sameShiftStreak = 1;
          } else if (item.shift.shift_id === currentShiftId) {
            sameShiftStreak++;
          } else {
            // Shift changed
            shiftChanges++;
            if (sameShiftStreak < (unit.min_same_shift_days || 2)) {
              // Streak too short
            }
            currentShiftId = item.shift.shift_id;
            sameShiftStreak = 1;
          }
        }
      }

      const weeklyShiftChanges = (shiftChanges / daysInMonth) * 7;
      if (weeklyShiftChanges > (unit.max_shift_changes_week || 1.5) && !nurse.shift_change_consent) {
        violations.push({
          rule_code: 'BR-S7',
          severity: 'S',
          nurse_id: nurse.nurse_id,
          nurse_name: nurse.name,
          message: `${nurse.name} 班次更換頻率較高 (未登錄本人同意每週輪替超過一次)`,
          penalty: 40,
          law_ref: '勞動基準法 §34 第1項',
        });
      }

      // Record nurse stats
      personStats.set(nurse.nurse_id, {
        nurseId: nurse.nurse_id,
        workDays,
        offDays,
        nightShifts,
        weekendShifts,
        totalHours,
        maxConsecutive,
      });

      if (nurse.can_night) {
        nightShiftCounts.push(nightShifts);
      }
      weekendShiftCounts.push(weekendShifts);
    }

    // 3. Fairness Rules Evaluation (BR-S3, BR-S4)
    if (nightShiftCounts.length > 0) {
      const avgNight = nightShiftCounts.reduce((a, b) => a + b, 0) / nightShiftCounts.length;
      for (const nurse of activeNurses) {
        if (!nurse.can_night) continue;
        const stats = personStats.get(nurse.nurse_id);
        if (stats && Math.abs(stats.nightShifts - avgNight) >= 2.5) {
          const penalty = params.w_night_fairness * Math.abs(stats.nightShifts - avgNight);
          totalPenalty += penalty;
          violations.push({
            rule_code: 'BR-S3',
            severity: 'S',
            nurse_id: nurse.nurse_id,
            nurse_name: nurse.name,
            message: `${nurse.name} 夜班數 (${stats.nightShifts}) 與平均值 (${avgNight.toFixed(1)}) 差距 ≥ 2.5 班，夜班分配不均`,
            penalty,
          });
        }
      }
    }

    if (weekendShiftCounts.length > 0) {
      const avgWeekend = weekendShiftCounts.reduce((a, b) => a + b, 0) / weekendShiftCounts.length;
      for (const nurse of activeNurses) {
        const stats = personStats.get(nurse.nurse_id);
        if (stats && Math.abs(stats.weekendShifts - avgWeekend) >= 2.5) {
          const penalty = params.w_holiday_fairness * Math.abs(stats.weekendShifts - avgWeekend);
          totalPenalty += penalty;
          violations.push({
            rule_code: 'BR-S4',
            severity: 'S',
            nurse_id: nurse.nurse_id,
            nurse_name: nurse.name,
            message: `${nurse.name} 假日班數 (${stats.weekendShifts}) 與平均值 (${avgWeekend.toFixed(1)}) 差距 ≥ 2.5 班，假日分配不均`,
            penalty,
          });
        }
      }
    }

    // Calculate indicators
    const hardCount = violations.filter((v) => v.severity === 'H').length;
    const softCount = violations.filter((v) => v.severity === 'S').length;

    let qualityScore = 100;
    if (hardCount > 0 || softCount > 0) {
      qualityScore = Math.max(0, Math.round(100 - (hardCount * 20 + softCount * 2 + totalPenalty / 300)));
    }

    return {
      violations,
      hardCount,
      softCount,
      totalPenalty: Math.round(totalPenalty * 10) / 10,
      qualityScore,
      personStats,
      dailyStaffing,
    };
  }

  /**
   * Calculates the rest hours between shift on day d and shift on day d+1.
   * e.g., shift1: 16:00 - 00:00 (ends 24:00 on day d)
   * shift2: 08:00 - 16:00 (starts 08:00 on day d+1)
   * rest = (24 + 8) - 24 = 8 hours.
   */
  calculateRestHours(shift1: Shift, shift2: Shift): number {
    const endH1 = this.timeToHours(shift1.end_time);
    let startH1 = this.timeToHours(shift1.start_time);
    let actualEndH1 = endH1;
    if (endH1 <= startH1) {
      // Over midnight
      actualEndH1 = endH1 + 24;
    }

    const startH2 = this.timeToHours(shift2.start_time);
    // Next day start time from shift1 day 00:00 is 24 + startH2
    const nextDayStart = 24 + startH2;
    const rest = nextDayStart - actualEndH1;
    return Math.max(0, rest);
  }

  /**
   * Checks if a shift overlaps with 22:00 - 06:00 (Night work under labor law §49)
   */
  isNightWindowShift(shift: Shift): boolean {
    const start = this.timeToHours(shift.start_time);
    let end = this.timeToHours(shift.end_time);
    if (end <= start) end += 24;

    // Window 1: 22:00 (22) to 24:00 (24)
    // Window 2: 00:00 (24) to 06:00 (30) or 00:00 (0) to 06:00 (6)
    // Overlap if max(start, 22) < min(end, 30) or start < 6
    if (start < 6) return true;
    if (end > 22) return true;
    return false;
  }

  private timeToHours(timeStr: string): number {
    const parts = timeStr.split(':').map(Number);
    return parts[0] + (parts[1] || 0) / 60;
  }

  private getDemandRequirement(
    shiftId: number,
    dateStr: string,
    dayType: DayType,
    staffingDemands: StaffingDemand[],
    dailyDemands: DailyDemand[]
  ): { required: number; seniorRequired: number } {
    // Check daily demand first
    const daily = dailyDemands.find((d) => d.shift_id === shiftId && d.demand_date === dateStr);
    if (daily !== undefined && daily.required !== undefined) {
      return { required: daily.required, seniorRequired: daily.senior_required || 0 };
    }

    // Fall back to day_type demand
    const std = staffingDemands.find((s) => s.shift_id === shiftId && s.day_type === dayType);
    if (std) {
      return { required: std.required, seniorRequired: std.senior_required };
    }

    return { required: 0, seniorRequired: 0 };
  }

  getDayType(dateStr: string, holidays: Holiday[]): DayType {
    const holiday = holidays.find((h) => h.holiday_date === dateStr);
    if (holiday) {
      return holiday.is_makeup_workday ? 'W' : 'H';
    }
    const d = new Date(dateStr);
    const day = d.getDay();
    if (day === 0 || day === 6) {
      return 'R'; // Weekend
    }
    return 'W';
  }

  private formatDate(year: number, month: number, day: number): string {
    const m = String(month).padStart(2, '0');
    const d = String(day).padStart(2, '0');
    return `${year}-${m}-${d}`;
  }

  private getParamMap(): ParamConfig {
    const params = this.dataService.systemParams();
    const map: ParamConfig = {
      min_rest_hours: 11,
      max_consecutive_days: 6,
      min_monthly_off_days: 8,
      default_max_month_hours: 184,
      max_night_shifts_suggested: 10,
      w_approved_leave: 1000,
      w_staffing: 800,
      w_rest_hours: 700,
      w_senior: 600,
      w_consecutive: 500,
      w_work_hours: 400,
      w_overstaffing: 100,
      w_night_fairness: 60,
      w_holiday_fairness: 40,
      w_preference: 30,
      w_isolated_off: 15,
    };
    for (const p of params) {
      const num = parseFloat(p.param_value);
      if (!isNaN(num) && p.param_key in map) {
        (map as any)[p.param_key] = num;
      }
    }
    return map;
  }
}
