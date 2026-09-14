import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { GlobalAdminDashboardComponent } from './global-admin-dashboard/global-admin-dashboard.component';
import { PatientDashboardComponent } from './patient-dashboard/patient-dashboard.component';
import { FacilityAdminDashboardComponent } from './facility-admin-dashboard/facility-admin-dashboard.component';
import { ProviderDashboardComponent } from './provider-dashboard/provider-dashboard.component';
import { PermissionGuard } from 'app/shared/permission/permission.guard';

const routes: Routes = [
  {
    path: 'admin',
    component: GlobalAdminDashboardComponent,
    canActivate: [PermissionGuard],
    data: {
      permissions: ['dashboard_admin'],
      title: 'Dashboard'
    }
  },
  {
    path: 'clinic',
    component: FacilityAdminDashboardComponent,
    canActivate: [PermissionGuard],
    data: {
      permissions: ['dashboard_clinic'],
      title: 'Dashboard'
    }
  },
  {
    path: 'provider',
    component: ProviderDashboardComponent,
    canActivate: [PermissionGuard],
    data: {
      permissions: ['dashboard_provider'],
      title: 'Dashboard'
    }
  },
  {
    path: 'patient',
    component: PatientDashboardComponent,
    canActivate: [PermissionGuard],
    data: {
      permissions: ['dashboard_patient'],
      title: 'Dashboard'
    }
  },
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule]
})
export class DashboardRoutingModule { }
