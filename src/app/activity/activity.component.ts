import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  OnDestroy,
  OnInit,
  TemplateRef,
  ViewChild,
} from '@angular/core';
import { CommonModule, formatDate } from '@angular/common';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { Subject, takeUntil } from 'rxjs';
import { HttpErrorResponse } from '@angular/common/http';

import { NzDatePickerModule } from 'ng-zorro-antd/date-picker';
import { NzSelectModule } from 'ng-zorro-antd/select';
import { NzTableModule } from 'ng-zorro-antd/table';
import { NzPopoverModule } from 'ng-zorro-antd/popover';
import { NzTagModule } from 'ng-zorro-antd/tag';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzModalModule, NzModalService } from 'ng-zorro-antd/modal';

import { AuthService } from 'app/shared/Auth/auth.service';
import { GeneralService } from 'app/shared/services/general.service';

interface Facility {
  facilityId: number;
  titlelong: string;
  titleshort: string;
  guid: string;
  organizationId: number;
  organizationName: string;
}

interface AuditLog {
  auditLogId: number;
  action: string | null;
  entityType: string | null;
  module: string | null;
  entityId: number | null;
  userId: number | null;
  userName: string | null;
  patientId: number | null;
  patientName: string | null;
  facilityId: number | null;
  facilityName: string | null;
  organizationId: number | null;
  description: string | null;
  status: string | null;
  errorMessage: string | null;
  requestPath: string | null;
  requestMethod: string | null;
  ipAddress: string | null;
  createdDate: string;
  oldValues: any;
  newValues: any;
  additionalData: any;
}

@Component({
  selector: 'app-activity',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    ReactiveFormsModule,
    NzSelectModule,
    NzDatePickerModule,
    NzTableModule,
    NzPopoverModule,
    NzTagModule,
    NzButtonModule,
    NzModalModule,
  ],
  templateUrl: './activity.component.html',
  styleUrl: './activity.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ActivityComponent implements OnInit, OnDestroy {
  @ViewChild('jsonModalTpl', { static: true }) jsonModalTpl!: TemplateRef<unknown>;

  showFilters = false;

  facilities: Facility[] = [];
  facilitiesLoading = false;

  userRole = this.auth.getUserRole() || '';
  readonly orgId = Number(localStorage.getItem('OFL') || 0);

  selectedFacilityId: number | null = Number(localStorage.getItem('FOS') || 0) || null;

  modules: string[] = ['Facility', 'Order', 'Package', 'Payment', 'Prescription', 'User'];
  selectedModule: string | null = null;

  startDate: Date | null = null;
  endDate: Date | null = null;

  appliedFilters: Array<{ name: string; value: any }> = [];

  auditLogs: AuditLog[] = [];
  isLoading = false;

  pageIndex = 1;
  pageSize = 100;
  total = 0;

  jsonModalTitle = '';
  jsonModalString = '';

  private destroy$ = new Subject<void>();

  constructor(
    private auth: AuthService,
    private generalService: GeneralService,
    private modal: NzModalService,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    this.getFacilities();
    this.applyFiltersAndFetch(true);
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  getFacilities(): void {
    this.facilitiesLoading = true;
    this.cdr.markForCheck();

    const url =
      this.orgId && this.orgId > 0
        ? `DropDowns/getAllFacilities?OrganizationId=${this.orgId}`
        : `DropDowns/getAllFacilities`;

    this.generalService
      .commonGet(url)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (res: any) => {
          this.facilities = Array.isArray(res?.data) ? res.data : [];
          this.facilitiesLoading = false;
          this.cdr.markForCheck();
        },
        error: (err: HttpErrorResponse) => {
          console.error('Failed to fetch facilities:', err);
          this.facilities = [];
          this.facilitiesLoading = false;
          this.cdr.markForCheck();
        },
      });
  }

  onFiltersChanged(): void {
    this.pageIndex = 1;
    this.applyFiltersAndFetch(true);
  }

  applyFiltersAndFetch(fetch: boolean): void {
    if (!this.validateDateRange()) return;

    this.appliedFilters = [
      { name: 'FacilityId', value: this.selectedFacilityId },
      { name: 'Module', value: this.selectedModule },
      { name: 'StartDate', value: this.startDate },
      { name: 'EndDate', value: this.endDate },
    ].filter((f) => f.value !== null && f.value !== undefined && f.value !== '' && f.value !== 0);

    if (fetch) this.fetchAuditLogs();
  }

  validateDateRange(): boolean {
    if (this.startDate && this.endDate) {
      const s = new Date(this.startDate).getTime();
      const e = new Date(this.endDate).getTime();
      if (e < s) {
        this.generalService.showError('End Date cannot be earlier than Start Date.');
        return false;
      }
    }
    return true;
  }

  clearFilters(): void {
    this.selectedModule = null;
    this.startDate = null;
    this.endDate = null;

    if (['Global Admin', 'Provider'].includes(this.userRole)) {
      this.selectedFacilityId = null;
    } else {
      this.selectedFacilityId = Number(localStorage.getItem('FOS') || 0) || null;
    }

    this.pageIndex = 1;
    this.showFilters = false;
    this.applyFiltersAndFetch(true);
  }

  removeFilter(filterName: string): void {
    switch (filterName) {
      case 'FacilityId':
        this.selectedFacilityId = ['Global Admin', 'Provider'].includes(this.userRole)
          ? null
          : Number(localStorage.getItem('FOS') || 0) || null;
        break;
      case 'Module':
        this.selectedModule = null;
        break;
      case 'StartDate':
        this.startDate = null;
        break;
      case 'EndDate':
        this.endDate = null;
        break;
    }
    this.pageIndex = 1;
    this.applyFiltersAndFetch(true);
  }

  get visibleFiltersCount(): number {
    return this.appliedFilters.filter((f) => !this.shouldHideAppliedFilter(f.name)).length;
  }

  shouldHideAppliedFilter(filterName: string): boolean {

    return filterName === 'FacilityId' && !['Global Admin', 'Provider'].includes(this.userRole);
  }

  getFilterDisplayName(filterName: string): string {
    switch (filterName) {
      case 'FacilityId':
        return 'Facility';
      case 'StartDate':
        return 'Start Date';
      case 'EndDate':
        return 'End Date';
      default:
        return filterName;
    }
  }

  getFilterDisplayValue(filter: { name: string; value: any }): string {
    switch (filter.name) {
      case 'FacilityId': {
        const f = this.facilities.find((x) => x.facilityId === Number(filter.value));
        return f ? f.titlelong : String(filter.value);
      }
      case 'StartDate':
        return this.formatFilterDate(filter.value);
      case 'EndDate':
        return this.formatFilterDate(filter.value);
      default:
        return String(filter.value);
    }
  }

  private formatFilterDate(d: Date): string {
    try {
      return formatDate(d, 'yyyy-MM-dd', 'en-US');
    } catch {
      return String(d);
    }
  }

  trackByFilterName(_index: number, filter: any): string {
    return filter.name;
  }

  onPageIndexChange(page: number): void {
    this.pageIndex = page;
    this.fetchAuditLogs();
  }

  onPageSizeChange(size: number): void {
    this.pageSize = size;
    this.pageIndex = 1;
    this.fetchAuditLogs();
  }

  fetchAuditLogs(): void {
    if (!this.validateDateRange()) return;

    this.isLoading = true;
    this.cdr.markForCheck();

    const qs = this.buildQueryString();

    this.generalService
      .commonGet(`AuditLogs/getAllAuditLogs${qs}`)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (res: any) => {
          this.auditLogs = Array.isArray(res?.data) ? res.data : [];

          const totalEntityCount =
            typeof res?.totalEntityCount === 'number' ? res.totalEntityCount : null;
          const count = typeof res?.count === 'number' ? res.count : null;

          this.total =
            totalEntityCount && totalEntityCount > 0
              ? totalEntityCount
              : count && count > 0
                ? count
                : this.auditLogs.length;

          this.isLoading = false;
          this.cdr.markForCheck();
        },
        error: (err: HttpErrorResponse) => {
          console.error('Failed to fetch audit logs:', err);
          this.auditLogs = [];
          this.total = 0;
          this.isLoading = false;
          this.cdr.markForCheck();
        },
      });
  }

  private buildQueryString(): string {
    const params: string[] = [];

    if (this.selectedFacilityId) params.push(`FacilityId=${encodeURIComponent(String(this.selectedFacilityId))}`);
    if (this.selectedModule) params.push(`Module=${encodeURIComponent(this.selectedModule)}`);

    if (this.startDate) {
      params.push(`StartDate=${encodeURIComponent(this.toIsoDateTime(this.startDate, false))}`);
    }
    if (this.endDate) {
      params.push(`EndDate=${encodeURIComponent(this.toIsoDateTime(this.endDate, true))}`);
    }

    params.push(`PageNumber=${encodeURIComponent(String(this.pageIndex))}`);
    params.push(`PageSize=${encodeURIComponent(String(this.pageSize))}`);

    return `?${params.join('&')}`;
  }

  private toIsoDateTime(date: Date, endOfDay: boolean): string {
    const d = new Date(date);
    if (endOfDay) d.setHours(23, 59, 59, 999);
    else d.setHours(0, 0, 0, 0);
    return formatDate(d, "yyyy-MM-dd'T'HH:mm:ss", 'en-US');
  }

  isLongText(text: string | null | undefined, limit = 70): boolean {
    return typeof text === 'string' && text.length > limit;
  }

  safeText(text: string | null | undefined, fallback = ''): string {
    return typeof text === 'string' ? text : fallback;
  }

  jsonFieldCount(payload: any): number {
    if (!payload) return 0;
    if (typeof payload !== 'object') return 1;
    return Object.keys(payload).length;
  }

  openJsonModal(title: string, payload: any): void {
    this.jsonModalTitle = title;
    this.jsonModalString = payload ? JSON.stringify(payload, null, 2) : 'No data';

    this.modal.create({
      nzTitle: this.jsonModalTitle,
      nzContent: this.jsonModalTpl,
      nzFooter: null,
      nzWidth: 900,
      nzMaskClosable: true,
    });
  }

  statusTagColor(status: string | null | undefined): string {
    const s = (status || '').toLowerCase();
    if (s === 'success') return 'green';
    if (s === 'failed' || s === 'error') return 'red';
    return 'blue';
  }

  statusBadgeClass(status: string | null | undefined): string {
    const s = (status || '').toLowerCase();
    if (s === 'success' || s === 'completed' || s === 'paid') return 'ui-status-badge--success';
    if (s === 'pending' || s === 'processing') return 'ui-status-badge--pending';
    if (s === 'failed' || s === 'error') return 'ui-status-badge--danger';
    if (s === 'review' || s === 'inprogress') return 'ui-status-badge--info';
    return 'ui-status-badge--neutral';
  }
}
