import { ChangeDetectionStrategy, ChangeDetectorRef, Component, ViewChild } from '@angular/core';
import { Router } from '@angular/router';
import { DynamicTableComponent } from '../../shared/dynamic-table/dynamic-table.component';
import { debounceTime, Subject, takeUntil } from 'rxjs';
import { GeneralService } from 'app/shared/services/general.service';
import { AuthService } from 'app/shared/Auth/auth.service';
import { CommanFormModalComponent } from 'app/shared/comman-form-modal/comman-form-modal.component';

interface Payment {
  patientPaymentId : number;
}

@Component({
  selector: 'app-payment-list-view',
  templateUrl: './payment-list-view.component.html',
  styleUrl: './payment-list-view.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class PaymentListViewComponent {

  @ViewChild(DynamicTableComponent) dynamicTable!: DynamicTableComponent;
  @ViewChild(CommanFormModalComponent) commanModel!: CommanFormModalComponent;

  activeTab: string = 'Payments';
  showFilters: boolean = false;
  appliedFilters: any[] = [];
  private destroy$ = new Subject<void>();
  searchTerms = new Subject<void>();
  searchQuery: string = '';
  selectedFacility: string = localStorage.getItem('FOSG') || '';
  providerId: number = 0;
  patientId: number = 0;
  modalApiUrl : { save?: string; get?: string } = {
    save : 'Patients/updateStatus',
    get : 'Patients/getStatus?Type=Payment&Id='
  };

  constructor( private route : Router, private cdr: ChangeDetectorRef, private generalService: GeneralService, private auth: AuthService ){
    this.searchTerms
      .pipe(debounceTime(1000), takeUntil(this.destroy$))
      .subscribe(() => {
        this.applyFilter();
      });

    const userRole = this.auth.getUserRole();
    const userId = this.auth.getUserId() || 0;
    if(userRole === 'Provider'){
      this.providerId = userId;
    }else if(userRole === 'Patient'){
      this.patientId = userId;
    }

    this.applyFilter();
  }

  ngOnInit() {

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
      { name: 'FacilityGuid', value: this.selectedFacility },
      { name: 'Title', value: this.searchQuery },
      { name: 'ProviderId', value: this.providerId },
      { name: 'PatientId', value: this.patientId }
    ];
    this.appliedFilters = this.appliedFilters.filter(filter => filter.value !== null && filter.value !== undefined && filter.value !== '' && filter.value !== 0);
  }

  get visibleFiltersCount(): number {
    return this.appliedFilters.filter(f => !this.shouldHideAppliedFilter(f.name)).length;
  }

  shouldHideAppliedFilter(filterName: string): boolean {
    if (!filterName) return false;
    if(filterName === 'FacilityGuid')return true;
    if(filterName === 'ProviderId')return true;
    if(filterName === 'PatientId')return true;
    return false;
  }

  trackByFilterName(_index: number, filter: any): string {
    return filter.name;
  }

  clearFilters() {
    this.searchQuery = '';
    this.showFilters = false;
    this.applyFilter();
  }

  removeFilter(filterName: string) {
    switch(filterName) {
      case 'Title':
        this.searchQuery = '';
        break;
    }
    this.applyFilter();
  }

  onTabChange(event: any): void {
    this.activeTab = event.tab.nzTitle;
    this.cdr.detectChanges();
  }

  navigateToOrderDetail = (data: Payment) => {
    const ID = data.patientPaymentId || 0;
    if(!ID || ID === 0){
      this.generalService.showError('Unable to Continue Order Id Not Found');
      return;
    }
    this.route.navigate(['order/detail', ID]);
  };

  updatePaymentStatus = (data: Payment) => {
    let title: string = 'Update Payment Status';
    const ID = data.patientPaymentId || 0;
    const formPath = 'statusUpdates/update-payment-status-form.json';
    this.commanModel.showModal(title, 'form', formPath, ID);
  };

  navigateToInvoice = (data: any) => {
    const invoiceId = data?.patientPaymentId || 0;
    if (!invoiceId || invoiceId === 0) {
        this.generalService.showError('Invoice ID not found');
        return;
    }
    this.route.navigate(['/billing/invoice/detail', invoiceId]);
};

}
