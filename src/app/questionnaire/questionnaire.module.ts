import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';

import { QuestionnaireRoutingModule } from './questionnaire-routing.module';
import { QuestionnaireListViewComponent } from './questionnaire-list-view/questionnaire-list-view.component';
import { QuestionnaireDetailViewComponent } from './questionnaire-detail-view/questionnaire-detail-view.component';

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
import { NzDrawerModule } from 'ng-zorro-antd/drawer';
import { DragDropModule } from '@angular/cdk/drag-drop';
import { QuillModule } from 'ngx-quill';
import { NzTagModule } from 'ng-zorro-antd/tag';
import { NzAlertModule } from 'ng-zorro-antd/alert';
import { PatientQuestionnaireViewComponent } from './patient-questionnaire-view/patient-questionnaire-view.component';
import { NzCardModule } from 'ng-zorro-antd/card';
import { PatientQuestionnaireComponent } from './patient-questionnaire/patient-questionnaire.component';
import { MyQuestionnairesComponent } from './my-questionnaires/my-questionnaires.component';
import { NzUploadModule } from 'ng-zorro-antd/upload';
import { NzProgressModule } from 'ng-zorro-antd/progress';
import { SignaturePadComponent } from 'app/shared/signature-pad/signature-pad.component';

@NgModule({
  declarations: [
    QuestionnaireListViewComponent,
    QuestionnaireDetailViewComponent,
    PatientQuestionnaireViewComponent,
    PatientQuestionnaireComponent,
    MyQuestionnairesComponent
  ],
  imports: [
    CommonModule,
    QuestionnaireRoutingModule,
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
    NzDrawerModule,
    NzCardModule,
    DragDropModule,
    NzTagModule,
    NzAlertModule,
    QuillModule.forRoot(),
    PipeModule,
    NzUploadModule,
    NzProgressModule,
    SharedModule,
    SignaturePadComponent,
  ],
  exports:[
    PatientQuestionnaireViewComponent
  ]
})
export class QuestionnaireModule { }
