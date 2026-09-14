import { ChangeDetectionStrategy, Component, ViewChild } from '@angular/core';
import { Router } from '@angular/router';
import { DynamicTableComponent } from '../../shared/dynamic-table/dynamic-table.component';
import { GeneralService } from '../../shared/services/general.service';
import { Subject } from 'rxjs';
import { debounceTime, takeUntil } from 'rxjs/operators';
import { CommanFormModalComponent } from 'app/shared/comman-form-modal/comman-form-modal.component';

interface Pharmacy {
  pharmacyId: number;
  status: string;
}

@Component({
  selector: 'app-pharmacy-list-view',
  templateUrl: './pharmacy-list-view.component.html',
  styleUrl: './pharmacy-list-view.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush

})
export class PharmacyListViewComponent {

  @ViewChild(DynamicTableComponent) dynamicTable!: DynamicTableComponent;
  @ViewChild('commanModel', { static: false })
  commanModel!: CommanFormModalComponent;

  modalApiUrl: { save?: string; get?: string } = {
    save: 'Pharmacies/savePharmacy',
    get: 'Pharmacies/getPharmacyById?Id=',
  };
  showFilters: boolean = false;
  appliedFilters: any[] = [];
  pharmacyTitle: string = '';
  selectedStatus: string = '';
  searchTerms = new Subject<void>();
  private destroy$ = new Subject<void>();

  constructor(
    private route: Router,
    private generalService: GeneralService
  ) {
    this.searchTerms
      .pipe(debounceTime(1000), takeUntil(this.destroy$))
      .subscribe(() => {
        this.applyFilter();
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
      { name: 'PharmacyName', value: this.pharmacyTitle },
      { name: 'Status', value: this.selectedStatus }
    ].filter(filter => filter.value !== null && filter.value !== undefined && filter.value !== '');
  }

  clearFilters() {
    this.pharmacyTitle = '';
    this.selectedStatus = '';
    this.showFilters = false;
    this.applyFilter();
  }

  removeFilter(filterName: string) {
    switch(filterName) {
      case 'PharmacyName':
        this.pharmacyTitle = '';
        break;
      case 'Status':
        this.selectedStatus = '';
        break;
    }
    this.applyFilter();
  }

  refreshTable() {
    this.dynamicTable.fetchData();
  }

  AddEditPharmacy = (data?: Pharmacy) => {
    let title: string = 'Add Pharmacy';
    const ID = data?.pharmacyId || 0;
    const formPath = 'pharmacy/add-edit-pharmacy-form.json';
    if (data) {
      title = 'Update Pharmacy';
    }
    this.commanModel.showModal(title, 'form', formPath, ID);
  };

  updateStatus = (data: Pharmacy): void => {
    const apiUrl = 'Pharmacies/updatePharmacyStatus';
    const title = 'Confirmation';
    const status = data.status === 'Active' ? 'InActive' : 'Active';
    const content = `Are you sure you want to update the pharmacy status to ${status}?`;
    const body = {
      pharmacyId: data.pharmacyId,
      status: status,
    };
    this.generalService.commonConfirm(title, content).pipe(takeUntil(this.destroy$)).subscribe((result) => {
        if (result) {
          this.generalService.commonPost(apiUrl, body).pipe(takeUntil(this.destroy$)).subscribe({
            next: (res) => {
              if (res.status === 1) {
                this.generalService.showSuccess(
                  `Status updated to ${status} successfully!`
                );
                this.dynamicTable.fetchData();
              } else {
                this.generalService.showError(
                  res.message || 'Failed to update status'
                );
              }
            },
            error: (err) => {
              console.error('Error updating status:', err);
              this.generalService.showError(
                'Failed to update facility status.'
              );
            }
          });
        }
    });
  };

  onDelete = (data: Pharmacy): void => {
    const apiUrl = 'Pharmacies/deletePharmacy';
    const title = 'Pharmacy';
    const body = {
      id: data.pharmacyId,
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

  onView = (data: Pharmacy) => {
    const ID = data.pharmacyId || 0;
    if(!ID || ID === 0){
      this.generalService.showError('Unable to Continue Pharmacy Id Not Found');
      return;
    }
    this.route.navigate(['pharmacy/detail', data.pharmacyId]);
  }

}
