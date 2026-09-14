import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { BillingViewComponent } from './billing-view/billing-view.component';
import { InvoicesViewComponent } from './invoices-view/invoices-view.component';
import { InvoiceDetailComponent } from './invoice-detail/invoice-detail.component';
import { PaymentMethodsComponent } from './payment-methods/payment-methods.component';
import { SubscriptionPlanViewComponent } from './subscription-plan-view/subscription-plan-view.component';
import { PermissionGuard } from 'app/shared/permission/permission.guard';
import { SubscriptionPlanDetailComponent } from './subscription-plan-detail/subscription-plan-detail.component';
import {GaClinicInvoiceBillListComponent} from "./ga-clinic-invoice-bill-list/ga-clinic-invoice-bill-list.component";
import {
  GaClinicInvoiceBillDetailsComponent
} from "./ga-clinic-invoice-bill-details/ga-clinic-invoice-bill-details.component";
import {GaClinicPaymentListComponent} from "./ga-clinic-payment-list/ga-clinic-payment-list.component";
import {ClinicPatientInvoiceListComponent} from "./clinic-patient-invoice-list/clinic-patient-invoice-list.component";
import {
  ClinicPatientInvoiceDetailComponent
} from "./clinic-patient-invoice-detail/clinic-patient-invoice-detail.component";
import {GaPaymentDashboardComponent} from "./ga-payment-dashboard/ga-payment-dashboard.component";
import {ManualPatientBillComponent} from "./manual-patient-bill/manual-patient-bill.component";
import { ManualClinicBillComponent } from './manual-clinic-bill/manual-clinic-bill.component';
import { ClinicManualInvoiceViewComponent } from './clinic-manual-invoice-view/clinic-manual-invoice-view.component';

const routes: Routes = [
  {
    path: 'view',
    component: BillingViewComponent,
    data : {
      title : 'Plans & History'
    }
  },
  {
    path: 'invoices',
    component: InvoicesViewComponent,
    data: {
      title: 'Invoices'
    }
  },
  {
    path: 'invoice/detail/:id',
    component: InvoiceDetailComponent,
    data : {
      title : 'Loading'
    }
  },
  {
    path: 'clinicInvoices',
    component: ClinicPatientInvoiceListComponent,
    data : {
      title : 'Clinic Invoices'
    }
  },
  {
    path: 'patientBills',
    component: ClinicPatientInvoiceListComponent,
    data : {
      title : 'Patient Bills'
    }
  },
  {
    path: 'clinicInvoices/detail/:id',
    component: ClinicPatientInvoiceDetailComponent,
    data : {
      title : 'Clinic Invoices'
    }
  },
  {
    path: 'manualPatientBills',
    component: ManualPatientBillComponent,
    data : {
      title : 'Create Bill'
    }
  },
  {
    path: 'manualClinicBills',
    component: ManualClinicBillComponent,
    data : {
      title : 'Create Invoice'
    }
  },
  {
    path: 'clinicBills',
    component: GaClinicInvoiceBillListComponent,
    data : {
      title : 'Clinic Bills'
    }
  },
  {
    path: 'clinicBills/detail/:id',
    component: GaClinicInvoiceBillDetailsComponent,
    data : {
      title : 'Loading'
    }
  },
  {
    path: 'clinicBills/manual/:id',
    component: ClinicManualInvoiceViewComponent,
    data : {
      title : 'Loading'
    }
  },
  {
    path: 'payments',
    component: GaClinicPaymentListComponent,
    data : {
      title : 'Payments'
    }
  },
  {
    path: 'subscription/detail/:id',
    component: SubscriptionPlanDetailComponent,
    data : {
      title : 'Loading'
    }
  },
  {
    path: 'payment-methods',
    component: PaymentMethodsComponent,
    data: {
      title: 'Payment Methods'
    }
  },
  {
    path: 'gaPaymentDashboard',
    component: GaPaymentDashboardComponent,
    data:{
      title: 'Stripe Dashboard'
    }
  },
  {
    path: 'subscription-plan',
    component: SubscriptionPlanViewComponent,
    canActivate: [PermissionGuard],
    data: {
      permissions: ['subscription_plan_view', 'subscription_plan_add', 'subscription_plan_edit', 'subscription_plan_delete'],
      title: 'Subscription Plan'
    }
  },
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule],
})
export class BillingRoutingModule {}
