import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';

import { BillingRoutingModule } from './billing-routing.module';
import { InvoicesViewComponent } from './invoices-view/invoices-view.component';
import { InvoiceDetailComponent } from './invoice-detail/invoice-detail.component';
import { PaymentMethodsComponent } from './payment-methods/payment-methods.component';
import { SubscriptionPlanViewComponent } from './subscription-plan-view/subscription-plan-view.component';

import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzIconModule } from 'ng-zorro-antd/icon';
import { NzRadioModule } from 'ng-zorro-antd/radio';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { BillingViewComponent } from './billing-view/billing-view.component';
import { PipeModule } from 'app/shared/pipes/pipe.module';
import { SharedModule } from 'app/shared/shared.module';
import { NzCheckboxModule } from 'ng-zorro-antd/checkbox';
import { NzDatePickerModule } from 'ng-zorro-antd/date-picker';
import { NzDropDownModule } from 'ng-zorro-antd/dropdown';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzModalModule } from 'ng-zorro-antd/modal';
import { NzPopoverModule } from 'ng-zorro-antd/popover';
import { NzSelectModule } from 'ng-zorro-antd/select';
import { NzSwitchModule } from 'ng-zorro-antd/switch';
import { NzTableModule } from 'ng-zorro-antd/table';
import { NzTabsModule } from 'ng-zorro-antd/tabs';
import { SubscriptionPlanDetailComponent } from './subscription-plan-detail/subscription-plan-detail.component';
import { GaClinicInvoiceBillListComponent } from './ga-clinic-invoice-bill-list/ga-clinic-invoice-bill-list.component';
import { GaClinicInvoiceBillDetailsComponent } from './ga-clinic-invoice-bill-details/ga-clinic-invoice-bill-details.component';
import { GaClinicPaymentListComponent } from './ga-clinic-payment-list/ga-clinic-payment-list.component';
import { ClinicPatientInvoiceListComponent } from './clinic-patient-invoice-list/clinic-patient-invoice-list.component';
import { ClinicPatientInvoiceDetailComponent } from './clinic-patient-invoice-detail/clinic-patient-invoice-detail.component';
import { GaPaymentDashboardComponent } from './ga-payment-dashboard/ga-payment-dashboard.component';
import { NzProgressModule } from 'ng-zorro-antd/progress';
import { ManualPatientBillComponent } from './manual-patient-bill/manual-patient-bill.component';;
import { ManualClinicBillComponent } from './manual-clinic-bill/manual-clinic-bill.component';
import { ClinicManualInvoiceViewComponent } from './clinic-manual-invoice-view/clinic-manual-invoice-view.component';
import { NgxStripeModule } from 'ngx-stripe';

@NgModule({
  declarations: [
    BillingViewComponent,
    InvoicesViewComponent,
    InvoiceDetailComponent,
    PaymentMethodsComponent,
    SubscriptionPlanViewComponent,
    SubscriptionPlanDetailComponent,
    GaClinicInvoiceBillListComponent,
    GaClinicInvoiceBillDetailsComponent,
    GaClinicPaymentListComponent,
    ClinicPatientInvoiceListComponent,
    ClinicPatientInvoiceDetailComponent,
    GaPaymentDashboardComponent,
    ManualPatientBillComponent,
    ManualClinicBillComponent,
    ClinicManualInvoiceViewComponent,
  ],
  imports: [
    CommonModule,
    BillingRoutingModule,
    NzButtonModule,
    NzIconModule,
    NzRadioModule,
    FormsModule,
    ReactiveFormsModule,
    CommonModule,
    FormsModule,
    ReactiveFormsModule,
    NzInputModule,
    NzDropDownModule,
    NzSwitchModule,
    NzTableModule,
    NzDatePickerModule,
    NzButtonModule,
    NzTabsModule,
    NzSelectModule,
    NzModalModule,
    NzRadioModule,
    NzCheckboxModule,
    NzPopoverModule,
    PipeModule,
    SharedModule,
    NzProgressModule,
    NzDropDownModule,
    NgxStripeModule
  ],
})
export class BillingModule {}
