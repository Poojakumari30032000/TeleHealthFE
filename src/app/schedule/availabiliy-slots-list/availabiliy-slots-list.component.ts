import { ChangeDetectionStrategy, ChangeDetectorRef, Component, ViewChild } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { GeneralService } from 'app/shared/services/general.service';
import { UpdateAvailabilitySlotComponent } from '../models/update-availability-slot/update-availability-slot.component';
import { Location } from '@angular/common';
import { TitleService } from 'app/shared/services/title.service';
import { Subject, takeUntil } from 'rxjs';
import { NzTableQueryParams } from 'ng-zorro-antd/table';

interface Slot {
  providerScheduledSlotId: number;
  providerId: number;
  date: string;
  startTime: string;
  endTime: string;
  duration: number;
  isAppointment: boolean;
}

@Component({
  selector: 'app-availabiliy-slots-list',
  templateUrl: './availabiliy-slots-list.component.html',
  styleUrl: './availabiliy-slots-list.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class AvailabiliySlotsListComponent {
  @ViewChild(UpdateAvailabilitySlotComponent)
  slotModel!: UpdateAvailabilitySlotComponent;

  selectedDuration: number = 0;
  providerScheduleId: number = 0;
  selectedApptStatus: string = '';
  showFilters: boolean = true;
  appliedFilters: any[] = [];
  private destroy$ = new Subject<void>();

  loading = false;
  slots: Slot[] = [];
  total = 0;
  pageIndex = 1;
  pageSize = 10;

  constructor(
    private route: ActivatedRoute,
    private generalService: GeneralService,
    private _location: Location,
    private titleService: TitleService,
    private cdr: ChangeDetectorRef
  ) {
    this.providerScheduleId = Number(this.route.snapshot.paramMap.get('id'));
  }

  ngOnInit(){
    this.titleService.updateTitle(
      'Slots',
      [
        { label: 'Availability', path: '/schedule/availability' },
        { label: 'Slots', path: `/schedule/availability/slots/${this.providerScheduleId}` },
      ]
    );
    this.applyFilter(true);
  }

  applyFilter(resetPage = true): void {
    if (resetPage) {
      this.pageIndex = 1;
    }

    this.appliedFilters = [
      { name: 'ProviderScheduleId', value: this.providerScheduleId },
      { name: 'Duration', value: this.selectedDuration },
      { name: 'AppointmentStatus', value: this.selectedApptStatus },
      { name: 'ClientTimezoneOffsetMinutes', value: -new Date().getTimezoneOffset() },
    ].filter(
      (filter) =>
        filter.name === 'ClientTimezoneOffsetMinutes' ||
        (filter.value !== null &&
          filter.value !== undefined &&
          filter.value !== '' &&
          filter.value !== 0)
    );
    this.fetchSlots();
  }

  onQueryParamsChange(params: NzTableQueryParams): void {
    const { pageIndex, pageSize } = params;
    const pageChanged = pageIndex !== this.pageIndex;
    const sizeChanged = pageSize !== this.pageSize;

    this.pageIndex = pageIndex;
    this.pageSize = pageSize;

    if (pageChanged || sizeChanged) {
      this.fetchSlots();
    }
  }

  private buildQueryString(): string {
    const parts: string[] = [];
    parts.push(`PageNumber=${encodeURIComponent(String(this.pageIndex))}`);
    parts.push(`PageSize=${encodeURIComponent(String(this.pageSize))}`);

    for (const filter of this.appliedFilters) {
      parts.push(`${encodeURIComponent(filter.name)}=${encodeURIComponent(String(filter.value))}`);
    }

    return parts.join('&');
  }

  private fetchSlots(): void {
    this.loading = true;
    this.cdr.markForCheck();

    const query = this.buildQueryString();
    this.generalService
      .commonGet(`ProviderSchedules/getAllProviderScheduledSlots?${query}`)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (response: any) => {
          if (response?.status === 1) {
            this.slots = Array.isArray(response?.data) ? response.data : [];
            this.total = Number(response?.totalEntityCount ?? 0);
          } else {
            this.slots = [];
            this.total = 0;
          }

          this.loading = false;
          this.cdr.markForCheck();
        },
        error: (err) => {
          console.error('Failed to fetch slots:', err);
          this.slots = [];
          this.total = 0;
          this.loading = false;
          this.cdr.markForCheck();
        },
      });
  }

  get visibleFiltersCount(): number {
    return this.appliedFilters.filter(f => !this.shouldHideAppliedFilter(f.name)).length;
  }

  shouldHideAppliedFilter(filterName: string): boolean {
    if (!filterName) return false;
    return filterName === 'ProviderScheduleId' || filterName === 'ClientTimezoneOffsetMinutes';
  }

  getFilterDisplayName(filterName: string): string {
    switch (filterName) {
      case 'AppointmentStatus': return 'Status';
      case 'Duration': return 'Duration';
      default: return filterName;
    }
  }

  getFilterDisplayValue(filter: any): string {
    if (filter?.name === 'Duration') {
      return `${filter.value} mins`;
    }
    if (filter?.name === 'AppointmentStatus') {
      return filter.value === 'booked' ? 'Booked' : 'Available';
    }
    return filter?.value;
  }

  trackByFilterName(_index: number, filter: any): string {
    return filter.name;
  }

  clearFilters() {
    this.selectedDuration = 0;
    this.selectedApptStatus = '';
    this.showFilters = true;
    this.applyFilter(true);
  }

  removeFilter(filterName: string) {
    switch(filterName) {
      case 'Duration':
        this.selectedDuration = 0;
        break;
      case 'AppointmentStatus':
        this.selectedApptStatus = '';
        break;
    }
    this.applyFilter(true);
  }

  moveBack() {
    this._location.back();
  }

  refreshTable() {
    this.fetchSlots();
  }

  reScheduleSlot = (data?: Slot) => {
    if (data && data.isAppointment) {
      this.generalService.showInfo(
        "Booked slot can't be edited"
      );
      return;
    }
    let title: string = 'Add Slot';
    if (data) {
      title = 'Update Slot';
    }
    if (this.slotModel) {
      this.slotModel.showModal(data || null, title, this.providerScheduleId);
    } else {
      console.error('Slot model is not initialized.');
    }
  };

  onDelete = (data: Slot): void => {
    if (data && data.isAppointment) {
      this.generalService.showInfo(
        'Booked Slot can\'t be deleted.'
      );
      return;
    }
    else{
    const apiUrl = 'ProviderSchedules/deleteProviderScheduledSlotById';
    const title = 'Slot';
    const body = {
      id: data.providerScheduledSlotId,
    };
    this.generalService.commonDelete(apiUrl, title, body).pipe(takeUntil(this.destroy$)).subscribe({
      next: (data) => {
        console.log('Deleted data:', data);
        this.fetchSlots();
      },
      error: (err) => {
        console.error('Delete failed:', err);
      },
    });
    }
  };

  trackBySlotId(_index: number, data: Slot): number {
    return data.providerScheduledSlotId;
  }

  onSlotRowClick(slot: Slot): void {
    this.reScheduleSlot(slot);
  }

  getAppointmentBadgeClass(value: boolean): string {
    return value ? 'ui-status-badge--pending' : 'ui-status-badge--success';
  }

  getAppointmentLabel(value: boolean): string {
    return value ? 'Booked' : 'Available';
  }

  formatTime(value?: string): string {
    if (!value) return '--';

    const [hoursStr, minutesStr = '00', secondsStr = '00'] = value.split(':');
    const hours = Number(hoursStr);
    const minutes = Number(minutesStr);
    const seconds = Number(secondsStr);

    if ([hours, minutes, seconds].some((part) => Number.isNaN(part))) {
      return value;
    }

    const displayHours = hours % 12 || 12;
    return `${displayHours.toString().padStart(2, '0')}:${minutesStr.padStart(2, '0')}:${secondsStr.padStart(2, '0')}`;
  }

  ngOnDestroy(): void{
    this.destroy$.next();
    this.destroy$.complete();
  }
}
