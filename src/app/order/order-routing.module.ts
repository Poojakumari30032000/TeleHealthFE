import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { OrderListViewComponent } from './order-list-view/order-list-view.component';
import { OrderDetailViewComponent } from './order-detail-view/order-detail-view.component';
import { PermissionGuard } from 'app/shared/permission/permission.guard';

const routes: Routes = [
  {
    path: '',
    redirectTo: 'view',
    pathMatch : 'full'
  },
  {
    path: 'view',
    component : OrderListViewComponent,
    canActivate: [PermissionGuard],
    data: { permissions: ['order_view'],
      title : 'Orders'
     }
  },
  {
    path: 'detail/:id',
    component : OrderDetailViewComponent,
    canActivate: [PermissionGuard],
    data: { permissions: ['order_view'],
      title : 'Loading'
     }
  }
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule]
})
export class OrderRoutingModule { }
