import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

import { RoleRoutingModule } from './role-routing.module';
import { RoleListViewComponent } from './role-list-view/role-list-view.component';
import { RoleDetailViewComponent } from './role-detail-view/role-detail-view.component';

import { SharedModule } from 'app/shared/shared.module';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzCheckboxModule } from 'ng-zorro-antd/checkbox';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzModalModule } from 'ng-zorro-antd/modal';
import { NzSwitchModule } from 'ng-zorro-antd/switch';
import { NzTableModule } from 'ng-zorro-antd/table';
import { NzTagModule } from 'ng-zorro-antd/tag';
import { NzToolTipModule } from 'ng-zorro-antd/tooltip';
import { NzEmptyModule } from 'ng-zorro-antd/empty';
import { NzSpinModule } from 'ng-zorro-antd/spin';

@NgModule({
  declarations: [
    RoleListViewComponent,
    RoleDetailViewComponent
  ],
  imports: [
    CommonModule,
    RoleRoutingModule,
    FormsModule,
    SharedModule,
    NzTableModule,
    NzButtonModule,
    NzInputModule,
    NzCheckboxModule,
    NzSwitchModule,
    NzModalModule,
    NzTagModule,
    NzToolTipModule,
    NzEmptyModule,
    NzSpinModule
  ]
})
export class RoleModule { }
