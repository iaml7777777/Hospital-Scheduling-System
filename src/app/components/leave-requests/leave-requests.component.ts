import { Component, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AuthService } from '../../services/auth.service';
import { DataService } from '../../services/data.service';
import { LeaveRequest, LeaveType, LeaveStatus, Nurse, Shift } from '../../models/schedule.models';

@Component({
  selector: 'app-leave-requests',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="page-container">
      <div class="card" style="margin-bottom: 20px;">
        <h2>
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
            <polyline points="14 2 14 8 20 8"></polyline>
            <line x1="16" y1="13" x2="8" y2="13"></line>
            <line x1="16" y1="17" x2="8" y2="17"></line>
          </svg>
          休假與預班申請管理 (UI-05)
        </h2>
        <p class="subtitle" style="font-size: 0.85rem; color: #64748b; margin-top: 4px;">
          同仁可提出休假、預休或指定班別申請；經護理長核准後將成為自動排班之硬性限制條件。
        </p>
      </div>

      <div class="leave-grid-layout">
        <!-- Left: Submit Request Card -->
        <div class="card">
          <div class="card-header">
            <h3>提出申請</h3>
          </div>

          <div *ngIf="submitMsg()" class="alert" [ngClass]="submitMsg()?.success ? 'alert-success' : 'alert-danger'">
            {{ submitMsg()?.text }}
          </div>

          <form (ngSubmit)="onSubmitRequest()">
            <!-- Nurse selector (head nurse / admin can proxy apply) -->
            <div class="form-group" *ngIf="canProxyApply()">
              <label>申請同仁 (護理長可代送) *</label>
              <select [(ngModel)]="targetNurseId" name="targetNurse" required>
                <option *ngFor="let n of unitNurses()" [value]="n.nurse_id">
                  {{ n.name }} (#{{ n.emp_no }} - {{ n.level }})
                </option>
              </select>
            </div>

            <!-- Single nurse info if nurse login -->
            <div class="form-group" *ngIf="!canProxyApply()">
              <label>申請人</label>
              <input type="text" [value]="currentNurseName()" disabled style="background: #f8fafc;" />
            </div>

            <!-- Leave Date -->
            <div class="form-group">
              <label>申請日期 *</label>
              <input type="date" [(ngModel)]="leaveDate" name="leaveDate" required />
            </div>

            <!-- Leave Type -->
            <div class="form-group">
              <label>申請類型 *</label>
              <select [(ngModel)]="leaveType" name="leaveType" required>
                <option value="L">休假 (正式請假)</option>
                <option value="P">預休 (預選例休)</option>
                <option value="S">指定班別 (當天指定上特定班)</option>
              </select>
            </div>

            <!-- Specified Shift if S selected -->
            <div class="form-group" *ngIf="leaveType === 'S'">
              <label>指定班別 *</label>
              <select [(ngModel)]="selectedShiftId" name="specifiedShift" required>
                <option *ngFor="let s of unitShifts()" [value]="s.shift_id">
                  {{ s.name }} ({{ s.code }} - {{ s.start_time }}~{{ s.end_time }})
                </option>
              </select>
            </div>

            <!-- Reason -->
            <div class="form-group">
              <label>申請事由 *</label>
              <textarea
                [(ngModel)]="reason"
                name="reason"
                required
                rows="3"
                placeholder="請輸入請假或預班事由 (例如: 家庭聚會、醫學進修研習)"
              ></textarea>
            </div>

            <button type="submit" class="btn btn-primary" style="width: 100%; margin-top: 10px;">
              送出申請
            </button>
          </form>
        </div>

        <!-- Right: Applications List & Review -->
        <div class="card">
          <div class="card-header">
            <h3>申請清單紀錄</h3>
            <div class="status-filters">
              <button
                class="filter-chip"
                [class.active]="filterStatus() === 'ALL'"
                (click)="filterStatus.set('ALL')"
              >
                全部 ({{ allRequests().length }})
              </button>
              <button
                class="filter-chip"
                [class.active]="filterStatus() === 'P'"
                (click)="filterStatus.set('P')"
              >
                待審核 ({{ pendingCount() }})
              </button>
              <button
                class="filter-chip"
                [class.active]="filterStatus() === 'A'"
                (click)="filterStatus.set('A')"
              >
                已核准
              </button>
            </div>
          </div>

          <div class="table-responsive">
            <table class="data-table">
              <thead>
                <tr>
                  <th>申請同仁</th>
                  <th>日期</th>
                  <th>類型</th>
                  <th>指定班別 / 事由</th>
                  <th>申請時間</th>
                  <th>狀態</th>
                  <th>操作</th>
                </tr>
              </thead>
              <tbody>
                <tr *ngFor="let req of filteredRequests()">
                  <td>
                    <strong>{{ getNurseName(req.nurse_id) }}</strong>
                  </td>
                  <td>{{ req.leave_date }}</td>
                  <td>
                    <span class="badge" [ngClass]="getLeaveTypeBadge(req.leave_type)">
                      {{ getLeaveTypeLabel(req.leave_type) }}
                    </span>
                  </td>
                  <td>
                    <div style="font-weight: 500;" *ngIf="req.shift_id">
                      指定：{{ getShiftName(req.shift_id) }}
                    </div>
                    <div style="font-size: 0.8rem; color: #64748b;">{{ req.reason }}</div>
                  </td>
                  <td style="font-size: 0.75rem; color: #94a3b8;">
                    {{ req.created_at | date: 'MM/dd HH:mm' }}
                  </td>
                  <td>
                    <span class="badge" [ngClass]="getStatusBadge(req.status)">
                      {{ getStatusLabel(req.status) }}
                    </span>
                  </td>
                  <td>
                    <!-- Actions for reviewer -->
                    <div class="action-btn-group" *ngIf="req.status === 'P' && canReview()">
                      <button class="btn btn-success btn-sm" (click)="onReview(req, 'A')">核准</button>
                      <button class="btn btn-danger btn-sm" (click)="onReview(req, 'R')">駁回</button>
                    </div>

                    <!-- Action for applicant to cancel -->
                    <div *ngIf="req.status === 'P' && canCancel(req)">
                      <button class="btn btn-secondary btn-sm" (click)="onCancel(req)">取消</button>
                    </div>
                  </td>
                </tr>

                <tr *ngIf="filteredRequests().length === 0">
                  <td colspan="7" style="text-align: center; color: #94a3b8; padding: 30px;">
                    無符合條件的申請單據
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .leave-grid-layout {
      display: grid;
      grid-template-columns: 360px 1fr;
      gap: 20px;
    }

    .alert {
      padding: 10px 12px;
      border-radius: 6px;
      font-size: 0.85rem;
      margin-bottom: 14px;
    }

    .alert-danger { background: #fee2e2; color: #991b1b; }
    .alert-success { background: #d1fae5; color: #065f46; }

    .status-filters {
      display: flex;
      gap: 6px;

      .filter-chip {
        padding: 4px 10px;
        border-radius: 6px;
        font-size: 0.78rem;
        background: #f1f5f9;
        color: #475569;
        border: 1px solid var(--border-color);

        &.active {
          background: #0284c7;
          color: #fff;
          border-color: #0284c7;
        }
      }
    }

    .action-btn-group {
      display: flex;
      gap: 6px;
    }
  `],
})
export class LeaveRequestsComponent {
  auth = inject(AuthService);
  private dataService = inject(DataService);

  targetNurseId: number | null = null;
  leaveDate = '2026-10-18';
  leaveType: LeaveType = 'L';
  selectedShiftId: number | null = 1;
  reason = '';

  filterStatus = signal<string>('ALL');
  submitMsg = signal<{ text: string; success: boolean } | null>(null);

  unitNurses = computed(() => {
    const user = this.auth.currentUser();
    const uid = user?.unit_id || 1;
    return this.dataService.nurses().filter((n) => n.unit_id === uid && n.is_active);
  });

  unitShifts = computed(() => {
    const user = this.auth.currentUser();
    const uid = user?.unit_id || 1;
    return this.dataService.shifts().filter((s) => s.unit_id === uid && s.is_active);
  });

  allRequests = computed(() => {
    const user = this.auth.currentUser();
    const all = this.dataService.leaveRequests();
    if (user?.role === 'N' && user.nurse_id) {
      return all.filter((r) => r.nurse_id === user.nurse_id);
    }
    return all;
  });

  filteredRequests = computed(() => {
    const status = this.filterStatus();
    const list = this.allRequests();
    if (status === 'ALL') return list;
    return list.filter((r) => r.status === status);
  });

  pendingCount = computed(() => this.allRequests().filter((r) => r.status === 'P').length);

  constructor() {
    const user = this.auth.currentUser();
    if (user?.nurse_id) {
      this.targetNurseId = user.nurse_id;
    } else {
      this.targetNurseId = this.unitNurses()[0]?.nurse_id || 1;
    }
  }

  canProxyApply(): boolean {
    return this.auth.isAdmin() || this.auth.isHeadNurse();
  }

  canReview(): boolean {
    return this.auth.isAdmin() || this.auth.isHeadNurse();
  }

  canCancel(req: LeaveRequest): boolean {
    const user = this.auth.currentUser();
    return req.created_by === user?.user_id || req.nurse_id === user?.nurse_id;
  }

  currentNurseName(): string {
    const user = this.auth.currentUser();
    return user?.display_name || '護理同仁';
  }

  getNurseName(nurseId: number): string {
    const nurse = this.dataService.nurses().find((n) => n.nurse_id === nurseId);
    return nurse ? `${nurse.name} (${nurse.level})` : `同仁 #${nurseId}`;
  }

  getShiftName(shiftId: number | null | undefined): string {
    if (!shiftId) return '';
    const shift = this.dataService.shifts().find((s) => s.shift_id === shiftId);
    return shift ? `${shift.name} (${shift.code})` : '';
  }

  getLeaveTypeBadge(type: LeaveType): string {
    if (type === 'L') return 'badge-danger';
    if (type === 'P') return 'badge-warning';
    return 'badge-primary';
  }

  getLeaveTypeLabel(type: LeaveType): string {
    if (type === 'L') return '休假';
    if (type === 'P') return '預休';
    return '指定班別';
  }

  getStatusBadge(status: LeaveStatus): string {
    switch (status) {
      case 'P': return 'badge-warning';
      case 'A': return 'badge-success';
      case 'R': return 'badge-danger';
      case 'C': return 'badge-neutral';
    }
  }

  getStatusLabel(status: LeaveStatus): string {
    switch (status) {
      case 'P': return '待審核';
      case 'A': return '已核准';
      case 'R': return '已駁回';
      case 'C': return '已取消';
    }
  }

  onSubmitRequest(): void {
    const user = this.auth.currentUser();
    const nurseId = this.targetNurseId || user?.nurse_id;
    if (!nurseId || !this.leaveDate || !this.reason) {
      this.submitMsg.set({ text: '請填妥所有必填欄位！', success: false });
      return;
    }

    // Check duplicate pending request (6.4: 同一人同一天同一種休假申請只能有一張待審核)
    const exists = this.dataService
      .leaveRequests()
      .some(
        (r) =>
          r.nurse_id === nurseId &&
          r.leave_date === this.leaveDate &&
          r.leave_type === this.leaveType &&
          r.status === 'P'
      );

    if (exists) {
      this.submitMsg.set({
        text: '該同仁於該日期已有相同類型之待審核申請，不可重複提出！',
        success: false,
      });
      return;
    }

    this.dataService.addLeaveRequest({
      nurse_id: nurseId,
      leave_date: this.leaveDate,
      leave_type: this.leaveType,
      shift_id: this.leaveType === 'S' ? this.selectedShiftId : null,
      reason: this.reason,
      status: 'P',
      created_by: user?.user_id || 1,
      created_at: new Date().toISOString(),
    });

    this.submitMsg.set({ text: '休假/預班申請已成功送出！', success: true });
    this.reason = '';
  }

  onReview(req: LeaveRequest, decision: 'A' | 'R'): void {
    const user = this.auth.currentUser();
    const updated: LeaveRequest = {
      ...req,
      status: decision,
      reviewed_by: user?.user_id || 1,
      reviewed_at: new Date().toISOString(),
    };
    this.dataService.updateLeaveRequest(updated);
  }

  onCancel(req: LeaveRequest): void {
    if (confirm('確定要取消此筆待審核申請嗎？')) {
      const updated: LeaveRequest = {
        ...req,
        status: 'C',
      };
      this.dataService.updateLeaveRequest(updated);
    }
  }
}
