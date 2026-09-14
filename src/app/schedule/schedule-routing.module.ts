import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { CalenderViewComponent } from './calender-view/calender-view.component';
import { AppointmentViewComponent } from './appointment-view/appointment-view.component';
import { AvailabilityListComponent } from './availability-list/availability-list.component';
import { AvailabiliySlotsListComponent } from './availabiliy-slots-list/availabiliy-slots-list.component';
import { AppointmentDetailViewComponent } from './appointment-detail-view/appointment-detail-view.component';
import { ManageHoursComponent } from './manage-hours/manage-hours.component';
import { PermissionGuard } from 'app/shared/permission/permission.guard';

const routes: Routes = [
  {
    path: 'calendar',
    component : CalenderViewComponent,
    canActivate: [PermissionGuard],
    data: { permissions: ['calendar_view'],
      title : 'Calendar'
     }
  },
  {
    path: 'appointments',
    component : AppointmentViewComponent,
    canActivate: [PermissionGuard],
    data: { permissions: ['appointment_view', 'appointment_delete', 'appointment_edit'] }
  },
  {
    path: 'appointment/details/:id',
    component : AppointmentDetailViewComponent,
    canActivate: [PermissionGuard],
    data: {
      permissions: ['appointment_view'],
      title: 'Loading'
    }
  },
  {
    path: 'availability',
    component : ManageHoursComponent,
    canActivate: [PermissionGuard],
    data: {
      permissions: ['avilability_view', 'avilability_add', 'avilability_edit', 'avilability_delete'],
      title : 'Manage Hours'
     }
  },
  {
    path: 'availability-legacy',
    component : AvailabilityListComponent,
    canActivate: [PermissionGuard],
    data: {
      permissions: ['avilability_view', 'avilability_add', 'avilability_edit', 'avilability_delete'],
      title : 'Availability (Legacy)'
     }
  },
  {
    path: 'availability/slots/:id',
    component : AvailabiliySlotsListComponent,
    canActivate: [PermissionGuard],
    data: {
      permissions: ['avilability_slot_view', 'avilability_slot_edit', 'avilability_slot_delete'],
      title : 'Availability Slot'
    }
  }
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule]
})
export class ScheduleRoutingModule { }
