import { ChangeDetectionStrategy, Component, ViewChild } from '@angular/core';
import { GeneralService } from '../../shared/services/general.service';
import { Router } from '@angular/router';
import { DynamicTableComponent } from '../../shared/dynamic-table/dynamic-table.component';
import { CommanFormModalComponent } from 'app/shared/comman-form-modal/comman-form-modal.component';
import { Subject, takeUntil } from 'rxjs';

export interface Appointment {
  id: number;
  service: string;
  provider: string;
  patient: string;
  date: Date;
  startTime: string;
  endTime: string;
}

@Component({
  selector: 'app-appointment-view',
  templateUrl: './appointment-view.component.html',
  styleUrls: ['./appointment-view.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class AppointmentViewComponent {

  @ViewChild('commanModel', { static: false }) commanModel!: CommanFormModalComponent;
  @ViewChild(DynamicTableComponent) dynamicTable!: DynamicTableComponent;
  modalApiUrl : { save?: string; get?: string } = {
    save : '',
    get : ''
  };
  private destroy$ = new Subject<void>();

  constructor( private generalService: GeneralService, private route : Router ){}

  navigateToSlots = (data: Appointment) => {
    this.route.navigate(['schedule/appointment/details', data.id]);
  };

  AddEditAppointment = (data?: Appointment) => {
    let title : string = 'Add Appointment';
    const ID = data?.id || 0
    if(data){
      title = 'Update Appointment';
    }
    this.commanModel.showModal(title, 'form', 'appointment-form.json', ID)
  }

  reScheduleAppointment = (data: Appointment) => {
    this.commanModel.showModal('Re-Schedule Appointment', 'form', 'reSchedule-appt-form.json', data.id);
  }

  onDelete = (data: Appointment): void => {
    const apiUrl = '';
    const title = 'Appointment';
    const body = {
      primaryId : data.id
    }
    this.generalService.commonDelete(apiUrl, title ,body).pipe(takeUntil(this.destroy$)).subscribe({
      next: (data) => {
        console.log('Deleted data:', data);
        this.dynamicTable.fetchData();

      },
      error: (err) => {
        console.error('Delete failed:', err);
      }
    });
  }
  ngOnDestroy(): void{
    this.destroy$.next();
    this.destroy$.complete();
  }

}
