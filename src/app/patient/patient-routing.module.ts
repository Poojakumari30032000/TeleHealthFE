import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { PatientListViewComponent } from './patient-list-view/patient-list-view.component';
import { PatientDetailViewComponent } from './patient-detail-view/patient-detail-view.component';
import { PermissionGuard } from 'app/shared/permission/permission.guard';

const routes: Routes = [
  {
    path: '',
    redirectTo: 'view',
    pathMatch : 'full'
  },
  {
    path: 'view',
    component : PatientListViewComponent,
    canActivate: [PermissionGuard],
    data: { permissions: ['patient_view', 'patient_add', 'patient_edit', 'patient_delete'],
      title: 'Patients'
     }
  },
  {
    path: 'detail/:id',
    component : PatientDetailViewComponent,
    canActivate: [PermissionGuard],
    data: {
      permissions: ['patient_view'],
      title: 'Loading'
    }
  },
  {
    path: 'detail',
    component : PatientDetailViewComponent,
    canActivate: [PermissionGuard],
    data: {
      permissions: ['pt_view'],
      title: 'Loading'
    }
  }
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule]
})
export class PatientRoutingModule { }
