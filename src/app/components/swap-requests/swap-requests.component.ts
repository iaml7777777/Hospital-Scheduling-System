import { Component, inject, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AuthService } from '../../services/auth.service';
import { DataService } from '../../services/data.service';
import { RuleCheckerService } from '../../services/rule-checker.service';
import { SwapRequest, SwapStatus, Nurse, ScheduleCell } from '../../models/schedule.models';

@Component({
  selector: 'app-swap-requests',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="page-container">
      <div class="card" style="margin-bottom: 20px;">
        <h2>
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M16 3h5v5"></path>
            <path d="M4 20L21 3"></path>
            <path d="M21 16v5h-5"></path>
            <path d="M15 15l6 6"></path>
            <path d="M4 4l5 5"></path>
          </svg>
          護理同仁三方確認換班管理 (UI-06)
        </h2>
        <p class="subtitle" style="font-size: 0.85rem; color: #64748b; margin-top: 4px;">
          依標準換班流程：護理人員提出 ➔ 對方同仁線上同意 ➔ 護理長法規合規檢查後核准，核准當下系統自動對調班表。
        </p>
      </div>

      <!-- Swap Requests Table Card -->
      <div class="card">
        <div class="card-header">
          <h3>換班申請審核清單</h3>
          <span class="badge badge-primary">共 {{ swaps().length }} 筆</span>
        </div>

        <div class="table-responsive">
          <table class="data-table">
            <thead>
              <tr>
                <th>編號</th>
                <th>申請人與原班別</th>
                <th>調換對象與班別</th>
                <th>事由說明</th>
                <th>流程狀態</th>
                <th>法規合規檢核</th>
                <th>操作</th>
              </tr>
            </thead>
            <tbody>
              <tr *ngFor="let s of swaps()">
                <td>#{{ s.swap_id }}</td>

                <!-- Requester Info -->
                <td>
                  <div class="nurse-swap-info">
                    <strong>{{ getNurseName(s.requester_id) }}</strong>
                    <span class="date-badge">{{ s.requester_date }}</span>
                    <span class="shift-badge" [style.background]="getShiftColor(s.schedule_id, s.requester_id, s.requester_date)">
                      {{ getShiftCode(s.schedule_id, s.requester_id, s.requester_date) }}
                    </span>
                  </div>
                </td>

                <!-- Target Info -->
                <td>
                  <div class="nurse-swap-info">
                    <strong>{{ getNurseName(s.target_id) }}</strong>
                    <span class="date-badge">{{ s.target_date }}</span>
                    <span class="shift-badge" [style.background]="getShiftColor(s.schedule_id, s.target_id, s.target_date)">
                      {{ getShiftCode(s.schedule_id, s.target_id, s.target_date) }}
                    </span>
                  </div>
                </td>

                <td>
                  <div class="reason-text">{{ s.reason }}</div>
                </td>

                <!-- Status Badge -->
                <td>
                  <span class="badge" [ngClass]="getStatusBadge(s.status)">
                    {{ getStatusLabel(s.status) }}
                  </span>
                </td>

                <!-- Legal Compliance Check Preview (FR-40) -->
                <td>
                  <ng-container *ngIf="s.status === 'G' || s.status === 'P'">
                    <span
                      class="badge"
                      [ngClass]="checkSwapCompliance(s).isLegal ? 'badge-success' : 'badge-danger'"
                      [title]="checkSwapCompliance(s).message"
                    >
                      {{ checkSwapCompliance(s).isLegal ? '合規通過' : '違法警示' }}
                    </span>
                    <div *ngIf="!checkSwapCompliance(s).isLegal" class="law-alert-text">
                      {{ checkSwapCompliance(s).message }}
                    </div>
                  </ng-container>
                  <span *ngIf="s.status === 'A'" class="badge badge-success">對調已生效</span>
                  <span *ngIf="s.status === 'R'" class="badge badge-neutral">已拒絕</span>
                </td>

                <!-- Action Buttons -->
                <td>
                  <!-- Target nurse can Agree or Reject if status === 'P' -->
                  <div class="action-btn-group" *ngIf="s.status === 'P' && isTargetNurse(s)">
                    <button class="btn btn-primary btn-sm" (click)="onTargetConsent(s, true)">同意</button>
                    <button class="btn btn-secondary btn-sm" (click)="onTargetConsent(s, false)">拒絕</button>
                  </div>

                  <!-- Head nurse or Admin can Approve if status === 'G' -->
                  <div class="action-btn-group" *ngIf="s.status === 'G' && canHeadNurseApprove()">
                    <button
                      class="btn btn-success btn-sm"
                      (click)="onApproveSwap(s)"
                      [disabled]="!checkSwapCompliance(s).isLegal"
                      [title]="checkSwapCompliance(s).isLegal ? '核准並對調班表' : '換班違反勞基法，依法不得核准 (FR-40)'"
                    >
                      核准對調
                    </button>
                    <button class="btn btn-danger btn-sm" (click)="onRejectSwap(s)">駁回</button>
                  </div>

                  <!-- Requester can cancel pending -->
                  <div *ngIf="s.status === 'P' && isRequester(s)">
                    <button class="btn btn-secondary btn-sm" (click)="onCancelSwap(s)">取消申請</button>
                  </div>
                </td>
              </tr>

              <tr *ngIf="swaps().length === 0">
                <td colspan="7" style="text-align: center; color: #94a3b8; padding: 30px;">
                  目前無換班申請紀錄
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .nurse-swap-info {
      display: flex;
      align-items: center;
      gap: 6px;
      font-size: 0.85rem;

      .date-badge {
        font-size: 0.75rem;
        background: #f1f5f9;
        padding: 2px 6px;
        border-radius: 4px;
        color: #475569;
      }
    }

    .reason-text {
      max-width: 240px;
      font-size: 0.82rem;
      color: #334155;
    }

    .action-btn-group {
      display: flex;
      gap: 6px;
    }

    .law-alert-text {
      font-size: 0.72rem;
      color: var(--danger);
      margin-top: 3px;
      max-width: 180px;
    }
  `],
})
export class SwapRequestsComponent {
  auth = inject(AuthService);
  private dataService = inject(DataService);
  private ruleChecker = inject(RuleCheckerService);

  swaps = computed(() => this.dataService.swapRequests());

  getNurseName(nurseId: number): string {
    const n = this.dataService.nurses().find((nurse) => nurse.nurse_id === nurseId);
    return n ? n.name : `護理師 #${nurseId}`;
  }

  getShiftCode(scheduleId: number, nurseId: number, dateStr: string): string {
    const cell = this.dataService
      .scheduleCells()
      .find((c) => c.schedule_id === scheduleId && c.nurse_id === nurseId && c.work_date === dateStr);
    if (!cell?.shift_id) return '休';
    const s = this.dataService.shifts().find((sh) => sh.shift_id === cell.shift_id);
    return s?.code || '班';
  }

  getShiftColor(scheduleId: number, nurseId: number, dateStr: string): string {
    const cell = this.dataService
      .scheduleCells()
      .find((c) => c.schedule_id === scheduleId && c.nurse_id === nurseId && c.work_date === dateStr);
    if (!cell?.shift_id) return '#94a3b8';
    const s = this.dataService.shifts().find((sh) => sh.shift_id === cell.shift_id);
    return s?.color || '#0284c7';
  }

  getStatusBadge(status: SwapStatus): string {
    switch (status) {
      case 'P': return 'badge-warning';
      case 'G': return 'badge-purple';
      case 'A': return 'badge-success';
      case 'R': return 'badge-danger';
      case 'C': return 'badge-neutral';
    }
  }

  getStatusLabel(status: SwapStatus): string {
    switch (status) {
      case 'P': return '待對方同意';
      case 'G': return '對方已同意 (待護理長核准)';
      case 'A': return '已核准生效';
      case 'R': return '已拒絕/駁回';
      case 'C': return '已取消';
    }
  }

  isTargetNurse(s: SwapRequest): boolean {
    const user = this.auth.currentUser();
    return user?.nurse_id === s.target_id;
  }

  isRequester(s: SwapRequest): boolean {
    const user = this.auth.currentUser();
    return user?.nurse_id === s.requester_id;
  }

  canHeadNurseApprove(): boolean {
    return this.auth.isAdmin() || this.auth.isHeadNurse();
  }

  /**
   * Checks if swapping would violate any hard labor laws (FR-40)
   */
  checkSwapCompliance(s: SwapRequest): { isLegal: boolean; message: string } {
    const rNurse = this.dataService.nurses().find((n) => n.nurse_id === s.requester_id);
    const tNurse = this.dataService.nurses().find((n) => n.nurse_id === s.target_id);

    // Check pregnancy protection night work restriction
    const rProtects = this.dataService.nurseProtections().filter((p) => p.nurse_id === s.requester_id);
    const tProtects = this.dataService.nurseProtections().filter((p) => p.nurse_id === s.target_id);

    const rCell = this.dataService.scheduleCells().find(
      (c) => c.schedule_id === s.schedule_id && c.nurse_id === s.requester_id && c.work_date === s.requester_date
    );
    const tCell = this.dataService.scheduleCells().find(
      (c) => c.schedule_id === s.schedule_id && c.nurse_id === s.target_id && c.work_date === s.target_date
    );

    const shifts = this.dataService.shifts();
    const rShift = rCell?.shift_id ? shifts.find((sh) => sh.shift_id === rCell.shift_id) : null;
    const tShift = tCell?.shift_id ? shifts.find((sh) => sh.shift_id === tCell.shift_id) : null;

    // If tNurse gets rShift and rShift is night:
    if (rShift && this.ruleChecker.isNightWindowShift(rShift)) {
      if (!tNurse?.can_night) {
        return { isLegal: false, message: `${tNurse?.name} 限制不可值夜班 (勞基法 §49)` };
      }
      const isProtected = tProtects.some(
        (p) => (p.protection_type === 'P' || p.protection_type === 'B') &&
               s.requester_date >= p.start_date && s.requester_date <= p.end_date
      );
      if (isProtected) {
        return { isLegal: false, message: `${tNurse?.name} 妊娠/哺乳保護期間不得排夜間工作 (勞基法 §49)` };
      }
    }

    // If rNurse gets tShift and tShift is night:
    if (tShift && this.ruleChecker.isNightWindowShift(tShift)) {
      if (!rNurse?.can_night) {
        return { isLegal: false, message: `${rNurse?.name} 限制不可值夜班 (勞基法 §49)` };
      }
      const isProtected = rProtects.some(
        (p) => (p.protection_type === 'P' || p.protection_type === 'B') &&
               s.target_date >= p.start_date && s.target_date <= p.end_date
      );
      if (isProtected) {
        return { isLegal: false, message: `${rNurse?.name} 妊娠/哺乳保護期間不得排夜間工作 (勞基法 §49)` };
      }
    }

    return { isLegal: true, message: '合規無虞' };
  }

  onTargetConsent(s: SwapRequest, agreed: boolean): void {
    const updated: SwapRequest = {
      ...s,
      status: agreed ? 'G' : 'R',
    };
    this.dataService.updateSwapRequest(updated);
  }

  onApproveSwap(s: SwapRequest): void {
    const compliance = this.checkSwapCompliance(s);
    if (!compliance.isLegal) {
      alert(`違規警示：${compliance.message}。依法不得核准！(FR-40)`);
      return;
    }

    // Atomic Swap Cells Transaction (FR-29)
    const cells = [...this.dataService.scheduleCells()];
    const rCell = cells.find(
      (c) => c.schedule_id === s.schedule_id && c.nurse_id === s.requester_id && c.work_date === s.requester_date
    );
    const tCell = cells.find(
      (c) => c.schedule_id === s.schedule_id && c.nurse_id === s.target_id && c.work_date === s.target_date
    );

    if (rCell && tCell) {
      const tempShift = rCell.shift_id;
      const tempOff = rCell.off_type;
      rCell.shift_id = tCell.shift_id;
      rCell.off_type = tCell.off_type;
      tCell.shift_id = tempShift;
      tCell.off_type = tempOff;

      this.dataService.saveScheduleCells(cells);
    }

    const updated: SwapRequest = {
      ...s,
      status: 'A',
      approved_by: this.auth.currentUser()?.user_id || 1,
      approved_at: new Date().toISOString(),
    };
    this.dataService.updateSwapRequest(updated);
    alert('換班申請已核准！雙方班表已自動對調完成。');
  }

  onRejectSwap(s: SwapRequest): void {
    const updated: SwapRequest = { ...s, status: 'R' };
    this.dataService.updateSwapRequest(updated);
  }

  onCancelSwap(s: SwapRequest): void {
    const updated: SwapRequest = { ...s, status: 'C' };
    this.dataService.updateSwapRequest(updated);
  }
}
