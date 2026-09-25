import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';

import { PatientRoutingModule } from './patient-routing.module';
import { PatientListViewComponent } from './patient-list-view/patient-list-view.component';
import { PatientDetailViewComponent } from './patient-detail-view/patient-detail-view.component';

import { PipeModule } from 'app/shared/pipes/pipe.module';
import { SharedModule } from 'app/shared/shared.module';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzDatePickerModule } from 'ng-zorro-antd/date-picker';
import { NzDropDownModule } from 'ng-zorro-antd/dropdown';
import { NzModalModule } from 'ng-zorro-antd/modal';
import { NzSelectModule } from 'ng-zorro-antd/select';
import { NzSwitchModule } from 'ng-zorro-antd/switch';
import { NzTableModule } from 'ng-zorro-antd/table';
import { NzTabsModule } from 'ng-zorro-antd/tabs';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { NzRadioModule } from 'ng-zorro-antd/radio';
import { NzCheckboxModule } from 'ng-zorro-antd/checkbox';
import { NzPopoverModule } from 'ng-zorro-antd/popover';
import { NzCollapseModule } from 'ng-zorro-antd/collapse';
import { ChatComponent } from 'app/chat/chat.component';
import { PatientQuestionnaireAssignmentsComponent } from 'app/questionnaire/patient-questionnaire-assignments/patient-questionnaire-assignments.component';

@NgModule({
  declarations: [
    PatientListViewComponent,
    PatientDetailViewComponent
  ],
  imports: [
    CommonModule,
    PatientRoutingModule,
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
    ChatComponent,
    PatientQuestionnaireAssignmentsComponent
  ]
})
export class PatientModule { }
