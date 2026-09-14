import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';

import { TreatmentRoutingModule } from './treatment-routing.module';
import { TreatmentListViewComponent } from './treatment-list-view/treatment-list-view.component';
import { TreatmentDetailViewComponent } from './treatment-detail-view/treatment-detail-view.component';

import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { PipeModule } from 'app/shared/pipes/pipe.module';
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
import { SharedModule } from 'app/shared/shared.module';
import { NzCollapseModule } from 'ng-zorro-antd/collapse';
import {FullscriptPlatformComponent} from "../fullscript-platform/fullscript-platform.component";
import { ChatComponent } from 'app/chat/chat.component';

@NgModule({
  declarations: [TreatmentListViewComponent, TreatmentDetailViewComponent],
  imports: [
    CommonModule,
    TreatmentRoutingModule,
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
    NzCollapseModule,

    FullscriptPlatformComponent,
    ChatComponent,
  ],
})
export class TreatmentModule {}
