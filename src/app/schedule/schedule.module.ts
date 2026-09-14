import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';

import { ScheduleRoutingModule } from './schedule-routing.module';
import { CalenderViewComponent } from './calender-view/calender-view.component';
import { AppointmentViewComponent } from './appointment-view/appointment-view.component';
import { AvailabilityListComponent } from './availability-list/availability-list.component';
import { AvailabiliySlotsListComponent } from './availabiliy-slots-list/availabiliy-slots-list.component';
import { AppointmentDetailViewComponent } from './appointment-detail-view/appointment-detail-view.component';
import { UpdateAvailabilitySlotComponent } from './models/update-availability-slot/update-availability-slot.component';
import { ManageHoursComponent } from './manage-hours/manage-hours.component';

import { FullCalendarModule } from '@fullcalendar/angular';
import { NzDropDownModule } from 'ng-zorro-antd/dropdown';
import { NzSwitchModule } from 'ng-zorro-antd/switch';
import { SharedModule } from '../shared/shared.module';
import { NzTableModule } from 'ng-zorro-antd/table';
import { NzDatePickerModule } from 'ng-zorro-antd/date-picker';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzTabsModule } from 'ng-zorro-antd/tabs';
import { NzSelectModule } from 'ng-zorro-antd/select';
import { NzModalModule } from 'ng-zorro-antd/modal';
import { NzPopoverModule } from 'ng-zorro-antd/popover';
import { NzDrawerModule } from 'ng-zorro-antd/drawer';
import { NzCheckboxModule } from 'ng-zorro-antd/checkbox';
import { NzRadioModule } from 'ng-zorro-antd/radio';
import { NzCollapseModule } from 'ng-zorro-antd/collapse';
import { NzSpinModule } from 'ng-zorro-antd/spin';
import { NzToolTipModule } from 'ng-zorro-antd/tooltip';

@NgModule({
  declarations: [
    CalenderViewComponent,
    AppointmentViewComponent,
    AvailabilityListComponent,
    AvailabiliySlotsListComponent,
    AppointmentDetailViewComponent,
    UpdateAvailabilitySlotComponent,
    ManageHoursComponent
  ],
  imports: [
    CommonModule,
    ScheduleRoutingModule,
    FormsModule,
    ReactiveFormsModule,
    FullCalendarModule,
    NzDropDownModule,
    NzSwitchModule,
    NzTableModule,
    NzDatePickerModule,
    NzInputModule,
    NzButtonModule,
    NzTabsModule,
    NzSelectModule,
    NzModalModule,
    NzPopoverModule,
    NzDrawerModule,
    NzCheckboxModule,
    NzRadioModule,
    SharedModule,
    NzCollapseModule,
    NzSpinModule,
    NzToolTipModule
  ],
  exports: [
    CalenderViewComponent
  ]
})
export class ScheduleModule { }
