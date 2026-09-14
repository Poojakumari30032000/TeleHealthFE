import { ChangeDetectionStrategy, ChangeDetectorRef, Component, ViewChild } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { DynamicTableComponent } from '../../shared/dynamic-table/dynamic-table.component';
import { GeneralService } from '../../shared/services/general.service';
import { CommanFormModalComponent } from 'app/shared/comman-form-modal/comman-form-modal.component';
import { Subject, takeUntil } from 'rxjs';
import { Location } from "@angular/common";
import { TitleService } from 'app/shared/services/title.service';

interface PharmacyData {
  pharmacyId: number
  organizationId: number
  pharmacyName: string
  pharmacyType: string
  legalBusinesName: string
  dbaName: string
  address: string
  nabpId: string
  deaNumber: string
  stateCSLicense: string
  licenseExpiration: string
  accereditation: string
  inChargePharmacist: string
  pharmacistLicense: string
  pharmacyStorage: string[]
  is24Operation: boolean
  isCompoundingServices: boolean
  phoneNumber: string
  email: string
  emergencyContactName: string
  emergencyPhone: string
  federalTaxId: string
  medicaidNumber: string
  medicarePTAN: string
}

@Component({
  selector: 'app-pharmacy-detail-view',
  templateUrl: './pharmacy-detail-view.component.html',
  styleUrl: './pharmacy-detail-view.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class PharmacyDetailViewComponent {

  @ViewChild(DynamicTableComponent) dynamicTable!: DynamicTableComponent;
  @ViewChild('commanModel', { static: false }) commanModel!: CommanFormModalComponent;

  modalApiUrl: { save?: string; get?: string } = {
    save: 'Pharmacies/savePharmacy',
    get: 'Pharmacies/getPharmacyById?Id=',
  };
  private destroy$ = new Subject<void>();
  readonly selectedOrgId: number = Number(localStorage.getItem('OFL'));
  pharmacyData : PharmacyData  | null = null;
  pharmacyId : number = 0;
  isLoading : boolean = false;

  constructor(
    private generalService: GeneralService,
    private router: ActivatedRoute,
    private _location: Location,
    private titleService: TitleService,
    private cdr: ChangeDetectorRef
  ) {
    this.pharmacyId = Number(this.router.snapshot.paramMap.get('id'));
  }

  ngOnInit(): void{
    this.getPharmacyData();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  getPharmacyData() {
    this.isLoading = true;
    this.generalService.commonGet(`Pharmacies/getPharmacyById?Id=${this.pharmacyId}`).pipe(takeUntil(this.destroy$)).subscribe({
      next: (response) => {
        if (response?.status === 1 && response?.data) {
          this.pharmacyData = response.data;
          console.log('Pharmacy Data:', this.pharmacyData);
          this.titleService.updateTitle(
            response.data.pharmacyName,
            [
              { label: 'Pharmacies', path: '/pharmacy/view' },
              { label: 'Pharmacy Detail', path: `/pharmacy/detail/${this.pharmacyId}` }
            ]
          );
          this.isLoading = false;
          this.cdr.markForCheck();
        } else {
          console.warn('Failed to fetch Pharmacy data:', response?.message);
          this.isLoading = false;
          this.cdr.markForCheck();
        }
      },
      error: (err) => {
        console.error('API Error:', err);
        this.isLoading = false;
        this.cdr.markForCheck();
      },
    });
  }

  EditPharmacy() {
    this.modalApiUrl = {
      save: 'Pharmacies/savePharmacy',
      get: 'Pharmacies/getPharmacyById?Id=',
    }
    let title: string = 'Update Pharmacy';
    const ID = this.pharmacyId || 0;
    const formPath = 'pharmacy/add-edit-pharmacy-form.json';
    this.commanModel.showModal(title, 'form', formPath, ID);
  };

  moveBack() {
    this._location.back();
  }

  refreshTable(data: string) {
    if(data !== 'Update Pharmacy'){
      this.dynamicTable.fetchData();
    }
  }

}
