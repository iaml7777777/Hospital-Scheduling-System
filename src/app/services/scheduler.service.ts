import { Injectable, inject } from '@angular/core';
import { DataService } from './data.service';
import { RuleCheckerService, CheckResult } from './rule-checker.service';
import {
  Unit,
  Shift,
  Nurse,
  Schedule,
  ScheduleCell,
  OffType,
  DayType,
} from '../models/schedule.models';

// Deterministic PRNG for reproducible scheduling (NFR-03)
class SeededRandom {
  private seed: number;

  constructor(seed: number) {
    this.seed = seed % 2147483647;
    if (this.seed <= 0) this.seed += 2147483646;
  }

  // Returns next float in [0, 1)
  next(): number {
    this.seed = (this.seed * 16807) % 2147483647;
    return (this.seed - 1) / 2147483646;
  }

  // Returns integer in [min, max]
  nextInt(min: number, max: number): number {
    return Math.floor(this.next() * (max - min + 1)) + min;
  }

  // Shuffle array in-place
  shuffle<T>(array: T[]): T[] {
    for (let i = array.length - 1; i > 0; i--) {
      const j = this.nextInt(0, i);
      [array[i], array[j]] = [array[j], array[i]];
    }
    return array;
  }
}

@Injectable({
  providedIn: 'root',
})
export class SchedulerService {
  private dataService = inject(DataService);
  private ruleChecker = inject(RuleCheckerService);

  /**
   * Generates a monthly schedule for a unit using optimization algorithm
   */
  generateSchedule(
    unit: Unit,
    year: number,
    month: number,
    keepPinned = false,
    customSeed?: number
  ): { schedule: Schedule; cells: ScheduleCell[]; result: CheckResult } {
    const daysInMonth = new Date(year, month, 0).getDate();
    const holidays = this.dataService.holidays();
    const activeNurses = this.dataService
      .nurses()
      .filter((n) => n.unit_id === unit.unit_id && n.is_active);
    const activeShifts = this.dataService
      .shifts()
      .filter((s) => s.unit_id === unit.unit_id && s.is_active)
      .sort((a, b) => a.sort_order - b.sort_order);

    const approvedLeaves = this.dataService
      .leaveRequests()
      .filter((r) => r.status === 'A');
    const protections = this.dataService.nurseProtections();
    const existingCells = this.dataService
      .scheduleCells()
      .filter((c) => {
        const s = this.dataService.schedules().find((sc) => sc.schedule_id === c.schedule_id);
        return s?.unit_id === unit.unit_id && s?.year === year && s?.month === month;
      });

    // Determine seed
    const paramSeed = parseInt(
      this.dataService.systemParams().find((p) => p.param_key === 'random_seed')?.param_value || '42',
      10
    );
    const seed = customSeed ?? (paramSeed + year * 100 + month);
    const rng = new SeededRandom(seed);

    // Prepare cell grid: nurse_id -> day (1..daysInMonth) -> ScheduleCell
    const cellMap = new Map<string, ScheduleCell>();

    // 1. Initialize cells & preserve pinned cells if requested
    for (const nurse of activeNurses) {
      for (let day = 1; day <= daysInMonth; day++) {
        const dateStr = this.formatDate(year, month, day);
        const key = `${nurse.nurse_id}_${dateStr}`;
        const existing = existingCells.find(
          (c) => c.nurse_id === nurse.nurse_id && c.work_date === dateStr
        );

        if (keepPinned && existing && existing.is_pinned) {
          cellMap.set(key, { ...existing });
        } else {
          cellMap.set(key, {
            schedule_id: 0,
            nurse_id: nurse.nurse_id,
            work_date: dateStr,
            shift_id: null,
            off_type: 'R', // default to off
            is_pinned: false,
          });
        }
      }
    }

    // 2. Lock approved leaves (BR-H7, BR-G7)
    for (const leave of approvedLeaves) {
      const key = `${leave.nurse_id}_${leave.leave_date}`;
      const cell = cellMap.get(key);
      if (cell && !cell.is_pinned) {
        if (leave.leave_type === 'L' || leave.leave_type === 'P') {
          cell.shift_id = null;
          cell.off_type = 'A'; // Approved leave / special leave
        } else if (leave.leave_type === 'S' && leave.shift_id) {
          cell.shift_id = leave.shift_id;
          cell.off_type = null;
        }
      }
    }

    // 3. Staggered Mandatory Days Off (BR-G7, BR-L3: 一例二休三國假)
    // Guarantee 8+ off days distributed across the month so no nurse exceeds 6 consecutive days.
    const nurseOffDaysTarget = new Map<number, number>();
    for (const nurse of activeNurses) {
      nurseOffDaysTarget.set(nurse.nurse_id, Math.max(nurse.monthly_off_days, 8));
    }

    // Sort shifts: Day (D), Evening (E), Night (N)
    const dayShift = activeShifts.find((s) => !s.is_night) || activeShifts[0];
    const eveningShift = activeShifts.find((s) => s.is_night && s.start_time.startsWith('16')) || activeShifts[1];
    const nightShift = activeShifts.find((s) => s.is_night && s.start_time.startsWith('00')) || activeShifts[2];

    // 4. Initial Shift Allocation (Greedy matching with constraints)
    // For each day, determine required staff for each shift
    const staffingDemands = this.dataService.staffingDemands();
    const dailyDemands = this.dataService.dailyDemands();

    for (let day = 1; day <= daysInMonth; day++) {
      const dateStr = this.formatDate(year, month, day);
      const dayType = this.ruleChecker.getDayType(dateStr, holidays);

      // Randomize nurse order on this day for fairness
      const nursesOnDay = rng.shuffle([...activeNurses]);

      for (const shift of activeShifts) {
        const req = this.getDemandRequirement(shift.shift_id, dateStr, dayType, staffingDemands, dailyDemands);
        let assignedCount = 0;
        let seniorAssigned = 0;

        // Check if any nurses already pinned or assigned via approved leave to this shift on this day
        for (const nurse of nursesOnDay) {
          const cell = cellMap.get(`${nurse.nurse_id}_${dateStr}`)!;
          if (cell.shift_id === shift.shift_id) {
            assignedCount++;
            if (nurse.can_lead) seniorAssigned++;
          }
        }

        // Pass 1: Assign senior nurses if senior quota needed
        if (seniorAssigned < req.seniorRequired) {
          for (const nurse of nursesOnDay) {
            if (assignedCount >= req.required && seniorAssigned >= req.seniorRequired) break;
            if (!nurse.can_lead) continue;

            const key = `${nurse.nurse_id}_${dateStr}`;
            const cell = cellMap.get(key)!;
            if (cell.is_pinned || cell.shift_id !== null) continue;

            // Check night restrictions (BR-H8, BR-L7)
            if (shift.is_night && !this.canNurseWorkNight(nurse, dateStr, protections)) continue;

            // Check previous day rest interval (BR-H3)
            if (day > 1) {
              const prevDate = this.formatDate(year, month, day - 1);
              const prevCell = cellMap.get(`${nurse.nurse_id}_${prevDate}`)!;
              if (prevCell.shift_id) {
                const prevShift = activeShifts.find((s) => s.shift_id === prevCell.shift_id);
                if (prevShift && this.ruleChecker.calculateRestHours(prevShift, shift) < 11) {
                  continue; // Avoid rest < 11h
                }
              }
            }

            // Assign
            cell.shift_id = shift.shift_id;
            cell.off_type = null;
            assignedCount++;
            seniorAssigned++;
          }
        }

        // Pass 2: Fill remaining required staff
        for (const nurse of nursesOnDay) {
          if (assignedCount >= req.required) break;

          const key = `${nurse.nurse_id}_${dateStr}`;
          const cell = cellMap.get(key)!;
          if (cell.is_pinned || cell.shift_id !== null) continue;

          // Check night restrictions
          if (shift.is_night && !this.canNurseWorkNight(nurse, dateStr, protections)) continue;

          // Check previous day rest interval
          if (day > 1) {
            const prevDate = this.formatDate(year, month, day - 1);
            const prevCell = cellMap.get(`${nurse.nurse_id}_${prevDate}`)!;
            if (prevCell.shift_id) {
              const prevShift = activeShifts.find((s) => s.shift_id === prevCell.shift_id);
              if (prevShift && this.ruleChecker.calculateRestHours(prevShift, shift) < 11) {
                continue;
              }
            }
          }

          // Check consecutive work limit (avoid > 6 consecutive days)
          let currentConsecutive = 0;
          for (let lookback = day - 1; lookback >= Math.max(1, day - 6); lookback--) {
            const pDate = this.formatDate(year, month, lookback);
            const pCell = cellMap.get(`${nurse.nurse_id}_${pDate}`)!;
            if (pCell.shift_id !== null) {
              currentConsecutive++;
            } else {
              break;
            }
          }
          if (currentConsecutive >= 6) continue;

          // Assign
          cell.shift_id = shift.shift_id;
          cell.off_type = null;
          assignedCount++;
          if (nurse.can_lead) seniorAssigned++;
        }
      }
    }

    // Mark remaining empty cells as off types (R: regular off, S: rest day, H: holiday)
    for (let day = 1; day <= daysInMonth; day++) {
      const dateStr = this.formatDate(year, month, day);
      const dayType = this.ruleChecker.getDayType(dateStr, holidays);
      for (const nurse of activeNurses) {
        const cell = cellMap.get(`${nurse.nurse_id}_${dateStr}`)!;
        if (cell.shift_id === null && cell.off_type !== 'A') {
          if (dayType === 'H') {
            cell.off_type = 'H';
          } else if (dayType === 'R') {
            cell.off_type = 'R';
          } else {
            cell.off_type = 'S';
          }
        }
      }
    }

    // Convert cellMap to array
    let currentCells = Array.from(cellMap.values());

    // 5. Optimization Stage: Local Search / Simulated Annealing
    // Performs iterations of neighborhood moves (swap shifts, swap persons, swap days)
    const maxIterations = 1500;
    let bestResult = this.ruleChecker.evaluateSchedule(
      unit,
      year,
      month,
      currentCells,
      activeNurses,
      activeShifts,
      daysInMonth
    );
    let bestScore = bestResult.totalPenalty;

    for (let iter = 0; iter < maxIterations; iter++) {
      if (bestResult.hardCount === 0 && bestResult.softCount === 0) {
        break; // Perfect score reached
      }

      // Pick a random unpinned cell
      const randomNurse = activeNurses[rng.nextInt(0, activeNurses.length - 1)];
      const randomDay1 = rng.nextInt(1, daysInMonth);
      const dateStr1 = this.formatDate(year, month, randomDay1);
      const cell1 = currentCells.find(
        (c) => c.nurse_id === randomNurse.nurse_id && c.work_date === dateStr1
      );

      if (!cell1 || cell1.is_pinned || cell1.off_type === 'A') continue;

      // Candidate move: Swap with another nurse on the same day, or with another day of the same nurse
      const moveType = rng.nextInt(1, 3);

      if (moveType === 1) {
        // Swap with another nurse on the same day
        const otherNurse = activeNurses[rng.nextInt(0, activeNurses.length - 1)];
        if (otherNurse.nurse_id === randomNurse.nurse_id) continue;
        const cell2 = currentCells.find(
          (c) => c.nurse_id === otherNurse.nurse_id && c.work_date === dateStr1
        );
        if (!cell2 || cell2.is_pinned || cell2.off_type === 'A') continue;

        // Perform swap
        const tempShift = cell1.shift_id;
        const tempOff = cell1.off_type;
        cell1.shift_id = cell2.shift_id;
        cell1.off_type = cell2.off_type;
        cell2.shift_id = tempShift;
        cell2.off_type = tempOff;

        // Evaluate
        const newResult = this.ruleChecker.evaluateSchedule(
          unit,
          year,
          month,
          currentCells,
          activeNurses,
          activeShifts,
          daysInMonth
        );

        if (newResult.totalPenalty <= bestScore) {
          bestScore = newResult.totalPenalty;
          bestResult = newResult;
        } else {
          // Revert swap
          cell2.shift_id = cell1.shift_id;
          cell2.off_type = cell1.off_type;
          cell1.shift_id = tempShift;
          cell1.off_type = tempOff;
        }
      } else if (moveType === 2) {
        // Swap two days of the same nurse
        const randomDay2 = rng.nextInt(1, daysInMonth);
        if (randomDay1 === randomDay2) continue;
        const dateStr2 = this.formatDate(year, month, randomDay2);
        const cell2 = currentCells.find(
          (c) => c.nurse_id === randomNurse.nurse_id && c.work_date === dateStr2
        );
        if (!cell2 || cell2.is_pinned || cell2.off_type === 'A') continue;

        const tempShift = cell1.shift_id;
        const tempOff = cell1.off_type;
        cell1.shift_id = cell2.shift_id;
        cell1.off_type = cell2.off_type;
        cell2.shift_id = tempShift;
        cell2.off_type = tempOff;

        const newResult = this.ruleChecker.evaluateSchedule(
          unit,
          year,
          month,
          currentCells,
          activeNurses,
          activeShifts,
          daysInMonth
        );

        if (newResult.totalPenalty <= bestScore) {
          bestScore = newResult.totalPenalty;
          bestResult = newResult;
        } else {
          cell2.shift_id = cell1.shift_id;
          cell2.off_type = cell1.off_type;
          cell1.shift_id = tempShift;
          cell1.off_type = tempOff;
        }
      }
    }

    // Final evaluation
    const finalResult = this.ruleChecker.evaluateSchedule(
      unit,
      year,
      month,
      currentCells,
      activeNurses,
      activeShifts,
      daysInMonth
    );

    // Build Schedule Object
    const existingSchedule = this.dataService
      .schedules()
      .find((s) => s.unit_id === unit.unit_id && s.year === year && s.month === month);

    const scheduleId = existingSchedule ? existingSchedule.schedule_id : Date.now();

    // Assign schedule_id to cells
    currentCells = currentCells.map((c) => ({ ...c, schedule_id: scheduleId }));

    const schedule: Schedule = {
      schedule_id: scheduleId,
      unit_id: unit.unit_id,
      year,
      month,
      status: existingSchedule ? existingSchedule.status : 'D', // Draft
      seed_used: seed,
      hard_count: finalResult.hardCount,
      soft_count: finalResult.softCount,
      total_penalty: finalResult.totalPenalty,
      quality_score: finalResult.qualityScore,
    };

    return { schedule, cells: currentCells, result: finalResult };
  }

  private canNurseWorkNight(nurse: Nurse, dateStr: string, protections: any[]): boolean {
    if (!nurse.can_night) return false;
    const isProtected = protections.some(
      (p) => p.nurse_id === nurse.nurse_id &&
             (p.protection_type === 'P' || p.protection_type === 'B') &&
             dateStr >= p.start_date && dateStr <= p.end_date
    );
    if (isProtected) return false;
    return true;
  }

  private getDemandRequirement(
    shiftId: number,
    dateStr: string,
    dayType: DayType,
    staffingDemands: any[],
    dailyDemands: any[]
  ): { required: number; seniorRequired: number } {
    const daily = dailyDemands.find((d) => d.shift_id === shiftId && d.demand_date === dateStr);
    if (daily !== undefined && daily.required !== undefined) {
      return { required: daily.required, seniorRequired: daily.seniorRequired || 0 };
    }
    const std = staffingDemands.find((s) => s.shift_id === shiftId && s.day_type === dayType);
    if (std) {
      return { required: std.required, seniorRequired: std.seniorRequired };
    }
    return { required: 0, seniorRequired: 0 };
  }

  private formatDate(year: number, month: number, day: number): string {
    const m = String(month).padStart(2, '0');
    const d = String(day).padStart(2, '0');
    return `${year}-${m}-${d}`;
  }
}
