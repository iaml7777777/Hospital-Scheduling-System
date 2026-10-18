import { Injectable, inject, signal, computed } from '@angular/core';
import { Router } from '@angular/router';
import { DataService } from './data.service';
import { UserAccount, UserRole } from '../models/schedule.models';

const SESSION_KEY = 'hospital_sched_current_user';

@Injectable({
  providedIn: 'root',
})
export class AuthService {
  private dataService = inject(DataService);
  private router = inject(Router);

  readonly currentUser = signal<UserAccount | null>(null);

  readonly isLoggedIn = computed(() => this.currentUser() !== null);
  readonly isAdmin = computed(() => this.currentUser()?.role === 'A');
  readonly isHeadNurse = computed(() => this.currentUser()?.role === 'H');
  readonly isStaffNurse = computed(() => this.currentUser()?.role === 'N');
  readonly userUnitId = computed(() => this.currentUser()?.unit_id ?? null);
  readonly userNurseId = computed(() => this.currentUser()?.nurse_id ?? null);

  constructor() {
    this.restoreSession();
  }

  private restoreSession(): void {
    if (typeof window !== 'undefined' && typeof localStorage !== 'undefined') {
      try {
        const saved = localStorage.getItem(SESSION_KEY);
        if (saved) {
          const user: UserAccount = JSON.parse(saved);
          // Verify user still exists in accounts
          const live = this.dataService.userAccounts().find((u) => u.user_id === user.user_id);
          if (live && !live.is_locked) {
            this.currentUser.set(live);
            return;
          }
        }
      } catch (e) {
        console.error('Failed to restore session', e);
      }
    }
    // Default session for smooth demo: auto-login as user1 (Head Nurse)
    const defaultUser = this.dataService.userAccounts().find((u) => u.login === 'user1') || null;
    this.currentUser.set(defaultUser);
  }

  login(username: string, password: string): { success: boolean; message: string; mustChangePw?: boolean } {
    const users = this.dataService.userAccounts();
    const user = users.find((u) => u.login.toLowerCase() === username.trim().toLowerCase());

    if (!user) {
      return { success: false, message: '帳號或密碼錯誤' };
    }

    if (user.is_locked) {
      return { success: false, message: '此帳號因密碼錯誤次數過多已鎖定，請聯繫系統管理員解鎖' };
    }

    if (user.password_hash !== password) {
      const updatedUser = {
        ...user,
        failed_count: user.failed_count + 1,
        is_locked: user.failed_count + 1 >= 5,
      };
      this.dataService.saveUserAccount(updatedUser);
      if (updatedUser.is_locked) {
        return { success: false, message: '密碼錯誤達 5 次，帳號已被鎖定！' };
      }
      return { success: false, message: `密碼錯誤 (剩餘嘗試次數: ${5 - updatedUser.failed_count})` };
    }

    // Reset failed count on successful login
    const loggedInUser: UserAccount = {
      ...user,
      failed_count: 0,
    };
    this.dataService.saveUserAccount(loggedInUser);
    this.currentUser.set(loggedInUser);
    this.persistSession(loggedInUser);

    if (loggedInUser.must_change_pw) {
      return { success: true, message: '登入成功，請立即變更初始密碼', mustChangePw: true };
    }

    return { success: true, message: '登入成功' };
  }

  changePassword(oldPw: string, newPw: string): { success: boolean; message: string } {
    const user = this.currentUser();
    if (!user) return { success: false, message: '尚未登入' };

    if (user.password_hash !== oldPw) {
      return { success: false, message: '目前密碼不正確' };
    }

    if (newPw.length < 6) {
      return { success: false, message: '新密碼長度至少需 6 個字元' };
    }

    if (newPw === oldPw) {
      return { success: false, message: '新密碼不可與目前密碼相同' };
    }

    const updated: UserAccount = {
      ...user,
      password_hash: newPw,
      must_change_pw: false,
    };
    this.dataService.saveUserAccount(updated);
    this.currentUser.set(updated);
    this.persistSession(updated);
    return { success: true, message: '密碼變更成功！' };
  }

  logout(): void {
    this.currentUser.set(null);
    if (typeof localStorage !== 'undefined') {
      localStorage.removeItem(SESSION_KEY);
    }
    this.router.navigate(['/login']);
  }

  // Demo helper: quick switch between accounts
  switchAccount(login: string): void {
    const user = this.dataService.userAccounts().find((u) => u.login === login);
    if (user) {
      this.currentUser.set(user);
      this.persistSession(user);
      if (user.role === 'N') {
        this.router.navigate(['/my-schedule']);
      } else {
        this.router.navigate(['/schedule']);
      }
    }
  }

  canAccessUnit(unitId: number): boolean {
    const user = this.currentUser();
    if (!user) return false;
    if (user.role === 'A') return true;
    return user.unit_id === unitId;
  }

  private persistSession(user: UserAccount): void {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(SESSION_KEY, JSON.stringify(user));
    }
  }
}
