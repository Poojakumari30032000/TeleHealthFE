import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';

import { PrescriptionRoutingModule } from './prescription-routing.module';
import { OrderModule } from 'app/order/order.module';
import { PrescriptionListViewComponent } from './prescription-list-view/prescription-list-view.component';
import { PrescriptionDetailViewComponent } from './prescription-detail-view/prescription-detail-view.component';
import { PrescriptionAddEditViewComponent } from './prescription-add-edit-view/prescription-add-edit-view.component';

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
import { NzDrawerModule } from 'ng-zorro-antd/drawer';
import { NzCollapseModule } from 'ng-zorro-antd/collapse';
import { NzUploadModule } from 'ng-zorro-antd/upload';
import { NzImageModule } from 'ng-zorro-antd/image';
import { SOAPNotesComponent } from './soap-notes/soap-notes.component';
import {NzToolTipModule} from "ng-zorro-antd/tooltip";
import {NzIconModule} from "ng-zorro-antd/icon";

@NgModule({
  declarations: [
    PrescriptionListViewComponent,
    PrescriptionDetailViewComponent,
    PrescriptionAddEditViewComponent,
    SOAPNotesComponent
  ],
  imports: [
    CommonModule,
    PrescriptionRoutingModule,
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
    NzDrawerModule,
    PipeModule,
    SharedModule,
    NzUploadModule,
    NzModalModule,
    NzImageModule,
    NzToolTipModule,
    NzIconModule,
    NzCollapseModule,
    SharedModule,
    OrderModule
  ]
})
export class PrescriptionModule { }
