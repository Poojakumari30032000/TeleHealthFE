import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';

import { AnalyticsRoutingModule } from './analytics-routing.module';
import { ChartsComponent } from './charts/charts.component';
import { ReportsComponent } from './reports/reports.component';
import { NgxEchartsModule } from 'ngx-echarts';

@NgModule({
  declarations: [
    ChartsComponent,
    ReportsComponent
  ],
  imports: [
    CommonModule,
    AnalyticsRoutingModule,
    NgxEchartsModule.forRoot({
        echarts: () => import('echarts')
    }),
  ]
})
export class AnalyticsModule { }
