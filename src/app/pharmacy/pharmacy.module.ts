import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';

import { PharmacyRoutingModule } from './pharmacy-routing.module';
import { PharmacyListViewComponent } from './pharmacy-list-view/pharmacy-list-view.component';
import { PharmacyDetailViewComponent } from './pharmacy-detail-view/pharmacy-detail-view.component';
import { SharedModule } from 'app/shared/shared.module';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzDatePickerModule } from 'ng-zorro-antd/date-picker';
import { NzDropDownModule } from 'ng-zorro-antd/dropdown';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzModalModule } from 'ng-zorro-antd/modal';
import { NzSelectModule } from 'ng-zorro-antd/select';
import { NzSwitchModule } from 'ng-zorro-antd/switch';
import { NzTableModule } from 'ng-zorro-antd/table';
import { NzTabsModule } from 'ng-zorro-antd/tabs';
import { FormsModule } from '@angular/forms';

@NgModule({
  declarations: [
    PharmacyListViewComponent,
    PharmacyDetailViewComponent
  ],
  imports: [
    CommonModule,
    PharmacyRoutingModule,
    FormsModule,
    NzDropDownModule,
    NzSwitchModule,
    NzTableModule,
    NzDatePickerModule,
    NzInputModule,
    NzButtonModule,
    NzTabsModule,
    NzSelectModule,
    NzModalModule,
    SharedModule,
  ]
})
export class PharmacyModule { }
