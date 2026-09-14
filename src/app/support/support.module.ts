import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';

import { SupportRoutingModule } from './support-routing.module';
import { SupportListViewComponent } from './support-list-view/support-list-view.component';
import { SupportDetailViewComponent } from './support-detail-view/support-detail-view.component';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { PipeModule } from 'app/shared/pipes/pipe.module';
import { SharedModule } from 'app/shared/shared.module';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzCheckboxModule } from 'ng-zorro-antd/checkbox';
import { NzDropDownModule } from 'ng-zorro-antd/dropdown';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzModalModule } from 'ng-zorro-antd/modal';
import { NzPopoverModule } from 'ng-zorro-antd/popover';
import { NzSelectModule } from 'ng-zorro-antd/select';
import { NzUploadModule } from 'ng-zorro-antd/upload';
import { QuillModule } from 'ngx-quill';

@NgModule({
  declarations: [
    SupportListViewComponent,
    SupportDetailViewComponent
  ],
  imports: [
    CommonModule,
    SupportRoutingModule,
    FormsModule,
    ReactiveFormsModule,
    NzInputModule,
    NzDropDownModule,
    NzSelectModule,
    NzModalModule,
    NzCheckboxModule,
    NzPopoverModule,
    NzButtonModule,
    NzUploadModule,
    QuillModule.forRoot(),
    PipeModule,
    SharedModule
  ]
})
export class SupportModule { }
