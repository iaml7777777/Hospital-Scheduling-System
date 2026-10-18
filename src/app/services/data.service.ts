import { Injectable, signal } from '@angular/core';
import {
  UserAccount,
  Unit,
  Shift,
  StaffingDemand,
  DailyDemand,
  Nurse,
  NurseProtection,
  Preference,
  FixedWeeklySchedule,
  LeaveRequest,
  Schedule,
  ScheduleCell,
  Violation,
  SwapRequest,
  Holiday,
  HolidayShift,
  SystemParam,
  LegalLimit,
} from '../models/schedule.models';

const STORAGE_PREFIX = 'hospital_sched_';

@Injectable({
  providedIn: 'root',
})
export class DataService {
  // Reactive Signals for State
  readonly units = signal<Unit[]>([]);
  readonly shifts = signal<Shift[]>([]);
  readonly staffingDemands = signal<StaffingDemand[]>([]);
  readonly dailyDemands = signal<DailyDemand[]>([]);
  readonly nurses = signal<Nurse[]>([]);
  readonly nurseProtections = signal<NurseProtection[]>([]);
  readonly preferences = signal<Preference[]>([]);
  readonly fixedWeeklySchedules = signal<FixedWeeklySchedule[]>([]);
  readonly leaveRequests = signal<LeaveRequest[]>([]);
  readonly schedules = signal<Schedule[]>([]);
  readonly scheduleCells = signal<ScheduleCell[]>([]);
  readonly violations = signal<Violation[]>([]);
  readonly swapRequests = signal<SwapRequest[]>([]);
  readonly holidays = signal<Holiday[]>([]);
  readonly holidayShifts = signal<HolidayShift[]>([]);
  readonly systemParams = signal<SystemParam[]>([]);
  readonly legalLimits = signal<LegalLimit[]>([]);
  readonly userAccounts = signal<UserAccount[]>([]);

  constructor() {
    this.loadAll();
  }

  loadAll(): void {
    if (this.isBrowser()) {
      const hasInit = localStorage.getItem(STORAGE_PREFIX + 'initialized');
      if (!hasInit) {
        this.resetToDefaults();
        return;
      }
    }

    this.units.set(this.getItem('units', this.defaultUnits()));
    this.shifts.set(this.getItem('shifts', this.defaultShifts()));
    this.staffingDemands.set(this.getItem('staffingDemands', this.defaultDemands()));
    this.dailyDemands.set(this.getItem('dailyDemands', []));
    this.nurses.set(this.getItem('nurses', this.defaultNurses()));
    this.nurseProtections.set(this.getItem('nurseProtections', this.defaultProtections()));
    this.preferences.set(this.getItem('preferences', this.defaultPreferences()));
    this.fixedWeeklySchedules.set(this.getItem('fixedWeeklySchedules', []));
    this.leaveRequests.set(this.getItem('leaveRequests', this.defaultLeaveRequests()));
    this.schedules.set(this.getItem('schedules', []));
    this.scheduleCells.set(this.getItem('scheduleCells', []));
    this.violations.set(this.getItem('violations', []));
    this.swapRequests.set(this.getItem('swapRequests', this.defaultSwapRequests()));
    this.holidays.set(this.getItem('holidays', this.defaultHolidays()));
    this.holidayShifts.set(this.getItem('holidayShifts', []));
    this.systemParams.set(this.getItem('systemParams', this.defaultSystemParams()));
    this.legalLimits.set(this.getItem('legalLimits', this.defaultLegalLimits()));
    this.userAccounts.set(this.getItem('userAccounts', this.defaultUsers()));
  }

  resetToDefaults(): void {
    this.units.set(this.defaultUnits());
    this.shifts.set(this.defaultShifts());
    this.staffingDemands.set(this.defaultDemands());
    this.dailyDemands.set([]);
    this.nurses.set(this.defaultNurses());
    this.nurseProtections.set(this.defaultProtections());
    this.preferences.set(this.defaultPreferences());
    this.fixedWeeklySchedules.set([]);
    this.leaveRequests.set(this.defaultLeaveRequests());
    this.schedules.set([]);
    this.scheduleCells.set([]);
    this.violations.set([]);
    this.swapRequests.set(this.defaultSwapRequests());
    this.holidays.set(this.defaultHolidays());
    this.holidayShifts.set([]);
    this.systemParams.set(this.defaultSystemParams());
    this.legalLimits.set(this.defaultLegalLimits());
    this.userAccounts.set(this.defaultUsers());

    this.saveAll();
    if (this.isBrowser()) {
      localStorage.setItem(STORAGE_PREFIX + 'initialized', 'true');
    }
  }

  saveAll(): void {
    this.saveItem('units', this.units());
    this.saveItem('shifts', this.shifts());
    this.saveItem('staffingDemands', this.staffingDemands());
    this.saveItem('dailyDemands', this.dailyDemands());
    this.saveItem('nurses', this.nurses());
    this.saveItem('nurseProtections', this.nurseProtections());
    this.saveItem('preferences', this.preferences());
    this.saveItem('fixedWeeklySchedules', this.fixedWeeklySchedules());
    this.saveItem('leaveRequests', this.leaveRequests());
    this.saveItem('schedules', this.schedules());
    this.saveItem('scheduleCells', this.scheduleCells());
    this.saveItem('violations', this.violations());
    this.saveItem('swapRequests', this.swapRequests());
    this.saveItem('holidays', this.holidays());
    this.saveItem('holidayShifts', this.holidayShifts());
    this.saveItem('systemParams', this.systemParams());
    this.saveItem('legalLimits', this.legalLimits());
    this.saveItem('userAccounts', this.userAccounts());
  }

  private isBrowser(): boolean {
    return typeof window !== 'undefined' && typeof localStorage !== 'undefined';
  }

  private getItem<T>(key: string, defaultVal: T): T {
    if (!this.isBrowser()) return defaultVal;
    try {
      const data = localStorage.getItem(STORAGE_PREFIX + key);
      return data ? JSON.parse(data) : defaultVal;
    } catch {
      return defaultVal;
    }
  }

  private saveItem<T>(key: string, val: T): void {
    if (!this.isBrowser()) return;
    try {
      localStorage.setItem(STORAGE_PREFIX + key, JSON.stringify(val));
    } catch (e) {
      console.error('Storage save error:', e);
    }
  }

  // --- CRUD Helpers ---

  // Units
  saveUnit(unit: Unit): void {
    const list = [...this.units()];
    const idx = list.findIndex((u) => u.unit_id === unit.unit_id);
    if (idx >= 0) {
      list[idx] = unit;
    } else {
      list.push(unit);
    }
    this.units.set(list);
    this.saveItem('units', list);
  }

  // Shifts
  saveShift(shift: Shift): void {
    const list = [...this.shifts()];
    const idx = list.findIndex((s) => s.shift_id === shift.shift_id);
    if (idx >= 0) {
      list[idx] = shift;
    } else {
      list.push(shift);
    }
    this.shifts.set(list);
    this.saveItem('shifts', list);
  }

  // Nurses
  saveNurse(nurse: Nurse): void {
    const list = [...this.nurses()];
    const idx = list.findIndex((n) => n.nurse_id === nurse.nurse_id);
    if (idx >= 0) {
      list[idx] = nurse;
    } else {
      list.push(nurse);
    }
    this.nurses.set(list);
    this.saveItem('nurses', list);
  }

  // Preferences
  savePreferences(nurseId: number, prefs: Preference[]): void {
    const others = this.preferences().filter((p) => p.nurse_id !== nurseId);
    const updated = [...others, ...prefs];
    this.preferences.set(updated);
    this.saveItem('preferences', updated);
  }

  // Protections
  saveProtections(nurseId: number, protections: NurseProtection[]): void {
    const others = this.nurseProtections().filter((p) => p.nurse_id !== nurseId);
    const updated = [...others, ...protections];
    this.nurseProtections.set(updated);
    this.saveItem('nurseProtections', updated);
  }

  // Leave Requests
  addLeaveRequest(req: Omit<LeaveRequest, 'leave_id'>): LeaveRequest {
    const list = [...this.leaveRequests()];
    const maxId = list.reduce((m, r) => Math.max(m, r.leave_id), 0);
    const newReq: LeaveRequest = { ...req, leave_id: maxId + 1 };
    list.push(newReq);
    this.leaveRequests.set(list);
    this.saveItem('leaveRequests', list);
    return newReq;
  }

  updateLeaveRequest(req: LeaveRequest): void {
    const list = this.leaveRequests().map((r) => (r.leave_id === req.leave_id ? req : r));
    this.leaveRequests.set(list);
    this.saveItem('leaveRequests', list);
  }

  // Swap Requests
  addSwapRequest(req: Omit<SwapRequest, 'swap_id'>): SwapRequest {
    const list = [...this.swapRequests()];
    const maxId = list.reduce((m, r) => Math.max(m, r.swap_id), 0);
    const newReq: SwapRequest = { ...req, swap_id: maxId + 1 };
    list.push(newReq);
    this.swapRequests.set(list);
    this.saveItem('swapRequests', list);
    return newReq;
  }

  updateSwapRequest(req: SwapRequest): void {
    const list = this.swapRequests().map((r) => (r.swap_id === req.swap_id ? req : r));
    this.swapRequests.set(list);
    this.saveItem('swapRequests', list);
  }

  // Schedules & Cells
  saveSchedule(sched: Schedule, cells: ScheduleCell[], viols: Violation[]): void {
    const scheds = this.schedules().filter((s) => s.schedule_id !== sched.schedule_id);
    scheds.push(sched);
    this.schedules.set(scheds);
    this.saveItem('schedules', scheds);

    const otherCells = this.scheduleCells().filter((c) => c.schedule_id !== sched.schedule_id);
    const allCells = [...otherCells, ...cells];
    this.scheduleCells.set(allCells);
    this.saveItem('scheduleCells', allCells);

    const otherViols = this.violations().filter((v) => v.schedule_id !== sched.schedule_id);
    const allViols = [...otherViols, ...viols];
    this.violations.set(allViols);
    this.saveItem('violations', allViols);
  }

  saveScheduleCells(cells: ScheduleCell[]): void {
    this.scheduleCells.set(cells);
    this.saveItem('scheduleCells', cells);
  }

  updateScheduleStatus(scheduleId: number, status: 'D' | 'P' | 'C'): void {
    const now = new Date().toISOString();
    const scheds = this.schedules().map((s) => {
      if (s.schedule_id === scheduleId) {
        return {
          ...s,
          status,
          published_at: status === 'P' ? now : s.published_at,
          closed_at: status === 'C' ? now : s.closed_at,
        };
      }
      return s;
    });
    this.schedules.set(scheds);
    this.saveItem('schedules', scheds);
  }

  deleteSchedule(scheduleId: number): void {
    const scheds = this.schedules().filter((s) => s.schedule_id !== scheduleId);
    this.schedules.set(scheds);
    this.saveItem('schedules', scheds);

    const cells = this.scheduleCells().filter((c) => c.schedule_id !== scheduleId);
    this.scheduleCells.set(cells);
    this.saveItem('scheduleCells', cells);

    const viols = this.violations().filter((v) => v.schedule_id !== scheduleId);
    this.violations.set(viols);
    this.saveItem('violations', viols);
  }

  // User Accounts
  saveUserAccount(user: UserAccount): void {
    const list = [...this.userAccounts()];
    const idx = list.findIndex((u) => u.user_id === user.user_id);
    if (idx >= 0) {
      list[idx] = user;
    } else {
      list.push(user);
    }
    this.userAccounts.set(list);
    this.saveItem('userAccounts', list);
  }

  // Holidays
  saveHolidays(holidays: Holiday[]): void {
    this.holidays.set(holidays);
    this.saveItem('holidays', holidays);
  }

  // System Params
  saveSystemParams(params: SystemParam[]): void {
    this.systemParams.set(params);
    this.saveItem('systemParams', params);
  }

  // Demands
  saveStaffingDemands(demands: StaffingDemand[]): void {
    this.staffingDemands.set(demands);
    this.saveItem('staffingDemands', demands);
  }

  saveDailyDemands(unitId: number, demands: DailyDemand[]): void {
    // Keep demands for other shifts
    const shiftIds = this.shifts()
      .filter((s) => s.unit_id === unitId)
      .map((s) => s.shift_id);
    const otherDemands = this.dailyDemands().filter((d) => !shiftIds.includes(d.shift_id));
    const all = [...otherDemands, ...demands];
    this.dailyDemands.set(all);
    this.saveItem('dailyDemands', all);
  }

  // --- Initial Seed Builders ---

  private defaultUnits(): Unit[] {
    return [
      {
        unit_id: 1,
        code: 'T1',
        name: '7A 一般內科病房',
        beds: 30,
        note: '包含心臟內科與胸腔科病房',
        pref_as_hard: false,
        zero_demand_hard: false,
        max_shift_changes_week: 1,
        min_same_shift_days: 2,
        work_time_system: '4', // 四週彈性工時
        cycle_start_date: '2026-01-05',
        lm_approval_date: '2025-12-15',
        women_night_approved: true,
        overtime_54_approved: true,
      },
      {
        unit_id: 2,
        code: 'ICU',
        name: '加護病房',
        beds: 15,
        note: '重症照護單位，資深比例高',
        pref_as_hard: false,
        zero_demand_hard: false,
        max_shift_changes_week: 1,
        min_same_shift_days: 3,
        work_time_system: '4',
        cycle_start_date: '2026-01-05',
        lm_approval_date: '2025-12-15',
        women_night_approved: true,
        overtime_54_approved: true,
      },
      {
        unit_id: 3,
        code: 'ER',
        name: '急診室',
        beds: 20,
        note: '急診與檢傷單位',
        pref_as_hard: false,
        zero_demand_hard: false,
        max_shift_changes_week: 2,
        min_same_shift_days: 2,
        work_time_system: '4',
        cycle_start_date: '2026-01-05',
        lm_approval_date: '2025-12-15',
        women_night_approved: true,
        overtime_54_approved: true,
      },
    ];
  }

  private defaultShifts(): Shift[] {
    return [
      {
        shift_id: 1,
        unit_id: 1,
        code: 'D',
        name: '白班',
        start_time: '08:00',
        end_time: '16:00',
        work_hours: 8.0,
        is_manual_hours: false,
        color: '#10b981', // Emerald green
        sort_order: 1,
        is_night: false,
        is_active: true,
      },
      {
        shift_id: 2,
        unit_id: 1,
        code: 'E',
        name: '小夜班',
        start_time: '16:00',
        end_time: '00:00',
        work_hours: 8.0,
        is_manual_hours: false,
        color: '#f59e0b', // Amber
        sort_order: 2,
        is_night: true,
        is_active: true,
      },
      {
        shift_id: 3,
        unit_id: 1,
        code: 'N',
        name: '大夜班',
        start_time: '00:00',
        end_time: '08:00',
        work_hours: 8.0,
        is_manual_hours: false,
        color: '#6366f1', // Indigo
        sort_order: 3,
        is_night: true,
        is_active: true,
      },
    ];
  }

  private defaultDemands(): StaffingDemand[] {
    return [
      // 白班 D
      { shift_id: 1, day_type: 'W', required: 5, senior_required: 2 },
      { shift_id: 1, day_type: 'R', required: 4, senior_required: 1 },
      { shift_id: 1, day_type: 'H', required: 4, senior_required: 1 },
      // 小夜班 E
      { shift_id: 2, day_type: 'W', required: 3, senior_required: 1 },
      { shift_id: 2, day_type: 'R', required: 3, senior_required: 1 },
      { shift_id: 2, day_type: 'H', required: 3, senior_required: 1 },
      // 大夜班 N
      { shift_id: 3, day_type: 'W', required: 2, senior_required: 1 },
      { shift_id: 3, day_type: 'R', required: 2, senior_required: 1 },
      { shift_id: 3, day_type: 'H', required: 2, senior_required: 1 },
    ];
  }

  private defaultNurses(): Nurse[] {
    return [
      {
        nurse_id: 1,
        unit_id: 1,
        emp_no: 'N1001',
        name: '林雅惠',
        sex: 'F',
        level: 'N4',
        employment_type: 'F',
        can_lead: true,
        can_night: false, // 護理長不上夜班
        max_month_hours: 184,
        monthly_off_days: 8,
        is_active: true,
        hire_date: '2016-03-01',
        phone: '0912-345-001',
        note: '7A 護理長',
        shift_change_consent: false,
      },
      {
        nurse_id: 2,
        unit_id: 1,
        emp_no: 'N1002',
        name: '張佩芬',
        sex: 'F',
        level: 'N3',
        employment_type: 'F',
        can_lead: true,
        can_night: true,
        max_month_hours: 184,
        monthly_off_days: 8,
        is_active: true,
        hire_date: '2018-07-15',
        phone: '0912-345-002',
        note: '資深帶班護理師',
        shift_change_consent: true,
      },
      {
        nurse_id: 3,
        unit_id: 1,
        emp_no: 'N1003',
        name: '王美玲',
        sex: 'F',
        level: 'N3',
        employment_type: 'F',
        can_lead: true,
        can_night: true,
        max_month_hours: 184,
        monthly_off_days: 8,
        is_active: true,
        hire_date: '2019-02-10',
        phone: '0912-345-003',
        note: '資深護理師',
        shift_change_consent: true,
      },
      {
        nurse_id: 4,
        unit_id: 1,
        emp_no: 'N1004',
        name: '李佳燕',
        sex: 'F',
        level: 'N2',
        employment_type: 'F',
        can_lead: true,
        can_night: true,
        max_month_hours: 184,
        monthly_off_days: 8,
        is_active: true,
        hire_date: '2020-08-01',
        phone: '0912-345-004',
        shift_change_consent: false,
      },
      {
        nurse_id: 5,
        unit_id: 1,
        emp_no: 'N1005',
        name: '陳怡君',
        sex: 'F',
        level: 'N2',
        employment_type: 'F',
        can_lead: false,
        can_night: true,
        max_month_hours: 184,
        monthly_off_days: 8,
        is_active: true,
        hire_date: '2021-04-12',
        phone: '0912-345-005',
        shift_change_consent: true,
      },
      {
        nurse_id: 6,
        unit_id: 1,
        emp_no: 'N1006',
        name: '林家瑜',
        sex: 'F',
        level: 'N1',
        employment_type: 'F',
        can_lead: false,
        can_night: true,
        max_month_hours: 184,
        monthly_off_days: 8,
        is_active: true,
        hire_date: '2022-09-01',
        phone: '0912-345-006',
        shift_change_consent: false,
      },
      {
        nurse_id: 7,
        unit_id: 1,
        emp_no: 'N1007',
        name: '黃靜儀',
        sex: 'F',
        level: 'N1',
        employment_type: 'F',
        can_lead: false,
        can_night: true,
        max_month_hours: 184,
        monthly_off_days: 8,
        is_active: true,
        hire_date: '2023-01-16',
        phone: '0912-345-007',
        shift_change_consent: false,
      },
      {
        nurse_id: 8,
        unit_id: 1,
        emp_no: 'N1008',
        name: '吳承翰',
        sex: 'M',
        level: 'N2',
        employment_type: 'F',
        can_lead: false,
        can_night: true,
        max_month_hours: 184,
        monthly_off_days: 8,
        is_active: true,
        hire_date: '2021-11-01',
        phone: '0912-345-008',
        shift_change_consent: true,
      },
      {
        nurse_id: 9,
        unit_id: 1,
        emp_no: 'N1009',
        name: '周婉儀',
        sex: 'F',
        level: 'N',
        employment_type: 'F',
        can_lead: false,
        can_night: true,
        max_month_hours: 184,
        monthly_off_days: 8,
        is_active: true,
        hire_date: '2024-03-01',
        phone: '0912-345-009',
        note: '新人培訓中',
        shift_change_consent: false,
      },
      {
        nurse_id: 10,
        unit_id: 1,
        emp_no: 'N1010',
        name: '郭欣儒',
        sex: 'F',
        level: 'N1',
        employment_type: 'F',
        can_lead: false,
        can_night: false, // 懷孕中不可值夜
        max_month_hours: 184,
        monthly_off_days: 8,
        is_active: true,
        hire_date: '2022-10-15',
        phone: '0912-345-010',
        note: '妊娠保護期間',
        shift_change_consent: false,
      },
      {
        nurse_id: 11,
        unit_id: 1,
        emp_no: 'N1011',
        name: '楊淑芬',
        sex: 'F',
        level: 'N3',
        employment_type: 'F',
        can_lead: true,
        can_night: true,
        max_month_hours: 184,
        monthly_off_days: 8,
        is_active: true,
        hire_date: '2019-05-20',
        phone: '0912-345-011',
        shift_change_consent: true,
      },
      {
        nurse_id: 12,
        unit_id: 1,
        emp_no: 'N1012',
        name: '劉雅筑',
        sex: 'F',
        level: 'N2',
        employment_type: 'F',
        can_lead: false,
        can_night: true,
        max_month_hours: 184,
        monthly_off_days: 8,
        is_active: true,
        hire_date: '2021-06-01',
        phone: '0912-345-012',
        shift_change_consent: false,
      },
      {
        nurse_id: 13,
        unit_id: 1,
        emp_no: 'N1013',
        name: '許哲豪',
        sex: 'M',
        level: 'N1',
        employment_type: 'F',
        can_lead: false,
        can_night: true,
        max_month_hours: 184,
        monthly_off_days: 8,
        is_active: true,
        hire_date: '2023-07-01',
        phone: '0912-345-013',
        shift_change_consent: true,
      },
      {
        nurse_id: 14,
        unit_id: 1,
        emp_no: 'N1014',
        name: '蔡佩珊',
        sex: 'F',
        level: 'N2',
        employment_type: 'F',
        can_lead: false,
        can_night: true,
        max_month_hours: 184,
        monthly_off_days: 8,
        is_active: true,
        hire_date: '2020-12-01',
        phone: '0912-345-014',
        shift_change_consent: true,
      },
      {
        nurse_id: 15,
        unit_id: 1,
        emp_no: 'N1015',
        name: '鄭安妮',
        sex: 'F',
        level: 'N1',
        employment_type: 'F',
        can_lead: false,
        can_night: true,
        max_month_hours: 184,
        monthly_off_days: 8,
        is_active: true,
        hire_date: '2023-02-15',
        phone: '0912-345-015',
        shift_change_consent: false,
      },
    ];
  }

  private defaultProtections(): NurseProtection[] {
    return [
      {
        protection_id: 1,
        nurse_id: 10, // 郭欣儒
        protection_type: 'P', // 妊娠保護
        start_date: '2026-06-01',
        end_date: '2027-02-28',
        note: '產前檢查正常，依法不得從事 22:00-06:00 夜間工作',
      },
    ];
  }

  private defaultPreferences(): Preference[] {
    return [
      {
        pref_id: 1,
        nurse_id: 2, // 張佩芬
        pref_type: 'O', // 固定星期休
        weekday: 0, // 週日
        strength: 10,
      },
      {
        pref_id: 2,
        nurse_id: 8, // 吳承翰
        pref_type: 'F', // 固定班別
        shift_id: 2, // 小夜班
        strength: 10,
      },
      {
        pref_id: 3,
        nurse_id: 6, // 林家瑜
        pref_type: 'X', // 不排此班
        shift_id: 3, // 大夜班
        strength: 10,
      },
    ];
  }

  private defaultLeaveRequests(): LeaveRequest[] {
    return [
      {
        leave_id: 1,
        nurse_id: 3, // 王美玲
        leave_date: '2026-10-15',
        leave_type: 'L',
        shift_id: null,
        reason: '家中有事申請事假',
        status: 'A', // 已核准
        created_by: 1,
        created_at: '2026-10-01T09:00:00Z',
        reviewed_by: 1,
        reviewed_at: '2026-10-02T10:00:00Z',
      },
      {
        leave_id: 2,
        nurse_id: 5, // 陳怡君
        leave_date: '2026-10-22',
        leave_type: 'P',
        shift_id: null,
        reason: '專業護理教育學分研習',
        status: 'P', // 待審核
        created_by: 5,
        created_at: '2026-10-08T14:30:00Z',
      },
      {
        leave_id: 3,
        nurse_id: 7, // 黃靜儀
        leave_date: '2026-10-25',
        leave_type: 'S',
        shift_id: 1, // 指定白班
        reason: '晚上有回流家庭聚餐，希望白天上班',
        status: 'A', // 已核准
        created_by: 7,
        created_at: '2026-10-05T11:00:00Z',
        reviewed_by: 1,
        reviewed_at: '2026-10-06T12:00:00Z',
      },
    ];
  }

  private defaultSwapRequests(): SwapRequest[] {
    return [
      {
        swap_id: 1,
        schedule_id: 1,
        requester_id: 5, // 陳怡君
        requester_date: '2026-10-28',
        target_id: 6, // 林家瑜
        target_date: '2026-10-29',
        reason: '臨時有家庭聚會，請求換班',
        status: 'G', // 對方已同意，待護理長核准
      },
    ];
  }

  private defaultHolidays(): Holiday[] {
    return [
      { holiday_date: '2026-01-01', name: '元旦開國紀念日', is_makeup_workday: false },
      { holiday_date: '2026-02-16', name: '農曆除夕', is_makeup_workday: false },
      { holiday_date: '2026-02-17', name: '春節初一', is_makeup_workday: false },
      { holiday_date: '2026-02-18', name: '春節初二', is_makeup_workday: false },
      { holiday_date: '2026-02-19', name: '春節初三', is_makeup_workday: false },
      { holiday_date: '2026-02-28', name: '和平紀念日', is_makeup_workday: false },
      { holiday_date: '2026-04-03', name: '兒童節', is_makeup_workday: false },
      { holiday_date: '2026-04-04', name: '清明節', is_makeup_workday: false },
      { holiday_date: '2026-05-01', name: '勞動節', is_makeup_workday: false },
      { holiday_date: '2026-06-19', name: '端午節', is_makeup_workday: false },
      { holiday_date: '2026-09-25', name: '中秋節', is_makeup_workday: false },
      { holiday_date: '2026-10-10', name: '國慶日', is_makeup_workday: false },
    ];
  }

  private defaultSystemParams(): SystemParam[] {
    return [
      { param_key: 'min_rest_hours', param_value: '11', description: '最少休息時數 (法定下限11小時)' },
      { param_key: 'max_consecutive_days', param_value: '6', description: '連續上班天數上限' },
      { param_key: 'min_monthly_off_days', param_value: '8', description: '每月最少休假天數' },
      { param_key: 'default_max_month_hours', param_value: '184', description: '全職員工月工時上限' },
      { param_key: 'max_night_shifts_suggested', param_value: '10', description: '每月夜班建議上限' },
      { param_key: 'random_seed', param_value: '42', description: '排班固定亂數種子' },
      { param_key: 'max_iterations', param_value: '40000', description: '最佳化搜尋迭代次數' },
      { param_key: 'max_time_seconds', param_value: '20', description: '排班搜尋時間上限 (秒)' },
      // Weights
      { param_key: 'w_approved_leave', param_value: '1000', description: '硬規則：核准休假權重' },
      { param_key: 'w_staffing', param_value: '800', description: '硬規則：人力需求不足權重' },
      { param_key: 'w_rest_hours', param_value: '700', description: '硬規則：休息不足11小時權重' },
      { param_key: 'w_senior', param_value: '600', description: '硬規則：無資深人員權重' },
      { param_key: 'w_consecutive', param_value: '500', description: '硬規則：連上超過6天或月休不足權重' },
      { param_key: 'w_work_hours', param_value: '400', description: '硬規則：月工時超過上限權重' },
      { param_key: 'w_overstaffing', param_value: '100', description: '軟規則：人力超編權重' },
      { param_key: 'w_night_fairness', param_value: '60', description: '軟規則：夜班公平度權重' },
      { param_key: 'w_holiday_fairness', param_value: '40', description: '軟規則：假日公平度權重' },
      { param_key: 'w_preference', param_value: '30', description: '軟規則：未滿足偏好基準權重' },
      { param_key: 'w_isolated_off', param_value: '15', description: '軟規則：單日零星休假權重' },
    ];
  }

  private defaultLegalLimits(): LegalLimit[] {
    return [
      { rule_code: 'BR-L1', work_time_system: '*', limit_key: 'daily_normal_max', limit_value: 8.0, law_ref: '勞基法 §30' },
      { rule_code: 'BR-L1', work_time_system: '4', limit_key: 'daily_flex_max', limit_value: 10.0, law_ref: '勞基法 §30-1' },
      { rule_code: 'BR-L1', work_time_system: '*', limit_key: 'daily_total_max', limit_value: 12.0, law_ref: '勞基法 §32' },
      { rule_code: 'BR-L2', work_time_system: '4', limit_key: 'cycle_4w_max', limit_value: 160.0, law_ref: '勞基法 §30-1' },
      { rule_code: 'BR-L3', work_time_system: '4', limit_key: 'cycle_off_min', limit_value: 8.0, law_ref: '勞基法 §36' },
      { rule_code: 'BR-L5', work_time_system: '*', limit_key: 'min_rest_hours', limit_value: 11.0, law_ref: '勞基法 §34 第2項' },
      { rule_code: 'BR-L12', work_time_system: '*', limit_key: 'month_ot_max', limit_value: 46.0, law_ref: '勞基法 §32' },
      { rule_code: 'BR-L12', work_time_system: '*', limit_key: 'month_ot_agreed_max', limit_value: 54.0, law_ref: '勞基法 §32' },
    ];
  }

  private defaultUsers(): UserAccount[] {
    return [
      {
        user_id: 1,
        login: 'admin',
        display_name: '全院系統管理員',
        password_hash: 'admin123',
        role: 'A',
        unit_id: null,
        nurse_id: null,
        must_change_pw: false,
        failed_count: 0,
        is_locked: false,
      },
      {
        user_id: 2,
        login: 'user1',
        display_name: '林雅惠 護理長 (7A)',
        password_hash: 'user123',
        role: 'H',
        unit_id: 1,
        nurse_id: 1,
        must_change_pw: false,
        failed_count: 0,
        is_locked: false,
      },
      {
        user_id: 3,
        login: 'user2',
        display_name: 'ICU 護理長',
        password_hash: 'user123',
        role: 'H',
        unit_id: 2,
        nurse_id: null,
        must_change_pw: false,
        failed_count: 0,
        is_locked: false,
      },
      {
        user_id: 4,
        login: 'nurse1',
        display_name: '張佩芬 護理師 (7A)',
        password_hash: 'nurse123',
        role: 'N',
        unit_id: 1,
        nurse_id: 2,
        must_change_pw: false,
        failed_count: 0,
        is_locked: false,
      },
      {
        user_id: 5,
        login: 'nurse2',
        display_name: '王美玲 護理師 (7A)',
        password_hash: 'nurse123',
        role: 'N',
        unit_id: 1,
        nurse_id: 3,
        must_change_pw: false,
        failed_count: 0,
        is_locked: false,
      },
      {
        user_id: 6,
        login: 'nurse3',
        display_name: '李佳燕 護理師 (7A)',
        password_hash: 'nurse123',
        role: 'N',
        unit_id: 1,
        nurse_id: 4,
        must_change_pw: false,
        failed_count: 0,
        is_locked: false,
      },
      {
        user_id: 7,
        login: 'nurse4',
        display_name: '陳怡君 護理師 (7A)',
        password_hash: 'nurse123',
        role: 'N',
        unit_id: 1,
        nurse_id: 5,
        must_change_pw: false,
        failed_count: 0,
        is_locked: false,
      },
      {
        user_id: 8,
        login: 'nurse5',
        display_name: '郭欣儒 護理師 (7A,妊娠)',
        password_hash: 'nurse123',
        role: 'N',
        unit_id: 1,
        nurse_id: 10,
        must_change_pw: false,
        failed_count: 0,
        is_locked: false,
      },
    ];
  }
}
