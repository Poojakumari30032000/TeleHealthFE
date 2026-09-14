import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  OnDestroy,
  OnInit,
} from '@angular/core';
import { Router } from '@angular/router';
import { debounceTime, finalize, forkJoin, of, Subject, takeUntil } from 'rxjs';
import { GeneralService } from 'app/shared/services/general.service';
import { HttpErrorResponse } from '@angular/common/http';
import { AuthService } from 'app/shared/Auth/auth.service';
import { NzTableQueryParams } from 'ng-zorro-antd/table';
import {
  AbstractControl,
  FormBuilder,
  FormControl,
  FormGroup,
  Validators,
} from '@angular/forms';
import { getUnifiedStatusBadgeClass } from 'app/shared/utils/status-badge.util';
import { PermissionsService } from 'app/shared/permission/permissions.service';

interface Product {
  drugId: number;
  productType: string;
  name: string;
  status: string;
}

interface ApiResponse {
  status: number;
  message: string;
  count: number;
  data: any;
  totalEntityCount: number;
  totalPages: number;
}

type MarkupType = 'Percentage' | 'Amount';

interface FacilityOption {
  facilityId: number;
  titlelong: string;
  titleshort: string;
}

interface CatalogItem {
  catalogId: number;
  catalogName: string;
  description: string | null;
  isActive: boolean;
  isSystemDefined: boolean;
  facilityIds: number[];
}

interface DrugBulkImportIssueRow {
  sheet: string;
  row: number;
  name?: string | null;
  message: string;
}

interface DrugBulkImportApiData {
  importSucceeded?: boolean;
  processingCompleted?: boolean;
  catalogId?: number;
  drugRowsRead?: number;
  drugsCreated?: number;
  parseAndValidationErrors?: DrugBulkImportIssueRow[];
  drugsSucceeded?: { name: string }[];
  drugsFailed?: { name?: string | null; message: string }[];
}

@Component({
  selector: 'app-drugs-list-view',
  templateUrl: './drugs-list-view.component.html',
  styleUrl: './drugs-list-view.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DrugsListViewComponent implements OnInit, OnDestroy {
  private destroy$ = new Subject<void>();
  activeTabIndex = 0;

  searchQuery: string = '';
  selectedStatus: string | null = null;
  selectedType: string = 'Drug';
  selectedCatalogId: number | null = null;
  selectedControlledSubstance: boolean | null = null;
  readonly controlledSubstanceOptions = [
    { label: 'Yes', value: true },
    { label: 'No',  value: false },
  ];
  searchTerms = new Subject<void>();
  showFilters: boolean = true;
  appliedFilters: Array<{ name: string; value: any }> = [];

  catalogFilterOptions: CatalogItem[] = [];
  catalogFilterLoading = false;

  userRole: string = this.auth.getUserRole() || '';
  facilityId?: number = this.auth.getUserFacilityId() || 0;
  canEditProduct = false;
  productTypeOptions: any[] = ['Drug'];
  productStatusOptions: any[] = ['Active', 'Archived'];
  markupTypeOptions: MarkupType[] = ['Percentage', 'Amount'];

  clinicSalePrice:number|null = null
  CSPdrugID:number|null = null

  isPricingModalVisible = false;
  isSaving = false;
  editingDrugId: number | null = null;

  isClinicPricingModalVisible : boolean = false
  CSPselectedgAtoClinicId: number | null = null

  catalogsData: CatalogItem[] = [];
  catalogsLoading = false;
  catalogsLoaded = false;
  catalogSearchQuery = '';
  catalogShowFilters = true;
  readonly catalogFacilityTagLimit = 3;
  readonly catalogDescriptionLimit = 120;
  catalogSearchTerms = new Subject<void>();
  isCatalogModalVisible = false;
  editingCatalogId: number | null = null;
  isCatalogSaving = false;
  catalogForm: FormGroup = this.fb.group({
    catalogName: ['', [Validators.required, this.noWhitespaceValidator]],
    description: [''],
    facilityIds: [[] as number[]],
  });

  drugBulkImportVisible = false;
  drugBulkImportSubmitting = false;
  drugBulkImportFile: File | null = null;
  drugBulkImportDragOver = false;
  drugBulkImportResult: DrugBulkImportApiData | null = null;
  drugBulkImportLastMessage = '';

  isUnassignModalVisible = false;
  isUnassignLoading = false;
  isUnassignSaving = false;
  unassignDrugId: number | null = null;
  unassignDrugName = '';
  facilityOptions: FacilityOption[] = [];
  selectedUnassignedFacilityIds: number[] = [];

  pricingForm: FormGroup = this.fb.group({
    name: ['', [Validators.required, this.noWhitespaceValidator]],
    strenght: ['', [Validators.required, this.noWhitespaceValidator]],
    dosageForm: ['', [Validators.required]],
    packageSize: ['', [Validators.required, this.noWhitespaceValidator]],
    controlSubstance: new FormControl<boolean | null>(null, [Validators.required]),
    markupType: ['Percentage' as MarkupType, [Validators.required]],
    price: [null as number | null, [Validators.required, Validators.min(0)]],
    markup: [null as number | null, [Validators.required, Validators.min(0)]],
    comparePrice: [{ value: null as number | null, disabled: true }],
    suggestedRetail: [null as number | null, [Validators.required, Validators.min(0)]],
    pharmacyId: [null as number | null],
  });

  pharmacyOptions: { pharmacyId: number; pharmacyName: string }[] = [];

  get showPharmacyName(): boolean {
    return Array.isArray(this.tableData) && this.tableData.some((r) => !!r?.pharmacyName);
  }

  dosageFormOptions: string[] = [
    'ANHYDROUS GEL',
    'CAPSULE',
    'CREAM',
    'GEL',
    'INJECTABLE',
    'NASAL SPRAY',
    'ODT',
    'OINTMENT',
    'OPHTHALMIC SOLUTION',
    'PATCH',
    'SOFTGEL CAPSULE',
    'SOLUTION',
    'SUPPLIES',
    'SUPPOSITORY',
    'TABLET',
    'TROCHE',
  ];

  tableData: any[] = [];
  loading = false;
  pageIndex = 1;
  pageSize = 100;
  total = 0;

  pharmacyData: any[] = [];
  pharmacyLoading = false;
  pharmaciesLoaded = false;
  isPharmacyModalVisible = false;
  editingPharmacyId: number | null = null;
  editingPharmacyRow: any = null;
  pharmacySaving = false;
  pharmacyForm: FormGroup = this.fb.group({
    pharmacyName: ['', [Validators.required, this.noWhitespaceValidator]],
  });

  constructor(
    private route: Router,
    private generalService: GeneralService,
    private auth: AuthService,
    private permissions: PermissionsService,
    private fb: FormBuilder,
    private cdr: ChangeDetectorRef
  ) {
    this.searchTerms
      .pipe(debounceTime(1000), takeUntil(this.destroy$))
      .subscribe(() => this.applyFilter());

    this.catalogSearchTerms
      .pipe(debounceTime(600), takeUntil(this.destroy$))
      .subscribe(() => this.loadCatalogs());
  }

  ngOnInit(): void {
    this.canEditProduct = this.permissions.hasAnyPermission(['product_edit']);
    this.loadCatalogFilterOptions();

    if (this.userRole === 'Global Admin') {
      this.loadPharmacyOptions();
    }

    this.pricingForm.get('price')!
      .valueChanges.pipe(takeUntil(this.destroy$))
      .subscribe(() => this.computeWholesale());
    this.pricingForm.get('markup')!
      .valueChanges.pipe(takeUntil(this.destroy$))
      .subscribe(() => this.computeWholesale());
    this.pricingForm.get('markupType')!
      .valueChanges.pipe(takeUntil(this.destroy$))
      .subscribe((markupType: MarkupType) => {
        this.applyMarkupValidators(markupType);
        this.computeWholesale();
      });

    this.applyFilter();
  }

  noWhitespaceValidator(control: AbstractControl) {
    const v = (control.value ?? '').toString();
    return v.trim().length === 0 ? { whitespace: true } : null;
  }

  onBlurTrim(event: FocusEvent, trimBoth: boolean = false): void {
    const el = event.target as HTMLInputElement | HTMLTextAreaElement | null;
    if (!el) return;

    const raw = el.value ?? '';
    let next = trimBoth ? raw.trim() : raw.replace(/\s+$/g, '');
    if (next.trim().length === 0) next = '';
    el.value = next;
    el.dispatchEvent(new Event('input', { bubbles: true }));
  }

  private normalizeMarkupType(value: any): MarkupType {
    return value === 'Amount' ? 'Amount' : 'Percentage';
  }

  private applyMarkupValidators(markupType: MarkupType): void {
    const markupControl = this.pricingForm.get('markup');
    if (!markupControl) return;

    if (markupType === 'Percentage') {
      markupControl.setValidators([Validators.required, Validators.min(0), Validators.max(100)]);
    } else {
      markupControl.setValidators([Validators.required, Validators.min(0)]);
    }

    markupControl.updateValueAndValidity({ emitEvent: false });
    this.cdr.markForCheck();
  }

  private computeWholesale(): void {
    const pharmacy = Number(this.pricingForm.get('price')!.value);
    const markup = Number(this.pricingForm.get('markup')!.value);
    const markupType = this.normalizeMarkupType(this.pricingForm.get('markupType')!.value);
    if (isFinite(pharmacy) && pharmacy >= 0 && isFinite(markup) && markup >= 0) {
      const computed = markupType === 'Amount'
        ? Number((pharmacy + markup).toFixed(2))
        : Number((pharmacy * (1 + markup / 100)).toFixed(2));
      this.pricingForm.get('comparePrice')!.setValue(computed, { emitEvent: false });
    } else {
      this.pricingForm.get('comparePrice')!.setValue(null, { emitEvent: false });
    }
  }

  get selectedUnassignedFacilityNames(): string[] {
    return (this.selectedUnassignedFacilityIds || []).map((facilityId) => {
      const facility = this.facilityOptions.find((item) => Number(item.facilityId) === Number(facilityId));
      return facility?.titlelong || facility?.titleshort || `Facility #${facilityId}`;
    });
  }

  get selectedCatalog(): CatalogItem | null {
    if (!this.selectedCatalogId) return null;
    return this.catalogFilterOptions.find(
      (catalog) => Number(catalog.catalogId) === Number(this.selectedCatalogId)
    ) || null;
  }

  get canAddDrug(): boolean {
    return !!(
      this.isCustomCatalog &&
      this.canEditProduct &&
      this.selectedCatalog &&
      !this.selectedCatalog.isSystemDefined
    );
  }

  get addDrugDisabledReason(): string {
    if (!this.selectedCatalogId) return 'Select a catalog first';
    if (!this.selectedCatalog) return 'Select a catalog first';
    if (this.selectedCatalog?.isSystemDefined) {
      return 'System catalogs are read-only for adding drugs';
    }
    return '';
  }

  get isCustomCatalog(): boolean {
    return this.activeTabIndex === 0;
  }

  onTabChange(index: number): void {
    this.activeTabIndex = index;

    if (index === 1 && this.userRole === 'Global Admin') {
      if (!this.catalogsLoaded) {
        this.ensureFacilitiesLoaded();
        this.loadCatalogs();
      }
      return;
    }

    if (index === 2 && this.userRole === 'Global Admin') {
      if (!this.pharmaciesLoaded) {
        this.loadPharmacies();
      }
      return;
    }

    if (index === 3 && this.userRole === 'Global Admin') {
      return;
    }
    this.pageIndex = 1;
    this.loadTable();
  }

  private buildGetAllProductsUrl(): string {
    if (this.userRole !== 'Global Admin') {
      const params: Record<string, string> = {
        FacilityId: this.facilityId?.toString() || '0',
        PageNumber: String(this.pageIndex),
        PageSize: String(this.pageSize),
      };
      if (this.searchQuery) params['Title'] = this.searchQuery;
      if (this.selectedStatus) params['Status'] = this.selectedStatus;
      if (this.selectedCatalogId) params['CatalogId'] = String(this.selectedCatalogId);
      if (this.selectedControlledSubstance !== null) params['ControlSubstance'] = String(this.selectedControlledSubstance);
      const qs = new URLSearchParams(params).toString();
      return `Products/GetAllDrugsForClinicByFacilityId?${qs}`;
    } else {
      const params: Record<string, string> = {
        PageNumber: String(this.pageIndex),
        PageSize: String(this.pageSize),
      };
      if (this.searchQuery) params['Title'] = this.searchQuery;
      if (this.selectedStatus) params['Status'] = this.selectedStatus;
      if (this.selectedCatalogId) params['CatalogId'] = String(this.selectedCatalogId);
      if (this.selectedControlledSubstance !== null) params['ControlSubstance'] = String(this.selectedControlledSubstance);
      const qs = new URLSearchParams(params).toString();
      return `Products/getAllDrugsForGlobalAdmin?${qs}`;
    }
  }

  loadTable(): void {
    if (!this.selectedCatalogId) {
      this.tableData = [];
      this.total = 0;
      this.loading = false;
      this.cdr.markForCheck();
      return;
    }
    this.loading = true;
    const url = this.buildGetAllProductsUrl();

    this.generalService
      .commonGet(url)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (res: ApiResponse) => {
          this.tableData = res?.data || [];
          this.total = res?.totalEntityCount ?? this.tableData.length;
          this.loading = false;
          this.cdr.markForCheck();
        },
        error: (_err: HttpErrorResponse) => {
          this.loading = false;
          this.tableData = [];
          this.total = 0;
          this.generalService.showError('Failed to fetch products.');
          this.cdr.markForCheck();
        },
      });
  }

  refreshTable() {
    this.loadTable();
  }

  onPageIndexChange(i: number) {
    this.pageIndex = i;
    this.loadTable();
  }

  onPageSizeChange(s: number) {
    this.pageSize = s;
    this.pageIndex = 1;
    this.loadTable();
  }

  onQueryParamsChange(params: NzTableQueryParams): void {
    const { pageIndex, pageSize } = params;
    if (pageIndex !== this.pageIndex || pageSize !== this.pageSize) {
      this.pageIndex = pageIndex;
      this.pageSize = pageSize;
      this.loadTable();
    }
  }

  searchTermChanged(): void {
    this.searchTerms.next();
  }

  private syncAppliedFilters(): void {
    const catalogName = this.catalogFilterOptions.find(
      (c) => c.catalogId === this.selectedCatalogId
    )?.catalogName || '';

    const csLabel = this.selectedControlledSubstance === true ? 'Yes'
      : this.selectedControlledSubstance === false ? 'No'
      : null;

    this.appliedFilters = [
      { name: 'Catalog', value: catalogName },
      { name: 'Title', value: this.searchQuery },
      { name: 'Status', value: this.selectedStatus },
      { name: 'Controlled Substance', value: csLabel },
    ].filter((f) => f.value !== null && f.value !== undefined && f.value !== '');
  }

  applyFilter(): void {
    this.syncAppliedFilters();
    this.pageIndex = 1;
    this.loadTable();
  }

  clearFilters() {
    this.appliedFilters = [];
    this.searchQuery = '';
    this.selectedStatus = null;
    this.selectedCatalogId = null;
    this.selectedControlledSubstance = null;
    this.showFilters = true;
    this.pageIndex = 1;
    this.loadTable();
  }

  removeFilter(filterName: string) {
    switch (filterName) {
      case 'Catalog':
        this.selectedCatalogId = null;
        break;
      case 'Title':
        this.searchQuery = '';
        break;
      case 'Status':
        this.selectedStatus = '';
        break;
      case 'ProductType':
        this.selectedType = '';
        break;
      case 'Controlled Substance':
        this.selectedControlledSubstance = null;
        break;
    }
    this.applyFilter();
  }

  openPricingDialog(): void {
    if (!this.canAddDrug) {
      this.generalService.showError(this.addDrugDisabledReason || 'Unable to add drug.');
      return;
    }

    this.editingDrugId = null;
    this.pricingForm.reset({
      name: '',
      strenght: '',
      dosageForm: '',
      packageSize: '',
      controlSubstance: null,
      markupType: 'Percentage',
      price: null,
      markup: null,
      comparePrice: null,
      suggestedRetail: null,
      pharmacyId: null,
    });
    this.applyMarkupValidators('Percentage');
    this.isPricingModalVisible = true;
    this.cdr.markForCheck();
  }

  openEditPricingDialog(data: any): void {
    this.editingDrugId = Number(data?.drugId || 0) || null;

    this.pricingForm.reset({
      name: data?.name ?? '',
      strenght: data?.strenght ?? '',
      dosageForm: data?.dosageForm ?? '',
      packageSize: data?.packageSize ?? '',
      controlSubstance: typeof data?.controlSubstance === 'boolean' ? data.controlSubstance : null,
      markupType: this.normalizeMarkupType(data?.markupType),
      price: data?.pharmacyPrice ?? data?.price ?? null,
      markup: data?.markupPercent ?? data?.markup ?? null,
      comparePrice: data?.wholesalePrice ?? data?.comparePrice ?? null,
      suggestedRetail: data?.suggestedRetail ?? null,
      pharmacyId: data?.pharmacyId ?? null,
    });

    this.applyMarkupValidators(this.normalizeMarkupType(data?.markupType));
    this.isPricingModalVisible = true;
    this.cdr.markForCheck();
  }

  closePricingDialog(): void {
    this.isPricingModalVisible = false;
    this.editingDrugId = null;
    this.cdr.markForCheck();
  }

  submitPricing(): void {
    this.pricingForm.markAllAsTouched();
    if (this.pricingForm.invalid) return;

    const selectedCatalog = this.selectedCatalog;
    if (!selectedCatalog || !this.selectedCatalogId) {
      this.generalService.showError('Select a catalog first.');
      return;
    }

    const raw = this.pricingForm.getRawValue();
    const payload = {
      drugId: this.editingDrugId ?? 0,
      catalogId: Number(this.selectedCatalogId),
      name: (raw.name ?? '').trim(),
      strenght: (raw.strenght ?? '').trim(),
      dosageForm: raw.dosageForm as string,
      packageSize: (raw.packageSize ?? '').trim(),
      controlSubstance: raw.controlSubstance as boolean,
      isCustom: !selectedCatalog.isSystemDefined,
      markupType: this.normalizeMarkupType(raw.markupType),

      price: raw.price as number,
      markup: raw.markup as number,
      comparePrice: raw.comparePrice as number | null,
      suggestedRetail: raw.suggestedRetail as number | null,

      pharmacyId: (raw.pharmacyId as number | null) ?? null,
    };

    this.isSaving = true;
    this.generalService
      .commonPost(selectedCatalog.isSystemDefined ? 'Products/saveDrug' : 'Products/saveCustomDrug', payload)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (res: ApiResponse) => {
          this.isSaving = false;
          if (res?.status === 1) {
            this.generalService.showSuccess(res?.message || 'Drug saved.');
            this.closePricingDialog();
            this.loadTable();
          } else {
            this.generalService.showError(res?.message || 'Failed to save.');
          }
          this.cdr.markForCheck();
        },
        error: (err: HttpErrorResponse) => {
          this.isSaving = false;
          this.generalService.showError(err?.message || 'Failed to save.');
          this.cdr.markForCheck();
        },
      });
  }

  navigateToProductDetail = (data: any) => {
    console.log(data)
    const ID: number = data.drugId || 0;
    if (!ID || ID === 0) {
      this.generalService.showError('Unable to Continue Product Id Not Found');
      return;
    }
    let url: string[] = ['product/drug', ID.toString()];
    this.route.navigate(url);
  };

  updateStatus = (data: Product): void => {
    if (!data) return;
    const apiUrl = 'Products/UpdateDrug';
    const status = (data.status === 'Active') ? 'Archived' : 'Active';
    const title = 'Confirmation';
    const content = `Are you sure you want to update the status to ${status}?`;
    const body = { drugId: data.drugId, status };

    this.generalService
      .commonConfirm(title, content)
      .pipe(takeUntil(this.destroy$))
      .subscribe((confirmed: boolean) => {
        if (confirmed) {
          this.generalService
            .commonPost(apiUrl, body)
            .pipe(takeUntil(this.destroy$))
            .subscribe({
              next: (response: ApiResponse) => {
                if (response?.status === 1 && response.data) {
                  this.generalService.showSuccess(response?.message);
                  this.loadTable();
                } else {
                  this.generalService.showError(response?.message);
                }
              },
              error: (error: HttpErrorResponse) => {
                console.error('Error updating drug status:', error);
                this.generalService.showError(error?.message);
              },
            });
        }
      });
  };

  onDelete = (data: Product): void => {
    const title = `${data.productType}: ${data.name} `;
    const id = data.drugId ;

    this.generalService.deleteDrugByID(id, title).pipe(takeUntil(this.destroy$)).subscribe({
      next: (data) => {
        console.log('Deleted data:', data);
        this.applyFilter();
      },
      error: (err) => {
        console.error('Delete failed:', err);
      },
    });
  };

  getStatusBadgeClass(status: string | null | undefined): string {
    return getUnifiedStatusBadgeClass(status);
  }

  isPercentageMarkup(row: any): boolean {
    return this.normalizeMarkupType(row?.markupType) === 'Percentage';
  }

  private parseUnassignedFacilityIds(data: any): number[] {
    if (Array.isArray(data)) {
      return data
        .map((item) => typeof item === 'number' ? item : item?.facilityId)
        .filter((id) => Number.isFinite(Number(id)))
        .map((id) => Number(id));
    }

    if (Array.isArray(data?.facilityIds)) {
      return data.facilityIds
        .filter((id: any) => Number.isFinite(Number(id)))
        .map((id: any) => Number(id));
    }

    return [];
  }

  openUnassignFacilitiesModal(data: any): void {
    const drugId = Number(data?.drugId || 0);
    if (!drugId) {
      this.generalService.showError('Unable to continue. Drug Id not found.');
      return;
    }

    this.isUnassignModalVisible = true;
    this.isUnassignLoading = true;
    this.unassignDrugId = drugId;
    this.unassignDrugName = data?.name || 'Drug';
    this.selectedUnassignedFacilityIds = [];
    this.cdr.markForCheck();

    const facilities$ = this.facilityOptions.length > 0
      ? of({ data: this.facilityOptions })
      : this.generalService.getAllFacilitiesDropdown();

    forkJoin({
      facilities: facilities$,
      unassigned: this.generalService.getDrugUnassignedFacilities(drugId),
    })
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: ({ facilities, unassigned }) => {
          this.facilityOptions = facilities?.data || [];
          this.selectedUnassignedFacilityIds = this.parseUnassignedFacilityIds(unassigned?.data);
          this.isUnassignLoading = false;
          this.cdr.markForCheck();
        },
        error: (err: HttpErrorResponse) => {
          this.isUnassignLoading = false;
          this.generalService.showError(err?.message || 'Failed to load unassigned facilities.');
          this.cdr.markForCheck();
        },
      });
  }

  closeUnassignFacilitiesModal(): void {
    this.isUnassignModalVisible = false;
    this.isUnassignLoading = false;
    this.isUnassignSaving = false;
    this.unassignDrugId = null;
    this.unassignDrugName = '';
    this.selectedUnassignedFacilityIds = [];
    this.cdr.markForCheck();
  }

  submitUnassignFacilities(): void {
    if (!this.unassignDrugId) {
      this.generalService.showError('Unable to continue. Drug Id not found.');
      return;
    }

    const payload = {
      drugId: this.unassignDrugId,
      facilityIds: (this.selectedUnassignedFacilityIds || []).map((id) => Number(id)),
    };

    this.isUnassignSaving = true;
    this.generalService
      .unassignDrugFromFacilities(payload)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (res: ApiResponse) => {
          this.isUnassignSaving = false;
          if (res?.status === 1) {
            this.generalService.showSuccess(res?.message || 'Drug unassigned successfully.');
            this.closeUnassignFacilitiesModal();
            this.loadTable();
          } else {
            this.generalService.showError(res?.message || 'Failed to unassign drug.');
            this.cdr.markForCheck();
          }
        },
        error: (err: HttpErrorResponse) => {
          this.isUnassignSaving = false;
          this.generalService.showError(err?.message || 'Failed to unassign drug.');
          this.cdr.markForCheck();
        },
      });
  }

  trackByDrugId(_index: number, data: any): number {
    return data?.drugId ?? _index;
  }

  onAdminRowActivate(row: any): void {
    if (this.isCustomCatalog) {
      if (!this.canEditProduct) return;
      this.openEditPricingDialog(row);
      return;
    }
    this.navigateToProductDetail(row);
  }

  editClinicSalePrice(data:any){
    this.isClinicPricingModalVisible = true;
    console.log(data)
    this.CSPdrugID = data.drugId
    this.CSPselectedgAtoClinicId = data.gAtoClinicId;
    this.clinicSalePrice = data.clinicSuggestedRetailPrice;
  }

  closeClinicSalePriceModal(){
    this.isClinicPricingModalVisible = false;
    this.CSPdrugID = null
    this.CSPselectedgAtoClinicId = null
    this.clinicSalePrice = null
  }

  submitEditClinicSalePrice(){

    this.isSaving = true;

    let payload = {
      drugId: this.CSPdrugID,
      gAtoClinicId: this.CSPselectedgAtoClinicId,
      facilityId: this.facilityId,
      clinicSuggestedRetailPrice: this.clinicSalePrice,
      isActive: true
    }

    console.log(payload)

    this.generalService.editClinicSalePrice(payload).subscribe((res)=>{
      console.log(res);
      this.isSaving = false;
      this.closeClinicSalePriceModal();
      this.applyFilter();
    },
    (error)=>{
      this.isSaving = false;
      console.log(error)
    }

    )
  }

  loadCatalogFilterOptions(): void {
    this.catalogFilterLoading = true;
    this.cdr.markForCheck();

    const params = new URLSearchParams({ SearchText: '' });
    if (this.userRole !== 'Global Admin' && this.facilityId) {
      params.set('FacilityId', String(this.facilityId));
    }

    this.generalService
      .commonGet(`DropDowns/getAllCatalogsDropDown?${params.toString()}`)
      .pipe(
        takeUntil(this.destroy$),
        finalize(() => {
          this.catalogFilterLoading = false;
          this.cdr.markForCheck();
        })
      )
      .subscribe({
        next: (res: any) => {
          this.catalogFilterOptions = Array.isArray(res?.data) ? res.data : [];
          this.syncAppliedFilters();
        },
        error: (_err: HttpErrorResponse) => {
          this.catalogFilterOptions = [];
          this.syncAppliedFilters();
        },
      });
  }

  loadPharmacyOptions(): void {
    this.generalService
      .commonGet('DropDowns/getAllPharmacies')
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (res: any) => {
          this.pharmacyOptions = Array.isArray(res?.data) ? res.data : [];
          this.cdr.markForCheck();
        },
        error: (_err: HttpErrorResponse) => {
          this.pharmacyOptions = [];
          this.cdr.markForCheck();
        },
      });
  }

  trackByPharmacyId = (_index: number, row: any): number => row?.pharmacyId;

  loadPharmacies(): void {
    this.pharmacyLoading = true;
    this.cdr.markForCheck();

    const params = new URLSearchParams({ PageNumber: '1', PageSize: '1000' });
    this.generalService
      .commonGet(`Pharmacies/getAllPharmacies?${params.toString()}`)
      .pipe(
        takeUntil(this.destroy$),
        finalize(() => {
          this.pharmacyLoading = false;
          this.cdr.markForCheck();
        })
      )
      .subscribe({
        next: (res: any) => {
          this.pharmacyData = Array.isArray(res?.data) ? res.data : [];
          this.pharmaciesLoaded = true;
        },
        error: (_err: HttpErrorResponse) => {
          this.pharmacyData = [];
        },
      });
  }

  openAddPharmacy(): void {
    this.editingPharmacyId = null;
    this.editingPharmacyRow = null;
    this.pharmacyForm.reset({ pharmacyName: '' });
    this.isPharmacyModalVisible = true;
    this.cdr.markForCheck();
  }

  openEditPharmacy(row: any): void {
    this.editingPharmacyId = Number(row?.pharmacyId || 0) || null;
    this.editingPharmacyRow = row;
    this.pharmacyForm.reset({ pharmacyName: row?.pharmacyName ?? '' });
    this.isPharmacyModalVisible = true;
    this.cdr.markForCheck();
  }

  closePharmacyDialog(): void {
    this.isPharmacyModalVisible = false;
    this.editingPharmacyId = null;
    this.editingPharmacyRow = null;
    this.cdr.markForCheck();
  }

  submitPharmacy(): void {
    this.pharmacyForm.markAllAsTouched();
    if (this.pharmacyForm.invalid) return;

    const name = (this.pharmacyForm.get('pharmacyName')?.value ?? '').trim();
    if (!name) return;

    const isEdit = !!this.editingPharmacyId;

    const savePayload = isEdit
      ? { ...this.editingPharmacyRow, pharmacyName: name }
      : { pharmacyId: 0, pharmacyName: name, pharmacyStorage: [] };

    this.pharmacySaving = true;
    this.cdr.markForCheck();

    this.generalService
      .commonPost('Pharmacies/savePharmacy', savePayload)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (res: any) => {
          this.pharmacySaving = false;
          if (res?.data === true) {
            this.generalService.showSuccess(isEdit ? 'Pharmacy updated successfully.' : 'Pharmacy created successfully.');
            this.closePharmacyDialog();
            this.loadPharmacies();

            this.loadPharmacyOptions();
          } else {
            this.generalService.showError(res?.message || 'Failed to save pharmacy.');
          }
          this.cdr.markForCheck();
        },
        error: (err: HttpErrorResponse) => {
          this.pharmacySaving = false;
          this.generalService.showError(err?.message || 'Failed to save pharmacy.');
          this.cdr.markForCheck();
        },
      });
  }

  togglePharmacyStatus(row: any, checked: boolean): void {
    const newStatus = checked ? 'Active' : 'Archived';
    if (!row?.pharmacyId || row.status === newStatus) return;
    row._statusSaving = true;
    this.cdr.markForCheck();
    this.generalService
      .commonPost('Pharmacies/updatePharmacyStatus', { pharmacyId: row.pharmacyId, status: newStatus })
      .pipe(
        takeUntil(this.destroy$),
        finalize(() => {
          row._statusSaving = false;
          this.cdr.markForCheck();
        })
      )
      .subscribe({
        next: (res: any) => {
          if (res?.data === true) {
            row.status = newStatus;
            this.generalService.showSuccess(newStatus === 'Active' ? 'Pharmacy activated.' : 'Pharmacy archived.');

            this.loadPharmacyOptions();
          } else {

            this.generalService.showError(res?.message || 'Failed to update status.');
          }
          this.cdr.markForCheck();
        },
        error: (err: HttpErrorResponse) => {
          this.generalService.showError(err?.message || 'Failed to update status.');
          this.cdr.markForCheck();
        },
      });
  }

  catalogSearchChanged(): void {
    this.catalogSearchTerms.next();
  }

  private ensureFacilitiesLoaded(): void {
    if (this.facilityOptions.length > 0) return;
    this.generalService
      .getAllFacilitiesDropdown()
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (res: any) => {
          this.facilityOptions = res?.data || [];
          this.cdr.markForCheck();
        },
      });
  }

  loadCatalogs(): void {
    if (this.catalogsLoading) return;
    this.catalogsLoading = true;
    this.cdr.markForCheck();

    this.generalService
      .commonGet(`Products/getAllCatalogs?SearchText=${encodeURIComponent(this.catalogSearchQuery)}`)
      .pipe(
        takeUntil(this.destroy$),
        finalize(() => {
          this.catalogsLoading = false;
          this.cdr.markForCheck();
        })
      )
      .subscribe({
        next: (res: any) => {
          this.catalogsData = Array.isArray(res?.data) ? res.data : [];
          this.catalogsLoaded = true;
        },
        error: (_err: HttpErrorResponse) => {
          this.generalService.showError('Failed to load drug catalogs.');
          this.catalogsLoaded = true;
        },
      });
  }

  openCatalogDialog(): void {
    this.editingCatalogId = null;
    this.catalogForm.reset({ catalogName: '', description: '', facilityIds: [] });
    this.ensureFacilitiesLoaded();
    this.isCatalogModalVisible = true;
    this.cdr.markForCheck();
  }

  openEditCatalogDialog(item: CatalogItem): void {
    this.editingCatalogId = item.catalogId;
    this.catalogForm.reset({
      catalogName: item.catalogName ?? '',
      description: item.description ?? '',
      facilityIds: Array.isArray(item.facilityIds) ? [...item.facilityIds] : [],
    });
    this.ensureFacilitiesLoaded();
    this.isCatalogModalVisible = true;
    this.cdr.markForCheck();
  }

  closeCatalogDialog(): void {
    this.isCatalogModalVisible = false;
    this.editingCatalogId = null;
    this.cdr.markForCheck();
  }

  submitCatalog(): void {
    this.catalogForm.markAllAsTouched();
    if (this.catalogForm.invalid) return;

    const raw = this.catalogForm.getRawValue();
    const payload = {
      catalogId: this.editingCatalogId ?? 0,
      catalogName: (raw.catalogName ?? '').trim(),
      description: (raw.description ?? '').trim() || null,
      facilityIds: Array.isArray(raw.facilityIds) ? raw.facilityIds.map(Number) : [],
    };

    this.isCatalogSaving = true;
    this.generalService
      .commonPost('Products/saveCatalog', payload)
      .pipe(
        takeUntil(this.destroy$),
        finalize(() => {
          this.isCatalogSaving = false;
          this.cdr.markForCheck();
        })
      )
      .subscribe({
        next: (res: any) => {
          if (res?.status === 1) {
            this.generalService.showSuccess(res?.message || 'Catalog saved successfully.');
            this.closeCatalogDialog();
            this.loadCatalogs();
            this.loadCatalogFilterOptions();
          } else {
            this.generalService.showError(res?.message || 'Failed to save catalog.');
          }
        },
        error: (err: HttpErrorResponse) => {
          this.generalService.showError(err?.message || 'Failed to save catalog.');
        },
      });
  }

  toggleCatalogStatus(item: CatalogItem): void {
    const nextStatus = !item.isActive;
    const label = nextStatus ? 'activate' : 'deactivate';
    this.generalService
      .commonConfirm('Confirmation', `Are you sure you want to ${label} "${item.catalogName}"?`)
      .pipe(takeUntil(this.destroy$))
      .subscribe((confirmed: boolean) => {
        if (!confirmed) return;
        this.generalService
          .commonPost('Products/updateCatalogStatus', {
            catalogId: item.catalogId,
            isActive: nextStatus,
          })
          .pipe(takeUntil(this.destroy$))
          .subscribe({
            next: (res: any) => {
              if (res?.status === 1) {
                this.generalService.showSuccess(res?.message || 'Status updated.');
                this.loadCatalogs();
                this.loadCatalogFilterOptions();
              } else {
                this.generalService.showError(res?.message || 'Failed to update status.');
              }
            },
            error: (err: HttpErrorResponse) => {
              this.generalService.showError(err?.message || 'Failed to update status.');
            },
          });
      });
  }

  get allFacilitiesSelected(): boolean {
    const ids: number[] = this.catalogForm.get('facilityIds')?.value ?? [];
    return this.facilityOptions.length > 0 && ids.length === this.facilityOptions.length;
  }

  toggleSelectAllFacilities(): void {
    const control = this.catalogForm.get('facilityIds')!;
    control.setValue(
      this.allFacilitiesSelected ? [] : this.facilityOptions.map((f) => f.facilityId)
    );
    this.cdr.markForCheck();
  }

  getCatalogFacilityNames(item: CatalogItem): string[] {
    if (!Array.isArray(item.facilityIds)) return [];
    return item.facilityIds.map((id) => {
      const opt = this.facilityOptions.find((o) => Number(o.facilityId) === Number(id));
      return opt?.titlelong || opt?.titleshort || `Facility #${id}`;
    });
  }

  getVisibleCatalogFacilityNames(item: CatalogItem): string[] {
    return this.getCatalogFacilityNames(item).slice(0, this.catalogFacilityTagLimit);
  }

  getHiddenCatalogFacilityCount(item: CatalogItem): number {
    return Math.max(this.getCatalogFacilityNames(item).length - this.catalogFacilityTagLimit, 0);
  }

  getHiddenCatalogFacilityTooltip(item: CatalogItem): string {
    return this.getCatalogFacilityNames(item).slice(this.catalogFacilityTagLimit).join(', ');
  }

  getTruncatedCatalogDescription(description: string | null | undefined): string {
    const value = (description || '').trim();
    if (!value) return '—';
    if (value.length <= this.catalogDescriptionLimit) return value;
    return `${value.slice(0, this.catalogDescriptionLimit)}....`;
  }

  hasLongCatalogDescription(description: string | null | undefined): boolean {
    return (description || '').trim().length > this.catalogDescriptionLimit;
  }

  trackByCatalogId(_index: number, item: CatalogItem): number {
    return item.catalogId ?? _index;
  }

  openDrugBulkImportModal(): void {
    if (!this.selectedCatalogId) {
      this.generalService.showError('Select a catalog first.');
      return;
    }
    this.resetDrugBulkImportState();
    this.drugBulkImportVisible = true;
    this.cdr.markForCheck();
  }

  closeDrugBulkImportModal(): void {
    if (this.drugBulkImportSubmitting) {
      return;
    }
    this.drugBulkImportVisible = false;
    this.resetDrugBulkImportState();
    this.cdr.markForCheck();
  }

  resetDrugBulkImportState(): void {
    this.drugBulkImportFile = null;
    this.drugBulkImportDragOver = false;
    this.drugBulkImportResult = null;
    this.drugBulkImportLastMessage = '';
  }

  downloadDrugBulkImportTemplate(): void {
    const cid = this.selectedCatalogId;
    if (!cid) {
      this.generalService.showError('Select a catalog first.');
      return;
    }
    this.generalService.downloadDrugBulkImportTemplate(cid).subscribe({
      next: (blob) => {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'Drug_Bulk_Import_Template.xlsx';
        a.click();
        URL.revokeObjectURL(url);
        this.generalService.showSuccess('Template download started.');
      },
      error: () => {
        this.generalService.showError('Could not download the template. Check the catalog and try again.');
      },
    });
  }

  onDrugBulkFileInputChange(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0] ?? null;
    this.setDrugBulkImportFile(file);
    input.value = '';
  }

  setDrugBulkImportFile(file: File | null): void {
    this.drugBulkImportResult = null;
    this.drugBulkImportLastMessage = '';
    if (!file) {
      this.drugBulkImportFile = null;
      this.cdr.markForCheck();
      return;
    }
    const ext = file.name.split('.').pop()?.toLowerCase();
    if (ext !== 'xlsx') {
      this.drugBulkImportFile = null;
      this.generalService.showError('Please choose an Excel .xlsx file.');
      this.cdr.markForCheck();
      return;
    }
    this.drugBulkImportFile = file;
    this.cdr.markForCheck();
  }

  onDrugBulkDrop(event: DragEvent): void {
    event.preventDefault();
    event.stopPropagation();
    this.drugBulkImportDragOver = false;
    const file = event.dataTransfer?.files?.[0] ?? null;
    this.setDrugBulkImportFile(file);
  }

  onDrugBulkDragOver(event: DragEvent): void {
    event.preventDefault();
    event.stopPropagation();
    this.drugBulkImportDragOver = true;
  }

  onDrugBulkDragLeave(event: DragEvent): void {
    event.preventDefault();
    event.stopPropagation();
    this.drugBulkImportDragOver = false;
  }

  runDrugBulkImport(): void {
    if (!this.drugBulkImportFile || this.drugBulkImportSubmitting || !this.selectedCatalogId) {
      return;
    }
    this.drugBulkImportSubmitting = true;
    this.drugBulkImportResult = null;
    this.drugBulkImportLastMessage = '';
    this.cdr.markForCheck();

    this.generalService
      .bulkImportDrugsExcel(this.drugBulkImportFile, this.selectedCatalogId)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (res: any) => {
          this.drugBulkImportSubmitting = false;
          this.drugBulkImportLastMessage = res?.message ?? '';
          this.drugBulkImportResult = (res?.data ?? null) as DrugBulkImportApiData | null;
          const d = this.drugBulkImportResult;
          const anyCreated = (d?.drugsCreated ?? 0) > 0;
          if (res?.status === 1 && anyCreated) {
            this.loadTable();
          }
          if (res?.status === 1 && d?.importSucceeded && this.hasDrugBulkImportFailures(d)) {
            this.generalService.showError(
              'Import finished with some failures. Review the tables below, fix your spreadsheet, and re-import only the corrected rows.'
            );
          } else if (res?.status === 1 && d?.importSucceeded) {
            this.generalService.showSuccess(this.drugBulkImportLastMessage || 'Import completed.');
          } else if (res?.status === 0) {
            this.generalService.showError(this.drugBulkImportLastMessage || 'Import failed.');
          }
          this.cdr.markForCheck();
        },
        error: () => {
          this.drugBulkImportSubmitting = false;
          this.generalService.showError('Import request failed.');
          this.cdr.markForCheck();
        },
      });
  }

  trackByDrugBulkIssue(_i: number, row: DrugBulkImportIssueRow): string {
    return `${row.sheet}-${row.row}-${row.name ?? ''}-${row.message}`;
  }

  hasDrugBulkImportFailures(d: DrugBulkImportApiData | null): boolean {
    if (!d) {
      return false;
    }
    return (
      (d.parseAndValidationErrors?.length ?? 0) > 0 ||
      (d.drugsFailed?.length ?? 0) > 0
    );
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }
}
