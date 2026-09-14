import { CommonModule } from '@angular/common';
import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  OnDestroy,
  OnInit
} from '@angular/core';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { FormsModule } from '@angular/forms';
import { Subject, debounceTime, finalize, takeUntil } from 'rxjs';
import { DragDropModule, CdkDragDrop, transferArrayItem, moveItemInArray } from '@angular/cdk/drag-drop';

import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzModalModule } from 'ng-zorro-antd/modal';
import { NzSelectModule } from 'ng-zorro-antd/select';
import { NzTableModule, NzTableQueryParams } from 'ng-zorro-antd/table';
import { NzTabsModule } from 'ng-zorro-antd/tabs';

import { GeneralService } from 'app/shared/services/general.service';
import { HttpErrorResponse } from '@angular/common/http';
import {AuthService} from "../shared/Auth/auth.service";
import { GlobalAdminTicketsDetailedViewComponent } from 'app/global-admin-tickets-detailed-view/global-admin-tickets-detailed-view.component';

export enum TicketPriority {
  Low = 1,
  Medium = 2,
  High = 3
}

export enum TicketStatus {
  Pending = 1,
  InProgress = 2,
  Review = 3,
  Closed = 4
}

interface ApiResponse<T = any> {
  status: number;
  success: boolean | null;
  message: string;
  count: number;
  data: T;
  totalEntityCount?: number | null;
  totalPages?: number | null;
}

interface TicketRow {
  ticketId: number;
  title: string;
  description?: string;
  priority: TicketPriority;
  status: TicketStatus;
  createdBy: string;
  createdDate: string;
  commentCount: number;
  modifiedBy: string | null;
  modifiedDate: string | null;
}

interface BoardColumn {
  statusId: TicketStatus;
  label: string;
  colorClass: string;
  tickets: TicketRow[];
  page: number;
  hasMore: boolean;
  loading: boolean;
  loadingMore: boolean;
}

interface TicketDetailTab {
  key: string;
  ticketId: number;
  title: string;
}

@Component({
  selector: 'app-global-admin-tickets',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    ReactiveFormsModule,
    NzInputModule,
    NzButtonModule,
    NzSelectModule,
    NzModalModule,
    NzTableModule,
    NzTabsModule,
    DragDropModule,
    GlobalAdminTicketsDetailedViewComponent
  ],
  templateUrl: './global-admin-tickets.component.html',
  styleUrl: './global-admin-tickets.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class GlobalAdminTicketsComponent implements OnInit, OnDestroy {
  private destroy$ = new Subject<void>();
  private search$ = new Subject<void>();

  readonly ticketsListTabKey = 'tickets-list';
  activeTabKey = this.ticketsListTabKey;
  detailTabs: TicketDetailTab[] = [];

  viewMode: 'list' | 'board' = 'board';

  readonly BOARD_PAGE_SIZE = 10;
  boardColumns: BoardColumn[] = [
    { statusId: TicketStatus.Pending,    label: 'Pending',     colorClass: 'col-pending',    tickets: [], page: 1, hasMore: false, loading: false, loadingMore: false },
    { statusId: TicketStatus.InProgress, label: 'In Progress', colorClass: 'col-inprogress', tickets: [], page: 1, hasMore: false, loading: false, loadingMore: false },
    { statusId: TicketStatus.Review,     label: 'Review',      colorClass: 'col-review',     tickets: [], page: 1, hasMore: false, loading: false, loadingMore: false },
    { statusId: TicketStatus.Closed,     label: 'Closed',      colorClass: 'col-closed',     tickets: [], page: 1, hasMore: false, loading: false, loadingMore: false },
  ];

  loading = false;
  saving = false;
  isModalVisible = false;
  showFilters = true;

  pageIndex = 1;
  pageSize = 100;
  totalEntityCount = 0;

  searchQuery = '';
  selectedStatus: TicketStatus | null = null;
  selectedPriority: TicketPriority | null = null;
  appliedFilters: { name: string; value: string }[] = [];

  priorityOptions = [
    { value: TicketPriority.Low, label: 'Low' },
    { value: TicketPriority.Medium, label: 'Medium' },
    { value: TicketPriority.High, label: 'High' }
  ];

  statusOptions = [
    { value: TicketStatus.Pending, label: 'Pending' },
    { value: TicketStatus.InProgress, label: 'In Progress' },
    { value: TicketStatus.Review, label: 'Review' },
    { value: TicketStatus.Closed, label: 'Closed' }
  ];

  tickets: TicketRow[] = [];

  userRole : string | null = null;

  ticketForm: FormGroup;

  constructor(
    private generalService: GeneralService,
    private fb: FormBuilder,
    private cdr: ChangeDetectorRef,
    private auth: AuthService
  ) {
    this.ticketForm = this.fb.group({
      subject: ['', [Validators.required, Validators.maxLength(200)]],
      description: ['', [Validators.required, Validators.maxLength(4000)]],
      status: [TicketStatus.Pending, [Validators.required]],
      priority: [TicketPriority.Medium, [Validators.required]],
      contactEmail: ['', [Validators.email]]
    });

    this.search$.pipe(debounceTime(600), takeUntil(this.destroy$)).subscribe(() => {

      this.pageIndex = 1;
      this.applyFilter();
    });
  }

  ngOnInit(): void {
    this.userRole = this.auth.getUserRole();
    this.applyFilter();
  }

  statusLabel = (s: TicketStatus | null | undefined): string => {
    const found = this.statusOptions.find((x) => x.value === s);
    return found ? found.label : '--';
  };

  priorityLabel = (p: TicketPriority | null | undefined): string => {
    const found = this.priorityOptions.find((x) => x.value === p);
    return found ? found.label : '--';
  };

  statusBadgeClass(status: TicketStatus): string {
    switch (status) {
      case TicketStatus.Pending:
        return 'ui-status-badge--pending';
      case TicketStatus.InProgress:
        return 'ui-status-badge--info';
      case TicketStatus.Review:
        return 'ui-status-badge--created';
      case TicketStatus.Closed:
        return 'ui-status-badge--success';
      default:
        return 'ui-status-badge--neutral';
    }
  }

  priorityBadgeClass(priority: TicketPriority): string {
    switch (priority) {
      case TicketPriority.Low:
        return 'ui-status-badge--success';
      case TicketPriority.Medium:
        return 'ui-status-badge--pending';
      case TicketPriority.High:
        return 'ui-status-badge--danger';
      default:
        return 'ui-status-badge--neutral';
    }
  }

  onQueryParamsChange(params: NzTableQueryParams): void {
    const { pageIndex, pageSize } = params;

    const changed = pageIndex !== this.pageIndex || pageSize !== this.pageSize;
    if (!changed) return;

    this.pageIndex = pageIndex;
    this.pageSize = pageSize;

    this.fetchTickets();
  }

  searchTermChanged(): void {
    this.search$.next();
  }

  applyFilter(): void {
    this.updateAppliedFilters();
    if (this.viewMode === 'board') {
      this.loadAllBoardColumns();
    } else {
      this.fetchTickets();
    }
  }

  private updateAppliedFilters(): void {
    const filters: { name: string; value: string }[] = [];
    if (this.searchQuery.trim()) filters.push({ name: 'Title', value: this.searchQuery.trim() });
    if (this.selectedStatus != null) filters.push({ name: 'Status', value: this.statusLabel(this.selectedStatus) });
    if (this.selectedPriority != null) filters.push({ name: 'Priority', value: this.priorityLabel(this.selectedPriority) });
    this.appliedFilters = filters;
  }

  removeFilter(name: string): void {
    if (name === 'Title') this.searchQuery = '';
    if (name === 'Status') this.selectedStatus = null;
    if (name === 'Priority') this.selectedPriority = null;

    this.pageIndex = 1;

    this.applyFilter();
  }

  clearFilters(): void {
    this.searchQuery = '';
    this.selectedStatus = null;
    this.selectedPriority = null;

    this.pageIndex = 1;

    this.applyFilter();
  }

  private buildQueryParams(): URLSearchParams {
    const usp = new URLSearchParams();

    const subject = this.searchQuery.trim();
    if (subject) usp.set('Subject', subject);

    if (this.selectedStatus != null) usp.set('Status', String(this.selectedStatus));
    if (this.selectedPriority != null) usp.set('Priority', String(this.selectedPriority));

    usp.set('PageNumber', String(this.pageIndex));
    usp.set('PageSize', String(this.pageSize));

    return usp;
  }

  private fetchTickets(): void {
    const usp = this.buildQueryParams();
    const url = `Tickets/getAllTickets?${usp.toString()}`;

    this.loading = true;
    this.generalService
      .commonGet(url)
      .pipe(
        takeUntil(this.destroy$),
        finalize(() => {
          this.loading = false;
          this.cdr.markForCheck();
        })
      )
      .subscribe({
        next: (res: ApiResponse<any[]>) => {
          const ok = res?.status === 1 || res?.success === true;
          if (!ok) {
            this.tickets = [];
            this.totalEntityCount = 0;
            this.generalService.showError(res?.message || 'Failed to load tickets.');
            return;
          }

          const list = Array.isArray(res?.data) ? res.data : [];

          this.tickets = list.map((x: any) => ({
            ticketId: Number(x.ticketId ?? x.id ?? 0),
            title: String(x.title ?? ''),
            description: String(x.description ?? ''),
            priority: Number(x.priority ?? TicketPriority.Medium) as TicketPriority,
            status: Number(x.status ?? TicketStatus.Pending) as TicketStatus,
            createdBy: String(x.createdBy ?? ''),
            createdDate: String(x.createdDate ?? ''),
            commentCount: Number(x.commentCount ?? 0),
            modifiedBy: x.modifiedBy ?? null,
            modifiedDate: x.modifiedDate ?? null
          }));

          this.totalEntityCount = Number(res?.totalEntityCount ?? list.length ?? 0);

          if (this.pageIndex > 1 && this.tickets.length === 0 && this.totalEntityCount > 0) {
            this.pageIndex = 1;
            this.fetchTickets();
          }
        },
        error: (err: HttpErrorResponse) => {
          console.error('Fetch tickets failed:', err);
          this.tickets = [];
          this.totalEntityCount = 0;
          this.generalService.showError(err?.message || 'Failed to load tickets.');
        }
      });
  }

  viewTicket(row: TicketRow): void {
    const id = Number(row?.ticketId ?? 0);
    if (!id) return;
    this.openTicketDetailTab({
      ticketId: id,
      title: row?.title || `Ticket #${id}`,
      priority: row?.priority ?? TicketPriority.Medium,
      status: row?.status ?? TicketStatus.Pending,
      createdBy: row?.createdBy ?? '',
      createdDate: row?.createdDate ?? '',
      commentCount: row?.commentCount ?? 0,
      modifiedBy: row?.modifiedBy ?? null,
      modifiedDate: row?.modifiedDate ?? null
    });
  }

  openTicketDetailTab(data: TicketRow | { ticketId?: number; title?: string }): void {
    const ticketId = Number(data?.ticketId ?? 0);
    if (!ticketId) return;

    const existingTab = this.detailTabs.find((tab) => tab.ticketId === ticketId);
    if (existingTab) {
      existingTab.title = data?.title || existingTab.title;
      this.activeTabKey = existingTab.key;
      this.cdr.markForCheck();
      return;
    }

    const tab: TicketDetailTab = {
      key: `ticket-${ticketId}`,
      ticketId,
      title: data?.title || `Ticket #${ticketId}`,
    };

    this.detailTabs = [...this.detailTabs, tab];
    this.activeTabKey = tab.key;
    this.cdr.markForCheck();
  }

  closeTicketDetailTab(tabKey: string): void {
    const closingIndex = this.detailTabs.findIndex((tab) => tab.key === tabKey);
    if (closingIndex < 0) return;

    const wasActive = this.activeTabKey === tabKey;
    this.detailTabs = this.detailTabs.filter((tab) => tab.key !== tabKey);

    if (wasActive) {
      const fallbackTab =
        this.detailTabs[closingIndex - 1] ?? this.detailTabs[closingIndex] ?? null;
      this.activeTabKey = fallbackTab?.key ?? this.ticketsListTabKey;
    }

    this.cdr.markForCheck();
  }

  activateTicketsListTab(): void {
    this.activeTabKey = this.ticketsListTabKey;
    this.cdr.markForCheck();
  }

  get selectedTabIndex(): number {
    if (this.activeTabKey === this.ticketsListTabKey) {
      return 0;
    }

    const detailTabIndex = this.detailTabs.findIndex((tab) => tab.key === this.activeTabKey);
    return detailTabIndex >= 0 ? detailTabIndex + 1 : 0;
  }

  onTabIndexChange(index: number): void {
    if (index <= 0) {
      this.activeTabKey = this.ticketsListTabKey;
      return;
    }

    const selectedTab = this.detailTabs[index - 1];
    this.activeTabKey = selectedTab?.key ?? this.ticketsListTabKey;
  }

  onTabClose(event: { index: number } | number): void {
    const closedIndex =
      typeof event === 'number' ? Number(event) : Number(event?.index ?? -1);
    if (closedIndex <= 0) return;

    const tab = this.detailTabs[closedIndex - 1];
    if (!tab) return;

    this.closeTicketDetailTab(tab.key);
  }

  trackByTabKey(_index: number, tab: TicketDetailTab): string {
    return tab.key;
  }

  openNewTicketModal(): void {
    this.ticketForm.reset({
      subject: '',
      description: '',
      status: TicketStatus.Pending,
      priority: TicketPriority.Medium,
      contactEmail: ''
    });

    this.isModalVisible = true;
    this.cdr.markForCheck();
  }

  closeModal(): void {
    this.isModalVisible = false;
    this.ticketForm.markAsPristine();
    this.ticketForm.markAsUntouched();
    this.cdr.markForCheck();
  }

  saveTicket(): void {
    if (this.ticketForm.invalid) {
      this.ticketForm.markAllAsTouched();
      return;
    }

    const v = this.ticketForm.getRawValue();

    const payload = {
      subject: String(v.subject || '').trim(),
      description: String(v.description || '').trim(),
      status: Number(v.status),
      priority: Number(v.priority),
      contactEmail: String(v.contactEmail || '').trim()
    };

    this.saving = true;
    this.generalService
      .commonPost('Tickets/saveTicket', payload)
      .pipe(
        takeUntil(this.destroy$),
        finalize(() => {
          this.saving = false;
          this.cdr.markForCheck();
        })
      )
      .subscribe({
        next: (res: ApiResponse<number>) => {
          const ok = res?.status === 1 || res?.success === true;
          if (!ok) {
            this.generalService.showError(res?.message || 'Failed to save ticket.');
            return;
          }

          const newId = Number(res?.data ?? 0);
          this.generalService.showSuccess(res?.message || 'Ticket created successfully.');
          this.closeModal();

          if (newId > 0) {
            this.openTicketDetailTab({
              ticketId: newId,
              title: payload.subject || `Ticket #${newId}`
            });
            this.applyFilter();
          } else {

            this.pageIndex = 1;
            this.applyFilter();
          }
        },
        error: (err: HttpErrorResponse) => {
          console.error('Save ticket failed:', err);
          this.generalService.showError(err?.message || 'Failed to save ticket.');
        }
      });
  }

  switchView(mode: 'list' | 'board'): void {
    if (this.viewMode === mode) return;
    this.viewMode = mode;
    if (mode === 'board') {

      this.selectedStatus = null;
      this.updateAppliedFilters();
      this.loadAllBoardColumns();
    } else {

      this.pageIndex = 1;
      this.fetchTickets();
    }
    this.cdr.markForCheck();
  }

  loadAllBoardColumns(): void {
    this.boardColumns.forEach(col => this.loadBoardColumn(col, true));
  }

  private loadBoardColumn(col: BoardColumn, reset = true): void {
    if (reset) {
      col.page = 1;
      col.tickets = [];
      col.hasMore = false;
      col.loading = true;
    } else {
      col.loadingMore = true;
    }
    this.cdr.markForCheck();

    const usp = new URLSearchParams();
    usp.set('Status', String(col.statusId));
    usp.set('PageNumber', String(col.page));
    usp.set('PageSize', String(this.BOARD_PAGE_SIZE));
    const subject = this.searchQuery.trim();
    if (subject) usp.set('Subject', subject);
    if (this.selectedPriority != null) usp.set('Priority', String(this.selectedPriority));

    this.generalService
      .commonGet(`Tickets/getAllTickets?${usp.toString()}`)
      .pipe(
        takeUntil(this.destroy$),
        finalize(() => {
          col.loading = false;
          col.loadingMore = false;
          this.cdr.markForCheck();
        })
      )
      .subscribe({
        next: (res: ApiResponse<any[]>) => {
          const ok = res?.status === 1 || res?.success === true;
          if (!ok) return;
          const list = Array.isArray(res?.data) ? res.data : [];
          const mapped: TicketRow[] = list.map((x: any) => ({
            ticketId: Number(x.ticketId ?? x.id ?? 0),
            title: String(x.title ?? ''),
            description: String(x.description ?? ''),
            priority: Number(x.priority ?? TicketPriority.Medium) as TicketPriority,
            status: Number(x.status ?? TicketStatus.Pending) as TicketStatus,
            createdBy: String(x.createdBy ?? ''),
            createdDate: String(x.createdDate ?? ''),
            commentCount: Number(x.commentCount ?? 0),
            modifiedBy: x.modifiedBy ?? null,
            modifiedDate: x.modifiedDate ?? null,
          }));
          col.tickets = reset ? mapped : [...col.tickets, ...mapped];
          const total = Number(res?.totalEntityCount ?? 0);
          col.hasMore = col.tickets.length < total;
        },
        error: () => {  }
      });
  }

  loadMoreColumn(col: BoardColumn): void {
    col.page++;
    this.loadBoardColumn(col, false);
  }

  onBoardDrop(event: CdkDragDrop<TicketRow[]>, targetCol: BoardColumn): void {
    if (event.previousContainer === event.container) {
      moveItemInArray(targetCol.tickets, event.previousIndex, event.currentIndex);
      this.cdr.markForCheck();
      return;
    }

    transferArrayItem(
      event.previousContainer.data,
      event.container.data,
      event.previousIndex,
      event.currentIndex
    );
    const ticket = event.container.data[event.currentIndex];
    if (!ticket) return;
    this.cdr.markForCheck();

    this.generalService
      .commonPost('Tickets/updateTicketStatus', { id: ticket.ticketId, status: targetCol.statusId })
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (res: any) => {
          if (res?.status === 1 || res?.success) {
            ticket.status = targetCol.statusId;
          } else {

            transferArrayItem(event.container.data, event.previousContainer.data, event.currentIndex, event.previousIndex);
            this.generalService.showError(res?.message || 'Failed to update status.');
          }
          this.cdr.markForCheck();
        },
        error: () => {

          transferArrayItem(event.container.data, event.previousContainer.data, event.currentIndex, event.previousIndex);
          this.generalService.showError('Failed to update ticket status.');
          this.cdr.markForCheck();
        }
      });
  }

  trackByColStatus(_i: number, col: BoardColumn): number {
    return col.statusId;
  }

  trackByTicketId(_i: number, ticket: TicketRow): number {
    return ticket.ticketId;
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }
}
