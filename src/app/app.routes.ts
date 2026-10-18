import { Routes } from '@angular/router';
import { authGuard, adminGuard } from './guards/auth.guard';
import { LoginComponent } from './components/login/login.component';
import { OverviewComponent } from './components/overview/overview.component';
import { ScheduleViewComponent } from './components/schedule/schedule-view.component';
import { MyScheduleComponent } from './components/my-schedule/my-schedule.component';
import { LeaveRequestsComponent } from './components/leave-requests/leave-requests.component';
import { SwapRequestsComponent } from './components/swap-requests/swap-requests.component';
import { StatisticsComponent } from './components/statistics/statistics.component';
import { NurseListComponent } from './components/nurses/nurse-list.component';
import { UnitSettingsComponent } from './components/unit-settings/unit-settings.component';
import { SystemSettingsComponent } from './components/system-settings/system-settings.component';

export const routes: Routes = [
  { path: 'login', component: LoginComponent },
  { path: 'overview', component: OverviewComponent, canActivate: [authGuard] },
  { path: 'schedule', component: ScheduleViewComponent, canActivate: [authGuard] },
  { path: 'my-schedule', component: MyScheduleComponent, canActivate: [authGuard] },
  { path: 'leaves', component: LeaveRequestsComponent, canActivate: [authGuard] },
  { path: 'swaps', component: SwapRequestsComponent, canActivate: [authGuard] },
  { path: 'statistics', component: StatisticsComponent, canActivate: [authGuard] },
  { path: 'nurses', component: NurseListComponent, canActivate: [authGuard] },
  { path: 'units', component: UnitSettingsComponent, canActivate: [authGuard] },
  { path: 'settings', component: SystemSettingsComponent, canActivate: [authGuard, adminGuard] },
  { path: '', redirectTo: 'overview', pathMatch: 'full' },
  { path: '**', redirectTo: 'overview' },
];
