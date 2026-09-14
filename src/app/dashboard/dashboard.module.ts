import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';

import { DashboardRoutingModule } from './dashboard-routing.module';
import { PatientDashboardComponent } from './patient-dashboard/patient-dashboard.component';
import { GlobalAdminDashboardComponent } from './global-admin-dashboard/global-admin-dashboard.component';
import { FacilityAdminDashboardComponent } from './facility-admin-dashboard/facility-admin-dashboard.component';
import { ProviderDashboardComponent } from './provider-dashboard/provider-dashboard.component';
import { NgxEchartsModule } from 'ngx-echarts';
import { ScheduleModule } from "../schedule/schedule.module";
import { NzSelectModule } from 'ng-zorro-antd/select';
import { FormsModule } from '@angular/forms';
import { NzTableModule } from 'ng-zorro-antd/table';
import { NzTagModule } from 'ng-zorro-antd/tag';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzPaginationModule } from 'ng-zorro-antd/pagination';
import { NzDropDownModule } from 'ng-zorro-antd/dropdown';
import { NzIconModule } from 'ng-zorro-antd/icon';
import { NzMenuModule } from 'ng-zorro-antd/menu';
import { NzCalendarModule } from 'ng-zorro-antd/calendar';
import { NzBadgeModule } from 'ng-zorro-antd/badge';
import { NzToolTipModule } from 'ng-zorro-antd/tooltip';
import { NzDatePickerModule } from 'ng-zorro-antd/date-picker';

@NgModule({
  declarations: [
    PatientDashboardComponent,
    GlobalAdminDashboardComponent,
    FacilityAdminDashboardComponent,
    ProviderDashboardComponent
  ],
  imports: [
    CommonModule,
    DashboardRoutingModule,
    NgxEchartsModule.forRoot({
        echarts: () => import('echarts')
    }),
    ScheduleModule,
    NzSelectModule,
    FormsModule,
    NzTableModule,
    NzTagModule,
    NzButtonModule,
    NzPaginationModule,
    NzDropDownModule,
    NzIconModule,
    NzMenuModule,
    NzCalendarModule,
    NzBadgeModule,
    NzToolTipModule,
    NzDatePickerModule

]
})
export class DashboardModule { }
