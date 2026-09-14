import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { FacilityListViewComponent } from './facility-list-view/facility-list-view.component';
import { FacilityInfoViewComponent } from './facility-info-view/facility-info-view.component';
import {PermissionGuard} from "../shared/permission/permission.guard";

const routes: Routes = [
  {
    path: '',
    redirectTo: 'view',
    pathMatch : 'full'
  },
  {
    path: 'view',
    component : FacilityListViewComponent,
    data:{
      title: 'Clinics'
    }
  },
  {
    path: 'detail/:id',
    component : FacilityInfoViewComponent,
    data:{
      title: 'Loading'
    }
  },
  {
    path: 'info',
    component : FacilityInfoViewComponent,
    canActivate: [PermissionGuard],
    data:{
      permissions: ['f_view'],
      title: 'Loading'
    }
  }
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule]
})
export class FacilityRoutingModule { }
