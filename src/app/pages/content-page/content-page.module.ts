import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';

import { ContentPageRoutingModule } from './content-page-routing.module';
import { LoginComponent } from './login/login.component';
import { ForgotPasswordComponent } from './forgot-password/forgot-password.component';
import { DynamicIntakeFormComponent } from './dynamic-intake-form/dynamic-intake-form.component';
import { ErrorPageComponent } from './error-page/error-page.component';
import { DisqualifyComponent } from './disqualify/disqualify.component';
import { VisitComponent } from './visit/visit.component';
import { VisitSubscriptionComponent } from './visit/visit-subscription/visit-subscription.component';
import { VisitPaymentComponent } from './visit/visit-payment/visit-payment.component';
import { ThankyouComponent } from './thankyou/thankyou.component';
import { VisitProviderComponent } from './visit/visit-provider/visit-provider.component';

import { ReactiveFormsModule , FormsModule } from '@angular/forms';
import { NzLayoutModule } from 'ng-zorro-antd/layout';
import { NzStepsModule } from 'ng-zorro-antd/steps';
import { NzCardModule } from 'ng-zorro-antd/card';
import { NzGridModule } from 'ng-zorro-antd/grid';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzRadioModule } from 'ng-zorro-antd/radio';
import { NzModalModule } from 'ng-zorro-antd/modal';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzDatePickerModule } from 'ng-zorro-antd/date-picker';
import { NzCheckboxModule } from 'ng-zorro-antd/checkbox';
import { NzUploadModule } from 'ng-zorro-antd/upload';
import { NzSelectModule } from 'ng-zorro-antd/select';
import { NzSwitchModule } from 'ng-zorro-antd/switch';
import { NzMessageModule } from 'ng-zorro-antd/message';
import { NzProgressModule } from 'ng-zorro-antd/progress';
import { NzToolTipModule } from 'ng-zorro-antd/tooltip';
import { NzDrawerModule } from 'ng-zorro-antd/drawer';
import { NzAlertModule } from 'ng-zorro-antd/alert';
import { NzAvatarModule } from 'ng-zorro-antd/avatar';
import { NzDropDownModule } from 'ng-zorro-antd/dropdown';
import { NzMenuModule } from 'ng-zorro-antd/menu';
import { NzSpinModule } from 'ng-zorro-antd/spin';

import { SharedModule } from '../../shared/shared.module';
import { NzIconModule } from 'ng-zorro-antd/icon';
import { ResetPasswordComponent } from './reset-password/reset-password.component';
import { GetStartedFormComponent } from './get-started-form/get-started-form.component';
import { NzFormModule } from 'ng-zorro-antd/form';
import { CategoriesIframeComponent } from './categories-iframe/categories-iframe.component';
import { PackagesByCategoriesComponent } from './packages-by-categories/packages-by-categories.component';
import { NgxStripeModule } from 'ngx-stripe';
import { SignaturePadComponent } from 'app/shared/signature-pad/signature-pad.component';
import { ClinicSignupExternalComponent } from './clinic-signup-external/clinic-signup-external.component';

@NgModule({
  declarations: [
    LoginComponent,
    ForgotPasswordComponent,
    DynamicIntakeFormComponent,
    ErrorPageComponent,
    DisqualifyComponent,
    VisitComponent,
    ThankyouComponent,
    VisitSubscriptionComponent,
    VisitPaymentComponent,
    VisitProviderComponent,
    ResetPasswordComponent,
    GetStartedFormComponent,
    CategoriesIframeComponent,
    PackagesByCategoriesComponent,
    ClinicSignupExternalComponent
  ],
  imports: [
    CommonModule,
    ContentPageRoutingModule,
    ReactiveFormsModule,
    FormsModule,
    NzLayoutModule,
    NzStepsModule,
    NzCardModule,
    NzGridModule,
    NzButtonModule,
    NzRadioModule,
    NzModalModule,
    NzInputModule,
    NzDatePickerModule,
    NzCheckboxModule,
    NzUploadModule,
    NzSelectModule,
    NzSwitchModule,
    NzMessageModule,
    NzProgressModule,
    NzToolTipModule,
    NzDrawerModule,
    NzAlertModule,
    NzAvatarModule,
    NzDropDownModule,
    NzMenuModule,
    NzIconModule,
    NzSpinModule,
    NzFormModule,
    NzIconModule,
    NgxStripeModule,

    SharedModule,
    SignaturePadComponent,
  ],exports:[
    DynamicIntakeFormComponent
  ]
})
export class ContentPageModule { }
