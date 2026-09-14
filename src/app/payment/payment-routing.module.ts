import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { PaymentListViewComponent } from './payment-list-view/payment-list-view.component';
import { PaymentRefundDetailViewComponent } from './payment-refund-detail-view/payment-refund-detail-view.component';

const routes: Routes = [
  {
    path: '',
    redirectTo: 'view',
    pathMatch : 'full'
  },
  {
    path: 'view',
    component : PaymentListViewComponent,
    data : {
      title : 'Payments'
    }
  },
  {
    path: ':id/refund',
    component : PaymentRefundDetailViewComponent
  }
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule]
})
export class PaymentRoutingModule { }
