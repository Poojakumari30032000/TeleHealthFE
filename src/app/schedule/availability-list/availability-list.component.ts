import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  OnDestroy,
  OnInit,
  ViewChild,
} from '@angular/core';
import { Router } from '@angular/router';
import { GeneralService } from 'app/shared/services/general.service';
import { debounceTime, Subject, takeUntil } from 'rxjs';
import { AuthService } from 'app/shared/Auth/auth.service';
import { AvailabilityAddEditModelComponent } from 'app/shared/availability-add-edit-model/availability-add-edit-model.component';
import { NzTableQueryParams } from 'ng-zorro-antd/table';

interface Provider {
  providerId: number;
  name: string;
}

interface Availability {
  providerScheduleId: number;
  title: string;
  providerId: number;
  providerName: string;
  startDate: string | null;
  isRecurrence: boolean | null;
  slotCount: number | null;
  duration: number | null;
}

@Component({
  selector: 'app-availability-list',
  templateUrl: './availability-list.component.html',
  styleUrls: ['./availability-list.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class AvailabilityListComponent implements OnInit, OnDestroy {
  @ViewChild(AvailabilityAddEditModelComponent) availabilityModel!: AvailabilityAddEditModelComponent;

  showFilters: boolean = true;
  appliedFilters: any[] = [];
  private destroy$ = new Subject<void>();
  private searchTerms = new Subject<void>();

  searchQuery: string = '';
  selectedProvider: number = 0;
  selectedDateRange: Date[] | null = null;
  loadingProvider = false;
  providerList: Provider[] = [];
  userRole: string = '';

  loading = false;
  availabilities: Availability[] = [];
  total = 0;
  pageIndex = 1;
  pageSize = 100;

  constructor(private route: Router, private generalService: GeneralService, private cdr: ChangeDetectorRef, private auth: AuthService) {
    this.searchTerms
      .pipe(debounceTime(1000), takeUntil(this.destroy$))
      .subscribe(() => {
        this.applyFilter(true);
      });

    this.userRole = this.auth.getUserRole() || '';
    if (this.userRole === 'Provider') {
      const userId = this.auth.getUserId() || 0;
      this.selectedProvider = userId;
    }
  }

  ngOnInit(): void {
    this.getAllProvider();
    this.applyFilter(true);
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
    this.searchTerms.complete();
  }

  searchTermChanged(): void {
    this.searchTerms.next();
  }

  getAllProvider(): void {
    if (this.userRole === 'Provider') {
      return;
    }

    this.loadingProvider = true;
    this.generalService
      .commonGet(`DropDowns/getAllProviders`)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (res) => {
          this.providerList = Array.isArray(res?.data) ? res.data : [];
          this.loadingProvider = false;
          this.cdr.markForCheck();
        },
        error: (err) => {
          console.error('Error loading providers:', err);
          this.providerList = [];
          this.loadingProvider = false;
          this.cdr.markForCheck();
        },
      });
  }

  formatDateLocal(date: Date): string {
    const year = date.getFullYear();
    const month = ('0' + (date.getMonth() + 1)).slice(-2);
    const day = ('0' + date.getDate()).slice(-2);
    return `${year}-${month}-${day}`;
  }

  applyFilter(resetPage = true): void {
    if (resetPage) {
      this.pageIndex = 1;
    }

    this.appliedFilters = [
      { name: 'ProviderId', value: this.selectedProvider },
      { name: 'Title', value: this.searchQuery },
    ];

    if (this.selectedDateRange && this.selectedDateRange.length === 2) {
      const startDate = this.formatDateLocal(this.selectedDateRange[0]!);
      const endDate = this.formatDateLocal(this.selectedDateRange[1]!);
      this.appliedFilters.push({ name: 'StartDate', value: startDate });
      this.appliedFilters.push({ name: 'EndDate', value: endDate });
    }

    this.appliedFilters = this.appliedFilters.filter(
      (filter) =>
        filter.value !== null &&
        filter.value !== undefined &&
        filter.value !== '' &&
        filter.value !== 0
    );
    this.appliedFilters.push({ name: 'ClientTimezoneOffsetMinutes', value: -new Date().getTimezoneOffset() });
    this.fetchAvailabilities();
  }

  onQueryParamsChange(params: NzTableQueryParams): void {
    const { pageIndex, pageSize } = params;
    const pageChanged = pageIndex !== this.pageIndex;
    const sizeChanged = pageSize !== this.pageSize;

    this.pageIndex = pageIndex;
    this.pageSize = pageSize;

    if (pageChanged || sizeChanged) {
      this.fetchAvailabilities();
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

  private fetchAvailabilities(): void {
    this.loading = true;
    this.cdr.markForCheck();

    const query = this.buildQueryString();
    this.generalService
      .commonGet(`ProviderSchedules/getAllProviderSchedules?${query}`)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (response: any) => {
          if (response?.status === 1) {
            this.availabilities = Array.isArray(response?.data) ? response.data : [];
            this.total = Number(response?.totalEntityCount ?? 0);
          } else {
            this.availabilities = [];
            this.total = 0;
          }

          this.loading = false;
          this.cdr.markForCheck();
        },
        error: (err) => {
          console.error('Failed to fetch availabilities:', err);
          this.availabilities = [];
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
    if (filterName === 'ClientTimezoneOffsetMinutes') return true;
    if (this.userRole === 'Provider') {
      return filterName === 'ProviderId';
    }
    return false;
  }

  getFilterDisplayName(filterName: string): string {
    switch (filterName) {
      case 'ProviderId': return 'Provider';
      case 'StartDate': return 'Start Date';
      case 'EndDate': return 'End Date';
      default: return filterName;
    }
  }

  getFilterDisplayValue(filter: any): string {
    switch (filter.name) {
      case 'ProviderId':
        const optionProvider = this.providerList.find(opt => opt.providerId.toString() === filter.value?.toString());
        return optionProvider ? optionProvider.name : filter.value;
      default:
        return filter.value;
    }
  }

  trackByFilterName(_index: number, filter: any): string {
    return filter.name;
  }

  clearFilters() {
    this.searchQuery = '';
    this.selectedDateRange = null;
    this.selectedProvider = this.userRole === 'Provider' ? (this.auth.getUserId() || 0) : 0;
    this.showFilters = false;
    this.applyFilter(true);
  }

  removeFilter(filterName: string) {
    switch(filterName) {
      case 'Title':
        this.searchQuery = '';
        break;
      case 'ProviderId':
        this.selectedProvider = this.userRole === 'Provider' ? (this.auth.getUserId() || 0) : 0;
        break;
      case 'StartDate':
        this.selectedDateRange = null;
        break;
      case 'EndDate':
        this.selectedDateRange = null;
        break;
    }
    this.applyFilter(true);
  }

  AddEditAvailability = () => {
    if (this.availabilityModel) {
      this.availabilityModel.showModal(0, 'Add Availability');
    } else {
      console.error('Availability model is not initialized.');
    }
  };

  navigateToSlots = (data: Availability) => {
    const ID = data.providerScheduleId;
    this.route.navigate(['schedule/availability/slots', ID]);
  };

  refreshTable() {
    this.fetchAvailabilities();
  }

  trackByProvider(_index: number, provider: Provider): number {
    return provider.providerId;
  }

  trackByAvailabilityId(_index: number, data: Availability): number {
    return data.providerScheduleId;
  }

  getRecurrenceBadgeClass(value: boolean | null | undefined): string {
    if (value === true) return 'ui-status-badge--success';
    if (value === false) return 'ui-status-badge--pending';
    return 'ui-status-badge--neutral';
  }

  getRecurrenceLabel(value: boolean | null | undefined): string {
    if (value === true) return 'Yes';
    if (value === false) return 'No';
    return '--';
  }

  onDelete = (data: Availability): void => {
    const apiUrl = 'ProviderSchedules/deleteProviderScheduleById';
    const title = `Availability`;
    const body = {
      id: data.providerScheduleId,
    };
    this.generalService.commonDelete(apiUrl, title, body).pipe(takeUntil(this.destroy$)).subscribe({
      next: (data) => {
        console.log('Deleted data:', data);
        this.fetchAvailabilities();
      },
      error: (err) => {
        console.error('Delete failed:', err);
      },
    });
  };

}
