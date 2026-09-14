import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';

import { FacilityRoutingModule } from './facility-routing.module';
import { FacilityListViewComponent } from './facility-list-view/facility-list-view.component';
import { FacilityInfoViewComponent } from './facility-info-view/facility-info-view.component';
import { ClinicPendingDetailViewComponent } from './clinic-pending-detail-view/clinic-pending-detail-view.component';

import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { SharedModule } from '../shared/shared.module';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzDatePickerModule } from 'ng-zorro-antd/date-picker';
import { NzDropDownModule } from 'ng-zorro-antd/dropdown';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzModalModule } from 'ng-zorro-antd/modal';
import { NzSelectModule } from 'ng-zorro-antd/select';
import { NzSwitchModule } from 'ng-zorro-antd/switch';
import { NzTableModule } from 'ng-zorro-antd/table';
import { NzToolTipModule } from 'ng-zorro-antd/tooltip';
import { NzCollapseModule } from 'ng-zorro-antd/collapse';
import { NzTabsModule } from 'ng-zorro-antd/tabs';
import { NzSpinModule } from 'ng-zorro-antd/spin';

@NgModule({
  declarations: [
    FacilityListViewComponent,
    FacilityInfoViewComponent,
    ClinicPendingDetailViewComponent
  ],
  imports: [
    CommonModule,
    FormsModule,
    FacilityRoutingModule,
    NzDropDownModule,
    NzSwitchModule,
    NzTableModule,
    NzDatePickerModule,
    NzInputModule,
    NzButtonModule,
    NzSelectModule,
    NzModalModule,
    NzToolTipModule,
    NzCollapseModule,
    NzTabsModule,
    NzSpinModule,
    SharedModule,
    ReactiveFormsModule
  ]
})
export class FacilityModule { }
