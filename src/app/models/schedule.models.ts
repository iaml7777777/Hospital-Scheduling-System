// ==========================================
// SA/SD Data Models for Hospital Scheduling System
// ==========================================

export type UserRole = 'A' | 'H' | 'N'; // A: 系統管理員, H: 護理長, N: 護理人員

export interface UserAccount {
  user_id: number;
  login: string;
  display_name: string;
  password_hash: string;
  role: UserRole;
  unit_id: number | null; // 管理員可為 null
  nurse_id: number | null; // 對應護理人員
  must_change_pw: boolean;
  failed_count: number;
  is_locked: boolean;
}

export type WorkTimeSystem = 'G' | '2' | '4' | '8'; // G: 一般, 2: 二週彈性, 4: 四週彈性, 8: 八週彈性

export interface Unit {
  unit_id: number;
  code: string; // 如 T1, ICU
  name: string; // 如 7A一般內科病房
  beds: number;
  note?: string;
  pref_as_hard: boolean; // 個人偏好視為硬性限制，預設 false
  zero_demand_hard: boolean; // 需求填 0 的班別完全不排人，預設 false
  max_shift_changes_week?: number; // 平均每週最多換班別次數
  min_same_shift_days?: number; // 同一班別最少連續天數
  // 法規相關
  work_time_system: WorkTimeSystem;
  cycle_start_date: string; // YYYY-MM-DD
  lm_approval_date?: string; // 勞資會議同意日
  women_night_approved: boolean; // 同意女性夜間工作
  overtime_54_approved: boolean; // 同意延長工時上限54小時
}

export interface Shift {
  shift_id: number;
  unit_id: number;
  code: string; // D, E, N
  name: string; // 白班, 小夜班, 大夜班
  start_time: string; // HH:mm
  end_time: string; // HH:mm (可跨日)
  work_hours: number; // 實際工時
  is_manual_hours?: boolean; // 手動設定標示 ✱
  color: string; // HEX 色碼
  sort_order: number;
  is_night: boolean; // 屬於夜班
  is_active: boolean; // 啟用
}

export type DayType = 'W' | 'R' | 'H'; // W: 平日, R: 例假日, H: 國定假日

export interface StaffingDemand {
  shift_id: number;
  day_type: DayType;
  required: number;
  senior_required: number;
}

export interface DailyDemand {
  shift_id: number;
  demand_date: string; // YYYY-MM-DD
  required: number; // 0 = 不開, undefined = 沿用日型態
  senior_required: number;
}

export type NurseLevel = 'N' | 'N1' | 'N2' | 'N3' | 'N4';
export type EmploymentType = 'F' | 'P'; // F: 全職, P: 兼職
export type ProtectionType = 'P' | 'B' | 'H'; // P: 妊娠, B: 哺乳, H: 健康或正當理由不宜夜間

export interface NurseProtection {
  protection_id: number;
  nurse_id: number;
  protection_type: ProtectionType;
  start_date: string; // YYYY-MM-DD
  end_date: string;
  note?: string;
}

export interface Nurse {
  nurse_id: number;
  unit_id: number;
  emp_no: string;
  name: string;
  sex: 'M' | 'F';
  level: NurseLevel;
  employment_type: EmploymentType;
  can_lead: boolean; // 可帶班 (資深)
  can_night: boolean; // 可排夜班
  max_month_hours: number; // 預設 184，不可為 0
  monthly_off_days: number; // 預設 8
  is_active: boolean;
  hire_date?: string;
  phone?: string;
  note?: string;
  contracted_hours?: number; // 週期約定正常工時
  shift_change_consent: boolean; // 本人同意每週更換班次超過一次
  resign_date?: string; // 離職日
}

export type PrefType = 'F' | 'X' | 'O'; // F: 固定班別, X: 不排此班, O: 固定星期休

export interface Preference {
  pref_id: number;
  nurse_id: number;
  pref_type: PrefType;
  shift_id?: number | null; // pref_type = O 時為空
  weekday?: number | null; // 0~6, 空值 = 每天 (0: 週日, 1: 週一... 6: 週六)
  strength: number; // 預設 10
}

export interface FixedWeeklySchedule {
  nurse_id: number;
  weekday: number; // 0~6
  assignment_type: 'NONE' | 'OFF' | 'SHIFT';
  shift_id?: number;
}

export type LeaveType = 'L' | 'P' | 'S'; // L: 休假, P: 預休, S: 指定班別
export type LeaveStatus = 'P' | 'A' | 'R' | 'C'; // P: 待審核, A: 已核准, R: 駁回, C: 已取消

export interface LeaveRequest {
  leave_id: number;
  nurse_id: number;
  leave_date: string; // YYYY-MM-DD
  leave_type: LeaveType;
  shift_id?: number | null; // 指定班別時填寫
  reason: string;
  status: LeaveStatus;
  created_by: number; // user_id
  created_at: string;
  reviewed_by?: number | null;
  reviewed_at?: string | null;
  reject_reason?: string;
}

export type ScheduleStatus = 'D' | 'P' | 'C'; // D: 草稿, P: 已公布, C: 已結案
export type OffType = 'R' | 'S' | 'H' | 'A' | 'O'; // R: 例假, S: 休息日, H: 國定假日, A: 特休, O: 其他假別

export interface ScheduleCell {
  schedule_id: number;
  nurse_id: number;
  work_date: string; // YYYY-MM-DD
  shift_id: number | null; // null = 休假
  off_type?: OffType | null; // shift_id 為空時必填
  is_pinned: boolean; // 釘選
  emergency_reason?: string; // 因天災突發事件出勤理由 (勞基法 §40)
}

export interface Schedule {
  schedule_id: number;
  unit_id: number;
  year: number;
  month: number;
  status: ScheduleStatus;
  seed_used: number;
  hard_count: number;
  soft_count: number;
  total_penalty: number;
  quality_score: number;
  published_at?: string | null;
  closed_at?: string | null;
}

export type Severity = 'H' | 'S'; // H: 必須修正 (硬規則/法規), S: 建議調整 (軟規則/指引)

export interface Violation {
  violation_id?: string;
  schedule_id?: number;
  rule_code: string;
  severity: Severity;
  nurse_id?: number | null;
  nurse_name?: string;
  work_date?: string | null;
  shift_id?: number | null;
  shift_code?: string;
  message: string;
  penalty: number;
  law_ref?: string;
}

export type SwapStatus = 'P' | 'G' | 'A' | 'R' | 'C'; // P: 待對方同意, G: 對方已同意, A: 已核准, R: 拒絕, C: 已取消

export interface SwapRequest {
  swap_id: number;
  schedule_id: number;
  requester_id: number;
  requester_date: string;
  target_id: number;
  target_date: string;
  reason: string;
  status: SwapStatus;
  approved_by?: number | null;
  approved_at?: string | null;
}

export interface Holiday {
  holiday_date: string; // YYYY-MM-DD
  name: string;
  is_makeup_workday: boolean; // 補班日
}

export interface HolidayShift {
  move_id: number;
  nurse_id: number;
  original_date: string;
  moved_to_date: string;
  consented_at: string;
}

export interface SystemParam {
  param_key: string;
  param_value: string;
  description: string;
}

export interface LegalLimit {
  rule_code: string;
  work_time_system: string; // *, G, 2, 4, 8
  limit_key: string;
  limit_value: number;
  law_ref: string;
}
