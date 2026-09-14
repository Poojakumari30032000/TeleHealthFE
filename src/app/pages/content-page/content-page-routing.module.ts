import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';

import { LoginComponent } from './login/login.component';
import { ForgotPasswordComponent } from './forgot-password/forgot-password.component';
import { ErrorPageComponent } from './error-page/error-page.component';
import { DisqualifyComponent } from './disqualify/disqualify.component';
import { VisitComponent } from './visit/visit.component';
import { ThankyouComponent } from './thankyou/thankyou.component';
import { ResetPasswordComponent } from './reset-password/reset-password.component';
import { GetStartedFormComponent } from './get-started-form/get-started-form.component';
import { CategoriesIframeComponent } from './categories-iframe/categories-iframe.component';
import {PackagesByCategoriesComponent} from "./packages-by-categories/packages-by-categories.component";
import { ClinicSignupExternalComponent } from './clinic-signup-external/clinic-signup-external.component';

const routes: Routes = [
  {
    path: 'login',
    component: LoginComponent
  },
  {
    path: 'forget-password',
    component: ForgotPasswordComponent
  },
  {
    path: 'reset-password',
    component: ResetPasswordComponent
  },
  {
    path: ':facilityId/boarding',
    component: VisitComponent
  },
  {
    path: ':facilityId/boarding/:productName',
    component: VisitComponent
  },
  {
    path: 'disqualify',
    component: DisqualifyComponent
  },
  {
    path: 'thankyou',
    component: ThankyouComponent
  },
    {
    path: 'get-started/:clinicId',
    component: GetStartedFormComponent
  },
  {
    path: 'categoriesOffered/:clinicId',
    component: CategoriesIframeComponent
  },
  {
    path: 'packageByCategory/:clinicId/:categoryId',
    component: PackagesByCategoriesComponent
  },
  {
    path: 'get-started-by-package/:clinicId/:categoryId/:bundleId',
    component: PackagesByCategoriesComponent
  },
  {
    path: 'clinic-signup',
    component: ClinicSignupExternalComponent
  },
  {
    path: '**',
    component: ErrorPageComponent
  }
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule]
})
export class ContentPageRoutingModule { }
