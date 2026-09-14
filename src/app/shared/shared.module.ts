import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { DynamicFormsComponent } from './dynamic-forms/dynamic-forms.component';
import { DynamicTableComponent } from './dynamic-table/dynamic-table.component';
import { CommanFormModalComponent } from './comman-form-modal/comman-form-modal.component';
import { UserAddEditModalComponent } from './user-add-edit-modal/user-add-edit-modal.component';
import { AvailabilityAddEditModelComponent } from './availability-add-edit-model/availability-add-edit-model.component';

import { PipeModule } from './pipes/pipe.module';
import { NzLayoutModule } from 'ng-zorro-antd/layout';
import { NzDropDownModule } from 'ng-zorro-antd/dropdown';
import { NzSelectModule } from 'ng-zorro-antd/select';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { NzMenuModule , MenuService } from 'ng-zorro-antd/menu';
import { RouterLink } from '@angular/router';
import { RouterLinkActive } from '@angular/router';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzListModule } from 'ng-zorro-antd/list';
import { NzBadgeModule } from 'ng-zorro-antd/badge';
import { NzDrawerModule } from 'ng-zorro-antd/drawer';
import { NzModalModule } from 'ng-zorro-antd/modal';
import { NzToolTipModule } from 'ng-zorro-antd/tooltip';
import { NzSwitchModule } from 'ng-zorro-antd/switch';

import { ValidationErrorsDirective } from './Validation/validation-errors.directive';
import { HasPermissionDirective } from './permission/has-permission.directive';

import { NzUploadModule } from 'ng-zorro-antd/upload';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzDatePickerModule } from 'ng-zorro-antd/date-picker';
import { NzRadioModule } from 'ng-zorro-antd/radio';
import { NzCheckboxModule } from 'ng-zorro-antd/checkbox';
import { NzTableModule } from 'ng-zorro-antd/table';
import { NzPopoverModule } from 'ng-zorro-antd/popover';

@NgModule({
  declarations: [
    ValidationErrorsDirective,
    HasPermissionDirective,
    DynamicFormsComponent,
    DynamicTableComponent,
    CommanFormModalComponent,
    UserAddEditModalComponent,
    AvailabilityAddEditModelComponent
  ],
  imports: [
    FormsModule,
    CommonModule,
    NzLayoutModule,
    NzMenuModule,
    NzDropDownModule,
    NzSelectModule,
    RouterLink,
    RouterLinkActive,
    NzInputModule,
    NzListModule,
    NzBadgeModule,
    NzDrawerModule,
    NzModalModule,
    NzToolTipModule,
    NzPopoverModule,
    NzSwitchModule,
    NzUploadModule,
    NzButtonModule,
    NzDatePickerModule,
    NzRadioModule,
    NzCheckboxModule,
    NzTableModule,
    FormsModule,
    PipeModule,
    ReactiveFormsModule
  ],
  exports:[
    ValidationErrorsDirective,
    HasPermissionDirective,
    DynamicFormsComponent,
    DynamicTableComponent,
    CommanFormModalComponent,
    UserAddEditModalComponent,
    AvailabilityAddEditModelComponent
  ],
  providers:[
    MenuService
  ]
})
export class SharedModule { }
