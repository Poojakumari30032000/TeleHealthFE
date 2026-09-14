import {
  ChangeDetectionStrategy,
  Component,
  ViewChild,
} from '@angular/core';
import { AuthService } from 'app/shared/Auth/auth.service';
import { CommanFormModalComponent } from 'app/shared/comman-form-modal/comman-form-modal.component';
import { DynamicTableComponent } from 'app/shared/dynamic-table/dynamic-table.component';
import { GeneralService } from 'app/shared/services/general.service';
import { debounceTime, Subject, takeUntil } from 'rxjs';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { Router } from '@angular/router';

interface TicketData {
  ticketId: number;
  subject: string;
  description: string;
}

@Component({
  selector: 'app-support-list-view',
  templateUrl: './support-list-view.component.html',
  styleUrl: './support-list-view.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class SupportListViewComponent {

  @ViewChild(DynamicTableComponent) dynamicTable!: DynamicTableComponent;
  @ViewChild(CommanFormModalComponent) commanModel!: CommanFormModalComponent;

  ticketTypeOptions = [
    'Tech',
    'Customer Support',
  ];

  ticketStatusOptions = [
    'Pending',
    'Completed',
    'On Hold',
    'Feedback',
    'Urgent',
  ];

  appliedFilters: any[] = [];
  private destroy$ = new Subject<void>();
  searchTerms = new Subject<void>();
  searchQuery: string = '';
  selectedFacility: string = localStorage.getItem('FOS') || '';
  selectedTicketStatus: string | null = null;

  providerId: number = 0;
  patientId: number = 0;
  showFilters : boolean = false;

  userRole: string = '';
  modalApiUrl : { save?: string; get?: string } = {
    save : 'Tickets/updateTicketStatus',
    get : 'Tickets/getTicketById?Id='
  };

  description: SafeHtml = '';
  isVisible : boolean = false;

  constructor(
    private generalService: GeneralService,
    private auth: AuthService,
    private sanitizer: DomSanitizer,
    private route: Router
  ) {
    this.searchTerms
      .pipe(debounceTime(1000), takeUntil(this.destroy$))
      .subscribe(() => {
        this.applyFilter();
      });

    this.userRole = this.auth.getUserRole() || '';
    const userId = this.auth.getUserId() || 0;
    if(this.userRole === 'Provider'){
      this.providerId = userId;
    }else if(this.userRole === 'Patient'){
      this.patientId = userId;
    }

    this.applyFilter();
  }

  ngOnInit() {
    this.generalService
      .getData()
      .pipe(takeUntil(this.destroy$))
      .subscribe((response) => {
        if (response && response.type === 'facilityChanged') {
          if (response.value.facilityId === this.selectedFacility) return;
          this.selectedFacility = response.value.facilityId || this.selectedFacility;
          this.applyFilter();
        }
      });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  searchTermChanged(): void {
    this.searchTerms.next();
  }

  applyFilter(): void {
    this.appliedFilters = [
      { name: 'FacilityId', value: this.selectedFacility },
      { name: 'Subject', value: this.searchQuery },
      { name: 'Status', value: this.selectedTicketStatus },
      { name: 'ProviderId', value: this.providerId },
      { name: 'PatientId', value: this.patientId },
    ];
    this.appliedFilters = this.appliedFilters.filter(
      filter =>
        filter.value !== null &&
        filter.value !== undefined &&
        filter.value !== '' &&
        filter.value !== 0
    );
  }

  get visibleFiltersCount(): number {
    return this.appliedFilters.filter(f => !this.shouldHideAppliedFilter(f.name)).length;
  }

  shouldHideAppliedFilter(filterName: string): boolean {
    return filterName === 'ProviderId' || filterName === 'PatientId';
  }

  trackByFilterName(_index: number, filter: any): string {
    return filter.name;
  }

  clearFilters() {
    this.searchQuery = '';
    this.selectedTicketStatus = null;
    this.applyFilter();
    this.showFilters = false;
  }

  removeFilter(filterName: string) {
    switch(filterName) {
      case 'Title':
        this.searchQuery = '';
        break;
      case 'Status':
        this.selectedTicketStatus = '';
        break;
    }
    this.applyFilter()
  }

  onRefresh() {
    this.dynamicTable.fetchData();
  }

  AddEditTicket = (data?: TicketData) => {
    const ID = data?.ticketId || 0;
    if(ID){
      this.route.navigate(['support/detail', ID]);
      return;
    }
    this.route.navigate(['support/detail']);
  };

  ticketDescription  = (data?: TicketData) => {
    if (!data) return;
    this.description = this.safeHtml(data.description);
    this.isVisible = true;
  }

  closeModal(): void {
    this.isVisible = false;
  }

  safeHtml(html: string): SafeHtml {
    return this.sanitizer.bypassSecurityTrustHtml(html);
  }

  updateTicketStatus = (data?: TicketData) => {
    let title: string = 'Update Ticket Status';
    const ID = data?.ticketId || 0;
    const formPath = 'support-ticket/update-ticket-status-form.json';
    this.commanModel.showModal(title, 'form', formPath, ID);
  };

  onDelete = (data: TicketData): void => {
    const apiUrl = 'Products/deleteProduct';
    const title = `${data.subject} `;
    const body = {
      id: data.ticketId,
    };
    this.generalService.commonDelete(apiUrl, title, body).pipe(takeUntil(this.destroy$)).subscribe({
      next: (data) => {
        console.log('Deleted data:', data);
        this.dynamicTable.fetchData();
      },
      error: (err) => {
        console.error('Delete failed:', err);
      },
    });
  };
}
