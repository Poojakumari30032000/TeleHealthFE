import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { TreatmentListViewComponent } from './treatment-list-view/treatment-list-view.component';
import { TreatmentDetailViewComponent } from './treatment-detail-view/treatment-detail-view.component';
import { PermissionGuard } from 'app/shared/permission/permission.guard';

const routes: Routes = [
  {
    path: '',
    redirectTo: 'view',
    pathMatch : 'full'
  },
  {
    path: 'view',
    component : TreatmentListViewComponent,
    canActivate: [PermissionGuard],
    data: { permissions: ['treatment_view'],
      title : 'Treatments'
     }
  },
  {
    path: 'detail/:id',
    component : TreatmentDetailViewComponent,
    canActivate: [PermissionGuard],
    data: { permissions: ['treatment_view'],
      title: 'Loading'
     }
  }
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule]
})
export class TreatmentRoutingModule { }
