import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';

import { ProductRoutingModule } from './product-routing.module';
import { ProductListViewComponent } from './product-list-view/product-list-view.component';
import { ProductDetailViewComponent } from './product-detail-view/product-detail-view.component';
import { ProductBundleDetailViewComponent } from './product-bundle-detail-view/product-bundle-detail-view.component';
import { BundleCategoriesViewComponent } from './bundle-categories-view/bundle-categories-view.component';
import { ProductCategoriesListComponent } from './product-categories-list/product-categories-list.component';

import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { PipeModule } from 'app/shared/pipes/pipe.module';
import { SharedModule } from 'app/shared/shared.module';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzCheckboxModule } from 'ng-zorro-antd/checkbox';
import { NzDatePickerModule } from 'ng-zorro-antd/date-picker';
import { NzDropDownModule } from 'ng-zorro-antd/dropdown';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzModalModule } from 'ng-zorro-antd/modal';
import { NzPopoverModule } from 'ng-zorro-antd/popover';
import { NzRadioModule } from 'ng-zorro-antd/radio';
import { NzSelectModule } from 'ng-zorro-antd/select';
import { NzSwitchModule } from 'ng-zorro-antd/switch';
import { NzTableModule } from 'ng-zorro-antd/table';
import { NzTabsModule } from 'ng-zorro-antd/tabs';
import { NzToolTipModule } from 'ng-zorro-antd/tooltip';
import { NzUploadModule } from 'ng-zorro-antd/upload';
import { DrugsListViewComponent } from './drugs-list-view/drugs-list-view.component';
import { CouponListViewComponent } from './coupon-list-view/coupon-list-view.component';
import {NzInputNumberModule} from "ng-zorro-antd/input-number";
import {NzIconModule} from "ng-zorro-antd/icon";
import { ClinicPackageGAViewComponent } from './clinic-package-gaview/clinic-package-gaview.component';
import { ClinicDrugGAViewComponent } from './clinic-drug-gaview/clinic-drug-gaview.component';

@NgModule({
  declarations: [
    ProductListViewComponent,
    ProductDetailViewComponent,
    ProductBundleDetailViewComponent,
    BundleCategoriesViewComponent,
    ProductCategoriesListComponent,
    DrugsListViewComponent,
    CouponListViewComponent,
    ClinicPackageGAViewComponent,
    ClinicDrugGAViewComponent
  ],
  imports: [
    CommonModule,
    ProductRoutingModule,
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
    NzToolTipModule,
    NzUploadModule,
    PipeModule,
    NzIconModule,
    NzInputNumberModule,
    SharedModule
  ]
})
export class ProductModule { }
