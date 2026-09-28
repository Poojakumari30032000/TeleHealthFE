import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { PrescriptionListViewComponent } from './prescription-list-view/prescription-list-view.component';
import { PrescriptionDetailViewComponent } from './prescription-detail-view/prescription-detail-view.component';
import { PrescriptionAddEditViewComponent } from './prescription-add-edit-view/prescription-add-edit-view.component';
import { PermissionGuard } from 'app/shared/permission/permission.guard';
import {SOAPNotesComponent} from "./soap-notes/soap-notes.component";

const routes: Routes = [
  {
    path: '',
    redirectTo: 'view',
    pathMatch : 'full'
  },
  {
    path: 'view',
    component : PrescriptionListViewComponent,
    canActivate: [PermissionGuard],
    data: { permissions: ['prescription_view'],
      title : 'Prescription'
     }
  },
  {
    path: 'add',
    component : PrescriptionAddEditViewComponent,
    canActivate: [PermissionGuard],
    data: {
      permissions: ['prescription_edit'] ,
      title : 'Add Prescription'
    }
  },
  {
    path: 'soap-notes/:id',
    component : SOAPNotesComponent,
    // TEL-22 - was unguarded. Same codes the treatment screens use to view a treatment.
    canActivate: [PermissionGuard],
    data: {
      permissions: ['treatment_patient_view', 'treatment_view'],
      title : 'SOAP Notes'
    }
  },
  {
    path: 'update/:id',
    component : PrescriptionAddEditViewComponent,
    canActivate: [PermissionGuard],
    data: {
      permissions: ['prescription_edit'],
      title : 'Update Prescription'
     }
  },
  {
    path: 'detail/:id',
    component : PrescriptionDetailViewComponent,
    canActivate: [PermissionGuard],
    data: { permissions: ['prescription_view'],
      title : 'Loading'
     }
  }
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule]
})
export class PrescriptionRoutingModule { }
