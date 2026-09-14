import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { ChartsComponent } from './charts/charts.component';
import { ReportsComponent } from './reports/reports.component';

const routes: Routes = [
  {
    path: '',
    redirectTo: 'charts',
    pathMatch: 'full'
  },
  {
    path: 'charts',
    component: ChartsComponent,
    data: {
      title: 'Charts',
    },
  },
  {
    path: 'reports',
    component: ReportsComponent,
    data: {
      title: 'Reports',
    },
  },
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule],
})
export class AnalyticsRoutingModule {}
