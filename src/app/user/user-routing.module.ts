import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { UserListViewComponent } from './user-list-view/user-list-view.component';
import { UserDetailViewComponent } from './user-detail-view/user-detail-view.component';

const routes: Routes = [
  {
      path: '',
      redirectTo: 'view',
      pathMatch : 'full'
  },
  {
    path: 'view',
    component : UserListViewComponent,
    data : {
      title : 'Loading'
    }
  },
  {
    path: 'detail/:id',
    component : UserDetailViewComponent,
    data : {
      title: 'Loading'
    }
  }
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule]
})
export class UserRoutingModule { }
