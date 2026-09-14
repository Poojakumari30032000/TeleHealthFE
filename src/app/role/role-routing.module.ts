import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { RoleListViewComponent } from './role-list-view/role-list-view.component';
import { RoleDetailViewComponent } from './role-detail-view/role-detail-view.component';

const routes: Routes = [
  {
    path: '',
    redirectTo: 'view',
    pathMatch: 'full'
  },
  {
    path: 'view',
    component: RoleListViewComponent,
    data: {
      title: 'Roles & Permissions'
    }
  },
  {
    // 0 (or no id) opens the editor on a blank permission catalog for a new role -
    // the same dual behaviour the reference project's single endpoint had.
    path: 'detail/:id',
    component: RoleDetailViewComponent,
    data: {
      title: 'Role Permissions'
    }
  }
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule]
})
export class RoleRoutingModule { }
