import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  Input,
  SimpleChanges,
  ViewChild
} from '@angular/core';
import { OrderDetailViewComponent } from 'app/order/order-detail-view/order-detail-view.component';
import { ActivatedRoute, Router } from '@angular/router';
import { Location } from "@angular/common";
import { GeneralService } from 'app/shared/services/general.service';
import {
  catchError,
  debounceTime,
  distinctUntilChanged,
  finalize,
  map,
  Observable,
  Observer,
  of,
  Subject,
  switchMap,
  takeUntil
} from 'rxjs';
import { AuthService } from 'app/shared/Auth/auth.service';
import { TitleService } from 'app/shared/services/title.service';
import {NzUploadFile, NzUploadTransformFileType} from 'ng-zorro-antd/upload';
import { environment } from 'environments/environment';
import { NzModalService } from 'ng-zorro-antd/modal';
import { getUnifiedStatusBadgeClass } from 'app/shared/utils/status-badge.util';

interface PrescriptionData {
  patientId: number;
  firstName: string;
  lastName: string;
  email: string;
  phoneNumber: string;
  address: string;
  gender: string;
  dob: string;
  city: string;
  state: string;
  pharmacyName: string | null;
  mrn: string;
  prescriptionId: number;
  writtenDate: string;
  expirationDate: string | null;
  visitStatus: string | null;
  subscriptionStatus: string | null;
  numberOfRefills: number | null;
  refillsRemaining: number | null;
  productVarient: string | null;
  drugName: string | null;
  packageNDC: string | null;
  orderId: number;
  orderDate: string | null;
  orderStatus: string | null;
  createdBy: string;
  lastEditedDate: string | null;
  presImage: string | null;
  controlledSubImage: string | null;
  modifiedBy?: string | null;
  treatmentId: number;
  provider?: {
    providerId: number;
    providerName: string;
    email: string;
    phone: string;
    providerType: string;
    npi: string;
    dea: string;
    address: string;
    city: string;
    state: string;
    zipCode: string;
  } | null;
}

interface PrescriptionDetails {
  patientName: string;
  medication: string;
  issuedOn: string;
  dateRXWritten: string;
  quantity: number;
  refills: number;
  expireOn: string;
  isDAW: boolean;
  prescriptionInstruction: string;
  prescribedBy: string;
  npi: string;
  address: string;
  phone: string;
}

interface ControlledPrescriptionDrug {
  medicineName: string;
  strength: string;
  dosageForm: string;
  packageSize: string;
  quantity: string;
  daysSupplies: string;
  refills: string;
  direction: string;
  instruction: string;
}

interface CatalogOption {
  catalogId: number;
  catalogName: string;
  description: string | null;
  isActive: boolean;
  isSystemDefined: boolean;
}

type EmbeddedTabNavigationRequest = {
  type: 'order' | 'prescription' | 'treatmentMain';
  id?: number;
  data?: any;
};

@Component({
  selector: 'app-prescription-detail-view',
  templateUrl: './prescription-detail-view.component.html',
  styleUrl: './prescription-detail-view.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class PrescriptionDetailViewComponent {
  @Input() prescriptionIdInput: number | null = null;
  @Input() embeddedInTabs = false;
  @Input() openInTreatmentTabs: ((request: EmbeddedTabNavigationRequest) => void) | null = null;

  activeTab: string = 'Prescription Details';
  timelineData = [
    { date: 'April 2025', events: ['DR Jonah Mink MD resent the prescription(s) to THE PHARMACY HUB LLC Pharmacy'] },
    { date: 'March 2025', events: ['Delivered email notification is sent to gacraigw@gmail.com', 'Delivered SMS notification is sent to (404) 735-9623'] },
    { date: 'February 2025', events: ['Order has been delivered for this patient.'] },
  ];
  expandedIndices: number[] = [];
  modalApiUrl: { save?: string; get?: string } = { save: '', get: '' };
  readonly selectedOrgId: number = Number(localStorage.getItem('OFL'));
  prescriptionId: number = 0;
  prescriptionData: PrescriptionData | null = null;
  prescriptionDetail: PrescriptionDetails | null = null;
  hasError: boolean = false;
  isLoading: boolean = false;
  private destroy$ = new Subject<void>();
  userName: string = this.auth.getUserName() || '';
  userRole = '';

  activeTabIndex = 0;

  orderIdForTab = 0;

  @ViewChild(OrderDetailViewComponent)
  private orderDetailViewRef?: OrderDetailViewComponent;

  showAsPerRole: boolean = false;

  showAsPerOrderStatus: boolean = false;

  btnLoading = false;

  updatedWrittenDate: Date | null = null;

  prescriptionUploadLoading: boolean = false;
  isDisabled: boolean = false;
  uploadUrl: string = `${environment.IAMGE_PATH}/api/Commons/UploadFile`;

  addDrugsModalVisible: boolean = false;
  modalCatalogId: number | null = null;
  modalDrugs: any[] = [];
  modalSupplies: any[] = [];
  modalCatalogLoading = false;
  modalDrugsLoading = false;
  modalSuppliesLoading = false;
  modalDrugSearchTerm = '';
  modalSupplySearchTerms: Record<number, string> = {};
  activeSupplySearchIndex: number | null = null;
  suppliesFormList: any[] = [];
  row: any = {};
  supplyColumns: any[] = [];
  model: any = null
  editingDrugIndex: number | null = null;
  drugQuantity: number | null = null;
  drugDirections: string = '';
  drugInstructions: string = '';
  isFormSubmitting: boolean = false;
  listOfDrugs: any[] = [];
  courierMethodDropdownData: any[] = [];
  courierMethod: string = '';
  daysSupplies: number | null = null;
  selectedSyringe: any | null = null;
  syringeQuantity: number | null = null;
  selectedNeedle: any | null = null;
  needleQuantity: number | null = null;

  catalogOptions: CatalogOption[] = [];
  catalogOptionsLoading = false;
  readonly modalSearchMinLength = 3;
  private readonly modalDrugSearch$ = new Subject<string>();
  private readonly modalSupplySearch$ = new Subject<{ index: number; term: string }>();

  constructor(
    private route: Router,
    private cdr: ChangeDetectorRef,
    private _location: Location,
    private generalService: GeneralService,
    private router: ActivatedRoute,
    private auth: AuthService,
    private titleService: TitleService,
    private modal: NzModalService
  ) {
    this.expandedIndices = this.timelineData.map((_, index) => index);
  }

  ngOnInit(): void {
    this.userRole = this.auth.getUserRole() || '';
    if(this.userRole == 'Global Admin' || this.userRole == 'Provider'){
      this.showAsPerRole = true
    }
    this.setupModalRemoteSearch();
    this.loadCatalogOptionsDropdown();
    this.resolveAndLoadPrescription();
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['prescriptionIdInput'] && !changes['prescriptionIdInput'].firstChange) {
      this.resolveAndLoadPrescription();
    }
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  private resolveAndLoadPrescription(): void {
    const inputId = Number(this.prescriptionIdInput || 0);
    const routeId = Number(this.router.snapshot.paramMap.get('id') || 0);
    const resolvedId = inputId > 0 ? inputId : routeId;

    if (!resolvedId) {
      this.prescriptionData = null;
      this.isLoading = false;
      this.cdr.markForCheck();
      return;
    }

    if (this.prescriptionId !== resolvedId) {
      this.prescriptionId = resolvedId;
      this.loadAllPrescriptionData();
      return;
    }

    if (!this.prescriptionData && !this.isLoading) {
      this.loadAllPrescriptionData();
    }
  }

  private loadAllPrescriptionData(): void {
    this.getPrescriptionData();
    this.getPrescriptionDetails();
    this.getAllDeliveryMethods();
    this.getPatientPrescriptionMedicines();
  }

  addSupplies(){
    this.suppliesFormList.push({
      supply: null,
      name:null,
      supplyQuantity: null,
      supplyItemDesignatorID: null,
      direction: null,
    });
    this.setModalSupplyResults(this.suppliesFormList.length - 1, []);
    this.cdr.markForCheck();
  }

  removeSupply(index:number){
    this.suppliesFormList.splice(index,1);
    delete this.modalSupplySearchTerms[index];
    if (this.activeSupplySearchIndex === index) {
      this.activeSupplySearchIndex = null;
      this.modalSupplies = [];
      this.modalSuppliesLoading = false;
    }
    this.cdr.markForCheck();
  }

  getAllDeliveryMethods(){
    this.generalService.GetShippingTypes().subscribe((response) => {
      this.courierMethodDropdownData = response.shippingTypeItems || [];
      this.cdr.markForCheck();
    });
  }

  getPrescriptionData(): void {
    if (!this.prescriptionId) return;

    this.isLoading = true;
    this.hasError = false;
    this.showAsPerOrderStatus = false;
    this.generalService
      .commonGet(`PatientPrescriptions/getPatientPrescriptionInfo?Id=${this.prescriptionId}`)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (response) => {
          if (response?.status === 1 && response?.data) {
            this.prescriptionData = response.data as PrescriptionData;

            this.updatedWrittenDate = this.toDateOrNull(this.prescriptionData.writtenDate);
            this.showAsPerOrderStatus =
              this.prescriptionData.orderStatus === 'Pending' ||
              this.prescriptionData.orderStatus === 'Created';

            if (!this.embeddedInTabs) {
              this.titleService.updateTitle(
                response.data.firstName + ' ' + response.data.lastName,
                [
                  { label: 'Prescriptions', path: '/prescription/view' },
                  { label: 'Prescription Detail', path: `/prescription/detail/${this.prescriptionId}` }
                ]
              );
            }

            this.isLoading = false;
          } else {
            console.error(response?.message);
            this.hasError = true;
          }
          this.isLoading = false;
          this.cdr.detectChanges();
        },
        error: (err) => {
          console.error(err);
          this.isLoading = false;
          this.hasError = true;
          this.cdr.detectChanges();
        }
      });
  }

  getPrescriptionDetails(): void {
    if (!this.prescriptionId) return;

    this.generalService
      .commonGet(`PatientPrescriptions/getPatientPrescriptionDetails?Id=${this.prescriptionId}`)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (response) => {
          if (response?.status === 1 && response?.data) {
            this.prescriptionDetail = response.data;
          } else {
            console.error(response?.message);
          }
          this.cdr.detectChanges();
        }
      });
  }

  onTabChange(event: any): void {
    this.activeTab = event.tab.nzTitle;
    this.cdr.detectChanges();
  }

  toggleTimeline(index: number): void {
    if (this.expandedIndices.includes(index)) {
      this.expandedIndices = this.expandedIndices.filter(i => i !== index);
    } else {
      this.expandedIndices.push(index);
    }
  }

  isExpanded(index: number): boolean {
    return this.expandedIndices.includes(index);
  }

  moveBack() {
    if (this.embeddedInTabs) return;
    this._location.back();
  }

  private requestEmbeddedTabOpen(request: EmbeddedTabNavigationRequest): boolean {
    if (!this.embeddedInTabs || !this.openInTreatmentTabs) return false;
    this.openInTreatmentTabs(request);
    return true;
  }

  navigate(route: string) {
    if (route?.startsWith('order/detail/')) {
      const orderId = Number(route.split('/').pop() || 0);

      if (orderId && this.requestEmbeddedTabOpen({ type: 'order', id: orderId })) return;

      this.orderIdForTab = orderId || this.prescriptionData?.orderId || 0;
      this.activeTabIndex = 1;
      this.cdr.markForCheck();
      return;
    }
    if (route?.startsWith('treatment/detail/')) {
      if (this.requestEmbeddedTabOpen({ type: 'treatmentMain' })) return;
    }
    this.route.navigate([route]);
  }

  getStatusBadgeClass(status: string | null | undefined): string {
    return getUnifiedStatusBadgeClass(status);
  }

  beforeUpload = (file: NzUploadFile, _fileList: NzUploadFile[]): Observable<boolean> =>
    new Observable((observer: Observer<boolean>) => {
      const isImage = file.type?.startsWith('image/');
      console.log(file)
      if (!isImage) {
        this.generalService.showError('You can only upload Images!');
        observer.complete();
        return;
      }

      const isLt2M = file.size! / 1024 / 1024 < 2;
      if (!isLt2M) {
        this.generalService.showError('Image must be smaller than 2MB!');
        observer.complete();
        return;
      }

      observer.next(isImage && isLt2M);
      observer.complete();
    });

  beforeUploadControlled = (file: NzUploadFile, _fileList: NzUploadFile[]): Observable<boolean> =>
    new Observable((observer: Observer<boolean>) => {
      const isImage = file.type?.startsWith('image');
      console.log(file)
      if (!isImage) {
        this.generalService.showError('You can only upload Images!');
        observer.complete();
        return;
      }

      const isLt2M = file.size! / 1024 / 1024 < 2;
      if (!isLt2M) {
        this.generalService.showError('Image must be smaller than 2MB!');
        observer.complete();
        return;
      }

      observer.next(isImage && isLt2M);
      observer.complete();
    });

  transformControlledToPng = (file: NzUploadFile): NzUploadTransformFileType => {
    const origin: File | null =
      (file as any).originFileObj instanceof File
        ? (file as any).originFileObj
        : ((file as any) instanceof File ? (file as any as File) : null);

    return new Observable<Blob | File | string>((observer: Observer<Blob | File | string>) => {

      if (!origin) {
        observer.next(file as any);
        observer.complete();
        return;
      }

      const originSizeMb = (origin.size || 0) / 1024 / 1024;
      const isPngType = origin.type === 'image/png';
      const isPngName = /\.png$/i.test(origin.name || '');
      if (isPngType || isPngName) {
        if (originSizeMb > 2) {
          this.generalService.showError('Image must be smaller than 2MB after conversion.');
          observer.complete();
          return;
        }
        observer.next(origin);
        observer.complete();
        return;
      }

      const reader = new FileReader();

      reader.onload = () => {
        const img = new Image();

        img.onload = () => {

          const MAX_BYTES = 2 * 1024 * 1024;
          const MIN_SCALE = 0.2;

          const attempt = (scale: number) => {
            const canvas = document.createElement('canvas');
            const width = Math.max(1, Math.round(img.width * scale));
            const height = Math.max(1, Math.round(img.height * scale));

            canvas.width = width;
            canvas.height = height;

            const ctx = canvas.getContext('2d');
            if (!ctx) {

              observer.next(origin);
              observer.complete();
              return;
            }

            ctx.drawImage(img, 0, 0, width, height);

            canvas.toBlob(
              (blob) => {
                if (!blob) {
                  observer.next(origin);
                  observer.complete();
                  return;
                }

                if (blob.size <= MAX_BYTES || scale <= MIN_SCALE) {

                  const pngFile = new File(
                    [blob],
                    this.toPngFileName(origin.name),
                    { type: 'image/png' }
                  );
                  observer.next(pngFile);
                  observer.complete();
                } else {

                  const nextScale = scale * 0.7;
                  attempt(nextScale);
                }
              },
              'image/png'
            );
          };

          attempt(1);
        };

        img.onerror = () => {
          observer.next(origin);
          observer.complete();
        };

        img.src = reader.result as string;
      };

      reader.onerror = () => {
        observer.next(origin);
        observer.complete();
      };

      reader.readAsDataURL(origin);
    });
  };

  private toPngFileName(name: string): string {
    return name.replace(/\.[^/.]+$/, '') + '.png';
  }

  handleChange(info: { file: NzUploadFile }, imageType: 'regular' | 'transparent'): void {
    switch (info.file.status) {
      case 'uploading':
        if (imageType === 'regular') {
          this.prescriptionUploadLoading = true;
        }
        this.cdr.detectChanges();
        break;
      case 'done':
        const fileUrl = (info.file as any).response?.fileDetails?.filePath;
        if (!fileUrl) {
          this.generalService.showError('Something went wrong while trying to upload file');
          return;
        }
        if (!this.prescriptionData) {
          this.prescriptionData = {
            presImage: imageType === 'regular' ? fileUrl : undefined as any,
          } as PrescriptionData;
        }
        if (imageType === 'regular') {
          this.prescriptionData.presImage = fileUrl;
          this.prescriptionUploadLoading = false;
        }
        this.generalService.showSuccess('File Uploaded Successfully!');
        this.cdr.detectChanges();

        this.addPirctureUrlToPrescription()
        break;
      case 'error':
        if (imageType === 'regular') {
          this.prescriptionUploadLoading = false;
        }
        this.generalService.showError('Network error');
        this.cdr.detectChanges();
        break;
    }
  }

  handleChangeControlled(info: { file: NzUploadFile }, imageType: 'regular' | 'transparent'): void {
    switch (info.file.status) {
      case 'uploading':
        if (imageType === 'regular') {
          this.prescriptionUploadLoading = true;
        }
        this.cdr.detectChanges();
        break;
      case 'done':
        const fileUrl = (info.file as any).response?.fileDetails?.filePath;
        if (!fileUrl) {
          this.generalService.showError('Something went wrong while trying to upload file');
          return;
        }
        if (!this.prescriptionData) {
          this.prescriptionData = {
            controlledSubImage: imageType === 'regular' ? fileUrl : undefined as any,
          } as PrescriptionData;
        }
        if (imageType === 'regular') {
          this.prescriptionData.controlledSubImage = fileUrl;
          this.prescriptionUploadLoading = false;
        }
        this.generalService.showSuccess('File Uploaded Successfully!');
        this.cdr.detectChanges();

        this.addControlledPirctureUrlToPrescription()
        break;
      case 'error':
        if (imageType === 'regular') {
          this.prescriptionUploadLoading = false;
        }
        this.generalService.showError('Network error');
        this.cdr.detectChanges();
        break;
    }
  }

  addPirctureUrlToPrescription(){
    if(!this.prescriptionData?.presImage) return;
    if(!this.prescriptionId) return;

    const body = {
      patientPrescriptionId: this.prescriptionId,
      presImage: this.prescriptionData.presImage
    };

    this.generalService.uploadPrescriptionImage(body).subscribe({
      next: (response) => {
        if (response?.status === 1) {
          this.generalService.showSuccess('Prescription Image Updated Successfully');
        } else {
          this.generalService.showError(response?.message || 'Something went wrong while updating Prescription Image');
        }
        this.cdr.markForCheck();
      },
      error: (err) => {
        console.error(err);
        this.generalService.showError('Something went wrong while updating Prescription Image');
        this.cdr.markForCheck();
      }
    });
  }

  addControlledPirctureUrlToPrescription(){
    if(!this.prescriptionData?.controlledSubImage) return;
    if(!this.prescriptionId) return;

    const body = {
      patientPrescriptionId: this.prescriptionId,
      controlledSubImage: this.prescriptionData.controlledSubImage
    };

    this.generalService.uploadPrescriptionImage(body).subscribe({
      next: (response) => {
        if (response?.status === 1) {
          this.generalService.showSuccess('Prescription Image Updated Successfully');
        } else {
          this.generalService.showError(response?.message || 'Something went wrong while updating Prescription Image');
        }
        this.cdr.markForCheck();
      },
      error: (err) => {
        console.error(err);
        this.generalService.showError('Something went wrong while updating Prescription Image');
        this.cdr.markForCheck();
      }
    });
  }
  onModalCatalogChange(catalogId: number | null): void {
    this.modalCatalogId = catalogId;
    this.model = null;
    this.resetModalSearchState();
    this.drugQuantity = null;
    this.daysSupplies = null;
    this.courierMethod = '';
    this.drugDirections = '';
    this.drugInstructions = '';
    this.suppliesFormList = [];

    if (!catalogId) {
      this.cdr.markForCheck();
      return;
    }
    this.cdr.markForCheck();
  }

  private getCatalogById(catalogId: number | null | undefined): CatalogOption | undefined {
    if (catalogId == null) return undefined;
    return this.catalogOptions.find((catalog) => catalog.catalogId === catalogId);
  }

  private getDrugCatalogOption(drug: any): CatalogOption | undefined {
    return this.getCatalogById(drug?.catalogId ?? null);
  }

  private syncDrugCatalogMetadata(): void {
    if (!this.listOfDrugs.length) return;

    this.listOfDrugs = this.listOfDrugs.map((drug: any) => {
      const catalog = this.getDrugCatalogOption(drug);
      return {
        ...drug,
        isSystemDefined: catalog?.isSystemDefined ?? this.resolveDrugIsSystemDefined(drug),
        catalogName: catalog?.catalogName ?? drug?.catalogName ?? null
      };
    });
  }

  private resolveDrugIsSystemDefined(drug: any): boolean {
    if (typeof drug?.isSystemDefined === 'boolean') {
      return drug.isSystemDefined;
    }

    const rawValue = drug?.isSystemDefined;
    if (typeof rawValue === 'string') {
      return rawValue.toLowerCase() === 'true';
    }

    return this.getDrugCatalogOption(drug)?.isSystemDefined ?? false;
  }

  get drugModalTitle(): string {
    return this.editingDrugIndex === null ? 'Add Drug' : 'Edit Drug';
  }

  get drugNotFoundContent(): string {
    if (!this.modalCatalogId) return 'Select a catalog first';
    if (this.modalDrugsLoading) return 'Searching drugs...';
    if (!this.hasMinSearchTerm(this.modalDrugSearchTerm)) return `Type ${this.modalSearchMinLength}+ characters to search`;
    return this.modalDrugs.length ? 'No drugs found' : 'No drugs found';
  }

  openAddDrugModal(): void {
    this.editingDrugIndex = null;
    this.resetDrugModalFormState();
    this.modalCatalogId = null;
    this.resetModalSearchState();

    if (this.prescriptionMode === 'system-locked') {
      const lockedCatalogId = this.listOfDrugs.find((drug) => this.resolveDrugIsSystemDefined(drug))?.catalogId ?? null;
      if (lockedCatalogId == null) {
        this.generalService.showError('Unable to resolve the locked catalog for this prescription.');
        return;
      }
      this.modalCatalogId = lockedCatalogId;
    }

    this.addDrugsModalVisible = true;
    this.cdr.markForCheck();
  }

  openEditDrugModal(index: number): void {
    const selectedRow = this.listOfDrugs?.[index];
    if (!selectedRow) return;

    const catalogId = selectedRow?.catalogId ?? null;
    if (catalogId == null) {
      this.generalService.showError('This drug is missing its catalog, so it cannot be edited safely.');
      return;
    }

    this.editingDrugIndex = index;
    this.resetDrugModalFormState();
    this.modalCatalogId = catalogId;
    this.resetModalSearchState();

    this.model = this.resolveDrugModel(selectedRow);
    this.setModalDrugResults([]);
    this.drugQuantity = this.parseNullableNumber(selectedRow?.quantity ?? selectedRow?.drugQuantity);
    this.daysSupplies = this.parseNullableNumber(selectedRow?.daysSupplies);
    this.courierMethod = (selectedRow?.courierMethod ?? '').toString();
    this.drugDirections = (selectedRow?.direction ?? '').toString();
    this.drugInstructions = (selectedRow?.instruction ?? '').toString();

    const mappedSupplies = Array.isArray(selectedRow?.supplies) ? selectedRow.supplies : [];
    this.suppliesFormList = mappedSupplies.map((supplyItem: any, supplyIndex: number) => {
      const supply = this.resolveSupplyModel(supplyItem);
      this.setModalSupplyResults(supplyIndex, [], supply);
      return {
        supply,
        name: supplyItem?.name ?? null,
        supplyQuantity: this.parseNullableNumber(supplyItem?.supplyQuantity),
        supplyItemDesignatorID: supplyItem?.supplyItemDesignatorID ?? null,
        direction: supplyItem?.direction ?? null
      };
    });

    this.addDrugsModalVisible = true;
    this.cdr.markForCheck();
  }

  handleDrugCancel() {
    this.addDrugsModalVisible = false;
    this.editingDrugIndex = null;
    this.resetDrugModalFormState();
    this.modalCatalogId = null;
    this.resetModalSearchState();
    this.cdr.markForCheck();
  }

  handleDrugOk(): void {
    const mode = this.prescriptionMode;
    const nextCatalog = this.getCatalogById(this.modalCatalogId);
    const existingDrug =
      this.editingDrugIndex !== null ? this.listOfDrugs[this.editingDrugIndex] : null;
    const effectiveCatalogName = nextCatalog?.catalogName ?? existingDrug?.catalogName ?? null;
    const effectiveIsSystemDefined =
      nextCatalog?.isSystemDefined ?? this.resolveDrugIsSystemDefined(existingDrug);

    if (this.modalCatalogLoading) {
      this.generalService.showError('Please wait for catalog data to finish loading.');
    }
    else if (this.modalCatalogId == null) {
      this.generalService.showError('Please select a Catalog!');
    }
    else if (this.editingDrugIndex === null && this.listOfDrugs.length > 0 && mode === 'system-locked' && !nextCatalog?.isSystemDefined) {
      this.generalService.showError('System catalog prescriptions cannot mix with custom catalogs.');
    }
    else if (this.editingDrugIndex === null && this.listOfDrugs.length > 0 && mode === 'custom-open' && nextCatalog?.isSystemDefined) {
      this.generalService.showError('Cannot add a system catalog drug to a custom catalog prescription.');
    }
    else if (this.model === null || this.model === '') {
      this.generalService.showError('Please select a Drug!')
    }
    else if(this.drugQuantity == null || this.drugQuantity == undefined){
      this.generalService.showError('Quantity cannot be empty!');
    }
    else if(this.daysSupplies == null || this.daysSupplies == undefined){
      this.generalService.showError('Days supply cannot be empty!');
    }
    else if(this.courierMethod == null || this.courierMethod == undefined || this.courierMethod == ''){
      this.generalService.showError('Courier Methods cannot be empty!');
    }
    else if(this.drugDirections == null || this.drugDirections == undefined || this.drugDirections == ''){
      this.generalService.showError('Directions cannot be empty!');
    }

    else{
      const picked = this.model;
      if (!picked?.productName) {
        this.generalService.showError('Please select a Drug!');
        return;
      }

      const controlled =
        (picked as any).controlSubstance ?? (picked as any).control_Substance ?? null;

      const drugWholesalePrice = this.toNumber(picked.wholesalePrice);
      const drugQty = this.toNumber(this.drugQuantity);
      const drugTotalAmount = this.round2(drugWholesalePrice * drugQty);

      this.row = {

        medicineName: picked.productName,
        drugId: picked.drugId,
        daysSupplies: this.daysSupplies ?? null,
        direction: (this.drugDirections || '').trim(),
        instruction: (this.drugInstructions || '').trim(),
        quantity: this.drugQuantity ?? null,
        drugQuantity: this.drugQuantity ?? null,
        itemDesignatorID: picked.itemDesignatorID,
        strenght: (picked as any).strenght ?? (picked as any).strength ?? null,
        strength: (picked as any).strength ?? (picked as any).strenght ?? null,
        dosageForm: (picked as any).dosageForm ?? null,
        packageSize: (picked as any).packageSize ?? null,
        controlSubstance: controlled,
        courierMethod: this.courierMethod || null,

        wholesalePrice: drugWholesalePrice,
        totalAmount: drugTotalAmount,

        catalogId: this.modalCatalogId,
        catalogName: effectiveCatalogName,
        isSystemDefined: effectiveIsSystemDefined,

        supplies: []
      };

      this.suppliesFormList.forEach((supplyItem) => {
        const s = supplyItem?.supply;
        if (!s?.productName) return;

        const sWholesale = this.toNumber(s.wholesalePrice);
        const sQty = this.toNumber(supplyItem?.supplyQuantity);
        const sTotal = this.round2(sWholesale * sQty);

        this.row.supplies.push({
          supplyDesc: this.getSyringeLables(s),
          supplyQuantity: (supplyItem?.supplyQuantity ?? '').toString(),
          name: s.productName,
          direction: (supplyItem?.direction ?? '').toString(),
          supplyItemDesignatorID: s.itemDesignatorID,
          wholesalePrice: sWholesale,
          totalAmount: sTotal
        });
      });

      if (this.editingDrugIndex !== null && this.listOfDrugs[this.editingDrugIndex]) {
        this.listOfDrugs = this.listOfDrugs.map((drug, index) =>
          index === this.editingDrugIndex ? { ...drug, ...this.row } : drug
        );
      } else {
        this.listOfDrugs = [...this.listOfDrugs, this.row];
      }

      this.syncDrugCatalogMetadata();
      this.refreshSupplyColumnsFromList();
      this.addDrugsModalVisible = false;
      this.cdr.markForCheck();

    this.editingDrugIndex = null;
    this.resetDrugModalFormState();
    this.modalCatalogId = null;
    this.modalDrugs = [];
    this.modalSupplies = [];
    }
  }

  removeRow(id: number) {
    this.listOfDrugs = this.listOfDrugs.filter(item => item.drugId !== id);
  }

  onDrugSearch(term: string): void {
    this.modalDrugSearchTerm = term ?? '';

    if (!this.modalCatalogId) {
      this.setModalDrugResults([]);
      this.modalDrugsLoading = false;
      this.cdr.markForCheck();
      return;
    }

    if (!this.hasMinSearchTerm(this.modalDrugSearchTerm)) {
      this.setModalDrugResults([]);
      this.modalDrugsLoading = false;
      this.cdr.markForCheck();
      return;
    }

    this.modalDrugSearch$.next(this.modalDrugSearchTerm.trim());
  }

  onSupplySearch(term: string, index: number): void {
    this.activeSupplySearchIndex = index;
    this.modalSupplySearchTerms[index] = term ?? '';

    if (!this.modalCatalogId) {
      this.setModalSupplyResults(index, []);
      this.modalSuppliesLoading = false;
      this.cdr.markForCheck();
      return;
    }

    if (!this.hasMinSearchTerm(this.modalSupplySearchTerms[index])) {
      this.setModalSupplyResults(index, []);
      this.modalSuppliesLoading = false;
      this.cdr.markForCheck();
      return;
    }

    this.modalSupplySearch$.next({ index, term: (this.modalSupplySearchTerms[index] || '').trim() });
  }

  onSupplyOpenChange(isOpen: boolean, index: number): void {
    if (isOpen && this.activeSupplySearchIndex !== index) {
      this.activeSupplySearchIndex = index;
      this.modalSupplySearchTerms[index] = '';
      this.modalSupplies = [];
      this.cdr.markForCheck();
    }
  }

  getDrugOptions(): any[] {
    return this.mergeUniqueOptions(this.modalDrugs, this.model ? [this.model] : []);
  }

  getSupplyOptions(index: number): any[] {
    const selectedSupply = this.suppliesFormList?.[index]?.supply;
    return this.mergeUniqueOptions(
      this.activeSupplySearchIndex === index ? this.modalSupplies : [],
      selectedSupply ? [selectedSupply] : []
    );
  }

  getSupplyNotFoundContent(index: number): string {
    if (!this.modalCatalogId) return 'Select a catalog first';
    if (this.modalSuppliesLoading && this.activeSupplySearchIndex === index) return 'Searching supplies...';
    if (!this.hasMinSearchTerm(this.modalSupplySearchTerms[index] || '')) {
      return `Type ${this.modalSearchMinLength}+ characters to search`;
    }
    return this.getSupplyOptions(index).length ? 'No supplies found' : 'No supplies found';
  }

  compareProductOptions = (left: any, right: any): boolean => {
    return this.getOptionIdentity(left) === this.getOptionIdentity(right);
  };

  getDrugLabel(d: any): string {
    const parts = [d?.productName, d?.strenght, d?.dosageForm, d?.packageSize]
      .filter((x: any) => x !== null && x !== undefined && x !== '');

    const base = parts.join(' - ') || '--';
    const wp = this.toNumber(d?.wholesalePrice);
    return `${base} | W: $${this.formatMoney(wp)}`;
  }

  getSyringeLables(d: any): string {
    const parts = [d?.productName, d?.strenght, d?.dosageForm, d?.packageSize]
      .filter((x: any) => x !== null && x !== undefined && x !== '');

    const base = parts.join(' - ') || '--';
    const wp = this.toNumber(d?.wholesalePrice);
    return `${base} | W: $${this.formatMoney(wp)}`;
  }

  get isInjectableSelected(): boolean {
    const form = (this.model?.dosageForm || '').toString().trim().toLowerCase();
    return form === 'injection vial'.toLowerCase() || form === 'injectables'.toLowerCase() || form === 'supplies'.toLowerCase();
  }

  get prescriptionMode(): 'uncommitted' | 'system-locked' | 'custom-open' {
    if (this.listOfDrugs.length === 0) return 'uncommitted';

    return this.listOfDrugs.some((drug: any) => this.resolveDrugIsSystemDefined(drug))
      ? 'system-locked'
      : 'custom-open';
  }

  getSelectedCatalogName(): string {
    const lockedDrug = this.listOfDrugs.find((drug: any) => this.resolveDrugIsSystemDefined(drug));
    return lockedDrug ? this.getDrugCatalogName(lockedDrug) : '';
  }

  get usedCustomCatalogCount(): number {
    const catalogIds = new Set(
      this.listOfDrugs
        .filter((drug: any) => !this.resolveDrugIsSystemDefined(drug))
        .map((drug: any) => drug?.catalogId)
        .filter((catalogId: number | null | undefined) => catalogId != null)
    );
    return catalogIds.size;
  }

  getDrugCatalogName(drug: any): string {
    return this.getDrugCatalogOption(drug)?.catalogName ?? drug?.catalogName ?? 'Unknown Catalog';
  }

  private loadCatalogOptionsDropdown(): void {
    this.catalogOptionsLoading = true;
    this.cdr.markForCheck();
    this.generalService
      .commonGet('DropDowns/getAllCatalogsDropDown')
      .pipe(
        takeUntil(this.destroy$),
        finalize(() => {
          this.catalogOptionsLoading = false;
          this.cdr.markForCheck();
        })
      )
      .subscribe({
        next: (res: any) => {
          this.catalogOptions = (Array.isArray(res?.data) ? res.data : []).filter(
            (c: CatalogOption) => c.isActive
          );
          this.syncDrugCatalogMetadata();
          this.cdr.markForCheck();
        },
        error: () => {
          this.catalogOptions = [];
        },
      });
  }

  private setupModalRemoteSearch(): void {
    this.modalDrugSearch$
      .pipe(
        debounceTime(300),
        distinctUntilChanged(),
        switchMap((term) => {
          const catalogId = this.modalCatalogId;
          if (catalogId == null || !this.hasMinSearchTerm(term)) {
            this.modalDrugsLoading = false;
            this.setModalDrugResults([]);
            return of([]);
          }

          this.modalDrugsLoading = true;
          this.cdr.markForCheck();

          return this.generalService.getAllDrugs(catalogId, term).pipe(
            map((response: any) => Array.isArray(response?.data) ? response.data : []),
            catchError((error) => {
              console.error(error);
              this.generalService.showError('Something went wrong while searching drugs.');
              return of([]);
            }),
            finalize(() => {
              this.modalDrugsLoading = false;
              this.cdr.markForCheck();
            })
          );
        }),
        takeUntil(this.destroy$)
      )
      .subscribe((results) => {
        this.setModalDrugResults(results);
        this.cdr.markForCheck();
      });

    this.modalSupplySearch$
      .pipe(
        debounceTime(300),
        distinctUntilChanged((previous, current) => previous.index === current.index && previous.term === current.term),
        switchMap(({ index, term }) => {
          const catalogId = this.modalCatalogId;
          if (catalogId == null || !this.hasMinSearchTerm(term)) {
            this.modalSuppliesLoading = false;
            this.setModalSupplyResults(index, []);
            return of([]);
          }

          this.modalSuppliesLoading = true;
          this.activeSupplySearchIndex = index;
          this.cdr.markForCheck();

          return this.generalService.getAllDrugSupplies(catalogId, term).pipe(
            map((response: any) => Array.isArray(response?.data) ? response.data : []),
            catchError((error) => {
              console.error(error);
              this.generalService.showError('Something went wrong while searching supplies.');
              return of([]);
            }),
            finalize(() => {
              this.modalSuppliesLoading = false;
              this.cdr.markForCheck();
            })
          );
        }),
        takeUntil(this.destroy$)
      )
      .subscribe((results) => {
        if (this.activeSupplySearchIndex == null) return;
        this.setModalSupplyResults(this.activeSupplySearchIndex, results);
        this.cdr.markForCheck();
      });
  }

  private buildMedicinesPayload(): any[] {
    const toStr = (v: any): string => (v === null || v === undefined ? '' : String(v));

    return this.listOfDrugs.map(d => {
      const qty = this.toNumber(d.quantity ?? d.drugQuantity);
      const wp  = this.toNumber(d.wholesalePrice);

      const supplies = (d.supplies ?? []).map((s: any) => {
        const sQty = this.toNumber(s.supplyQuantity);
        const sWp  = this.toNumber(s.wholesalePrice);
        return {
          supplyDesc:           (s.supplyDesc ?? s.name ?? '').toString(),
          supplyQuantity:       toStr(s.supplyQuantity),
          name:                 (s.name ?? '').toString(),
          direction:            (s.direction ?? '').toString(),
          supplyItemDesignatorID: (s.supplyItemDesignatorID ?? '').toString(),
          wholesalePrice:       sWp,
          totalAmount:          this.round2(sWp * sQty)
        };
      });

      return {
        patientPrescriptionId: this.prescriptionId,
        medicineName:    d.medicineName ?? d.productName ?? '',
        drugId:          d.drugId ?? 0,
        daysSupplies:    toStr(d.daysSupplies),
        direction:       d.direction ?? '',
        instruction:     d.instruction ?? '',
        quantity:        toStr(d.quantity ?? d.drugQuantity),
        itemDesignatorID: d.itemDesignatorID ?? '',
        strenght:        d.strenght ?? d.strength ?? '',
        dosageForm:      d.dosageForm ?? '',
        packageSize:     d.packageSize ?? '',
        controlSubstance: (d.controlSubstance ?? d.control_Substance) === true,
        courierMethod:   d.courierMethod ?? '',
        wholesalePrice:  wp,
        totalAmount:     this.round2(wp * qty),
        catalogId:       d.catalogId ?? null,
        supplies
      };
    });
  }

  saveAndSyncOrder(): void {
    if (!this.updatedWrittenDate) {
      this.generalService.showError('Please add a Written Date before saving.');
      return;
    }

    this.modal.confirm({
      nzTitle: 'Confirm',
      nzContent: 'Are you sure you want to update the prescription and the order?',
      nzCentered: true,
      nzIconType: 'question-circle',
      nzOnOk: () => new Promise<void>((resolve) => {
        this.isFormSubmitting = true;
        this.cdr.markForCheck();

        const writtenDatePayload = {
          patientPrescriptionId: this.prescriptionId,
          writtenDate: this.toApiDateOnly(this.updatedWrittenDate)!
        };

        this.generalService.updatePrescriptionWrittenDate(writtenDatePayload).subscribe({
          next: () => {

            const payload = {
              patientPrescriptionId: this.prescriptionId,
              medicines: this.buildMedicinesPayload()
            };

            this.generalService.addDrugsToPrescription(payload).subscribe({
              next: (response) => {
                if (response?.status === 1) {
                  this.generalService.showSuccess('Prescription updated successfully.');
                  this.listOfDrugs = [];
                  this.getPrescriptionDetails();
                  this.getPatientPrescriptionMedicines();

                  this.generalService.startOrderByPrescription({
                    patientPrescriptionId: this.prescriptionId
                  }).subscribe({
                    next: (orderRes) => {
                      if (orderRes?.status === 200) {
                        this.generalService.showSuccess('Order synced successfully.');
                        const createdOrderId = Number(
                          orderRes?.data?.patientOrderId || orderRes?.data?.orderId || 0
                        );
                        this.getPrescriptionData();
                        this.orderIdForTab = createdOrderId;
                        this.orderDetailViewRef?.getOrderData();
                        this.activeTabIndex = 1;
                      } else {
                        this.generalService.showError(orderRes?.message || 'Failed to sync order.');
                      }
                      this.isFormSubmitting = false;
                      this.cdr.markForCheck();
                      resolve();
                    },
                    error: () => {
                      this.generalService.showError('Failed to sync order.');
                      this.isFormSubmitting = false;
                      this.cdr.markForCheck();
                      resolve();
                    }
                  });
                } else {
                  this.generalService.showError(response?.message || 'Failed to update prescription.');
                  this.isFormSubmitting = false;
                  this.cdr.markForCheck();
                  resolve();
                }
              },
              error: () => {
                this.generalService.showError('Failed to update prescription.');
                this.isFormSubmitting = false;
                this.cdr.markForCheck();
                resolve();
              }
            });
          },
          error: () => {
            this.generalService.showError('Failed to save Written Date.');
            this.isFormSubmitting = false;
            this.cdr.markForCheck();
            resolve();
          }
        });
      })
    });
  }

  getPatientPrescriptionMedicines() {
    if (!this.prescriptionId) return;

    this.generalService.getPrescriptionDrugsByID(this.prescriptionId).subscribe({
      next: (response) => {

        this.listOfDrugs = response.data || [];
        this.syncDrugCatalogMetadata();
        this.refreshSupplyColumnsFromList();

        this.cdr.markForCheck();
      },
      error: (err) => {
        console.error(err);
        this.generalService.showError('Something went wrong while loading prescription medicines.');
        this.cdr.markForCheck();
      }
    });
  }

  startOrderByPrescription(){

    const payload = {
      patientPrescriptionId: this.prescriptionId,
    }

        this.modal.confirm({
          nzTitle: 'Create Order',
          nzContent: `Are you sure you want to create the order?`,
          nzCentered: true,
          nzOnOk: () =>
            new Promise<void>((resolve) => {

                this.generalService.startOrderByPrescription(payload).subscribe({
                  next: (response) => {
                    if (response?.status === 200) {
                      resolve();
                      this.generalService.showSuccess('Order Created Successfully');
                      const createdOrderId = Number(
                        response?.data?.patientOrderId ||
                        response?.data?.orderId ||
                        0
                      );

                      this.getPrescriptionData();

                      this.orderIdForTab = createdOrderId;
                      this.activeTabIndex = 1;
                      this.cdr.markForCheck();
                    }
                  }
                });

            })
        });
  }

  removeDrugFromPrescription(index:any){
    this.listOfDrugs = this.listOfDrugs.filter((_, i) => i !== index);
    this.refreshSupplyColumnsFromList();
    this.cdr.markForCheck();
  }

  get hasControlledSubstanceDrugs(): boolean {
    return this.getControlledSubstanceDrugs().length > 0;
  }

  printControlledSubstancePrescription(): void {
    if (!this.prescriptionData) {
      this.generalService.showError('Prescription details are not available.');
      return;
    }

    const controlledDrugs = this.getControlledSubstanceDrugs();
    if (!controlledDrugs.length) {
      this.generalService.showInfo('No drugs found for this prescription print.');
      return;
    }

    const writtenDate = this.formatPrintDate(
      this.updatedWrittenDate ?? this.prescriptionData.writtenDate
    );
    const html = this.buildControlledPrescriptionPrintHtml(controlledDrugs, writtenDate);
    this.printHtmlInHiddenFrame(html);
  }

  getShortText(value: string | null | undefined, limit: number = 15): string {
    const text = (value ?? '').toString().trim();
    if (!text) {
      return '--';
    }
    if (text.length <= limit) {
      return text;
    }
    return text.slice(0, limit) + '...';
  }

  get hasWrittenDateChanged(): boolean {
    if (!this.prescriptionData) return false;
    return (
      this.toApiDateOnly(this.updatedWrittenDate) !==
      this.toApiDateOnly(this.prescriptionData.writtenDate)
    );
  }

  changeWrittenDate() {
    const formattedWrittenDate = this.toApiDateOnly(this.updatedWrittenDate);
    if (!formattedWrittenDate) {
      this.generalService.showError('Please select a date!');
      return;
    }
    else {

      this.btnLoading = true;
      this.cdr.markForCheck();

      let payload = {
        patientPrescriptionId: this.prescriptionId,
        writtenDate: formattedWrittenDate
      }

      this.generalService.updatePrescriptionWrittenDate(payload).subscribe({
        next: () => {
          this.getPrescriptionData();
          this.btnLoading = false;
          this.cdr.markForCheck();
        },
        error: (err) => {
          console.error(err);
          this.btnLoading = false;
        }
      })
    }
  }

  private toDateOrNull(value: string | Date | null | undefined): Date | null {
    if (!value) return null;

    if (value instanceof Date) {
      return Number.isNaN(value.getTime()) ? null : value;
    }

    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }

  private toApiDateOnly(value: string | Date | null | undefined): string {
    const parsed = this.toDateOrNull(value);
    if (!parsed) return '';

    const year = parsed.getFullYear();
    const month = String(parsed.getMonth() + 1).padStart(2, '0');
    const day = String(parsed.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  getDirectionInstructionTooltip(data: any): string {
    const direction = (data?.direction ?? '').toString().trim() || '--';
    const instruction = (data?.instruction ?? '').toString().trim() || '--';

    return `Direction: ${direction}\nInstruction: ${instruction}`;
  }

  private getControlledSubstanceDrugs(): ControlledPrescriptionDrug[] {
    return (this.listOfDrugs || [])
      .filter((drug) => this.isControlledSubstance(drug?.controlSubstance ?? drug?.control_Substance))
      .map((drug) => ({
        medicineName: this.toText(drug?.medicineName ?? drug?.productName),
        strength: this.toText(drug?.strenght ?? drug?.strength),
        dosageForm: this.toText(drug?.dosageForm),
        packageSize: this.toText(drug?.packageSize),
        quantity: this.toText(drug?.drugQuantity ?? drug?.quantity),
        daysSupplies: this.toText(drug?.daysSupplies),
        refills: this.toText(drug?.refills ?? this.prescriptionData?.refillsRemaining),
        direction: this.toText(drug?.direction),
        instruction: this.toText(drug?.instruction)
      }));
  }

  private isControlledSubstance(value: any): boolean {
    if (typeof value === 'string') {
      const normalized = value.trim().toLowerCase();
      return normalized === 'true' || normalized === 'yes' || normalized === 'y' || normalized === '1';
    }
    return value === true || value === 1;
  }

  private toText(value: any, fallback: string = '--'): string {
    const text = (value ?? '').toString().trim();
    return text ? text : fallback;
  }

  private formatPrintDate(value: any): string {
    if (!value) return '--';
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) return '--';
    return parsed.toLocaleDateString('en-US', {
      month: '2-digit',
      day: '2-digit',
      year: 'numeric'
    });
  }

  private buildControlledPrescriptionPrintHtml(
    controlledDrugs: ControlledPrescriptionDrug[],
    writtenDate: string
  ): string {
    const patientName = this.toText(`${this.prescriptionData?.firstName || ''} ${this.prescriptionData?.lastName || ''}`.trim());
    const patientMrn = this.toText(this.prescriptionData?.mrn);
    const patientGender = this.toText(this.prescriptionData?.gender);
    const patientAddress = this.toText(this.prescriptionData?.address);
    const patientPhone = this.toText(this.prescriptionData?.phoneNumber);
    const patientEmail = this.toText(this.prescriptionData?.email);
    const patientDob = this.formatPrintDate(this.prescriptionData?.dob);
    const patientCity = this.toText(this.prescriptionData?.city);
    const patientState = this.toText(this.prescriptionData?.state);
    const patientZip = this.toText((this.prescriptionData as any)?.zipCode ?? this.extractZip(patientAddress));

    const provider = this.prescriptionData?.provider;
    const prescriberName = this.toText(
      provider?.providerName ?? this.prescriptionDetail?.prescribedBy ?? this.prescriptionData?.createdBy
    );
    const prescriberType = this.toText(provider?.providerType);
    const prescriberNpi = this.toText(provider?.npi ?? this.prescriptionDetail?.npi);
    const prescriberPhone = this.toText(provider?.phone ?? this.prescriptionDetail?.phone);
    const prescriberEmail = this.toText(provider?.email ?? (this.prescriptionDetail as any)?.email);
    const prescriberDea = this.toText(provider?.dea ?? (this.prescriptionDetail as any)?.dea);
    const prescriberAddress = this.toText(
      provider?.address ?? this.prescriptionDetail?.address
    );
    const prescriberCity = this.toText(provider?.city ?? (this.prescriptionDetail as any)?.city);
    const prescriberState = this.toText(provider?.state ?? (this.prescriptionDetail as any)?.state);
    const prescriberZip = this.toText(
      provider?.zipCode ?? (this.prescriptionDetail as any)?.zipCode ?? this.extractZip(prescriberAddress)
    );
    const rxNumber = this.toText(this.prescriptionData?.prescriptionId);

    const emptyNoteFallback = ' ';
    const aggregateDrugNotes = controlledDrugs
      .map((drug) => drug.instruction)
      .filter((note) => note && note !== '--');
    const mainNotes = this.toText(this.prescriptionDetail?.prescriptionInstruction, '');
    const notes = [mainNotes, ...aggregateDrugNotes].filter(Boolean).join(' | ') || emptyNoteFallback;

    const totalRows = controlledDrugs.length;
    const rowsHtml = Array.from({ length: totalRows }, (_, index) => {
      const drug = controlledDrugs[index];
      const rxLabel = drug
        ? [drug.medicineName, drug.strength, drug.dosageForm, drug.packageSize]
            .filter((item) => item && item !== '--')
            .join(' - ')
        : '';
      const sigLine = drug ? drug.direction : '';
      const qty = drug ? drug.quantity : '';
      const daySupply = drug ? drug.daysSupplies : '';
      const refills = drug ? drug.refills : '';

      return `
        <div class="rx-row">
          <div class="rx-line">
            <span class="field-label">Rx:</span>
            <span class="field-value">${this.escapeHtml(rxLabel)}</span>
          </div>
          <div class="rx-meta">
            <span>Qty: ${this.escapeHtml(qty)}</span>
            <span>Day Supply: ${this.escapeHtml(daySupply)}</span>
            <span>Refills: ${this.escapeHtml(refills)}</span>
          </div>
          <div class="sig-line">
            <span class="field-label">Sig:</span>
            <span class="field-value">${this.escapeHtml(sigLine)}</span>
          </div>
        </div>
      `;
    }).join('');

    return `
      <!doctype html>
      <html lang="en">
        <head>
          <meta charset="utf-8" />
          <meta name="viewport" content="width=device-width, initial-scale=1" />
          <title>General Compounded Medication Order Form - #${this.escapeHtml(rxNumber)}</title>
          <style>
            @page {
              size: A4;
              margin: 10mm;
            }
            * {
              box-sizing: border-box;
            }
            html, body {
              width: 100%;
            }
            body {
              margin: 0;
              color: #0f172a;
              font-family: "Segoe UI", Arial, sans-serif;
              font-size: 12px;
              line-height: 1.45;
              background: #ffffff;
            }
            .sheet {
              width: 100%;
              max-width: 100%;
            }
            .title {
              margin: 0 0 14px;
              text-align: center;
              font-size: 24px;
              font-weight: 700;
              letter-spacing: 0.2px;
            }
            .grid {
              display: grid;
              grid-template-columns: 1fr;
              gap: 10px;
              margin-bottom: 12px;
            }
            .card {
              border: 1px solid #334155;
              border-radius: 6px;
              padding: 10px;
              break-inside: avoid;
              page-break-inside: avoid;
            }
            .section-head {
              margin: 0 0 8px;
              font-size: 16px;
              font-weight: 700;
            }
            .info-grid {
              display: grid;
              grid-template-columns: repeat(2, minmax(0, 1fr));
              column-gap: 12px;
            }
            .line-item {
              display: flex;
              align-items: flex-start;
              margin-bottom: 4px;
              gap: 6px;
              min-width: 0;
            }
            .line-item .label {
              font-weight: 600;
              white-space: nowrap;
            }
            .line-item .value {
              flex: 1;
              border-bottom: 1px solid #475569;
              min-height: 17px;
              padding: 1px 2px 2px;
              white-space: normal;
              overflow-wrap: anywhere;
              min-width: 0;
            }
            .allergies {
              border: 1px solid #334155;
              border-radius: 6px;
              padding: 8px 10px;
              margin-bottom: 12px;
              break-inside: avoid;
              page-break-inside: avoid;
            }
            .allergies .value {
              display: inline-block;
              min-width: 180px;
              border-bottom: 1px solid #475569;
              padding: 0 2px 2px;
              margin-left: 6px;
              white-space: normal;
              overflow-wrap: anywhere;
            }
            .bar-title {
              background: #1e293b;
              color: #ffffff;
              text-align: center;
              font-weight: 700;
              letter-spacing: 0.3px;
              padding: 4px 10px;
              margin: 0;
            }
            .rx-box {
              border: 1px solid #334155;
              border-top: 0;
              padding: 6px 8px 0;
              border-radius: 0 0 6px 6px;
            }
            .rx-row {
              border-bottom: 1px solid #94a3b8;
              padding: 7px 0;
              margin-bottom: 2px;
              break-inside: avoid;
              page-break-inside: avoid;
            }
            .rx-line, .sig-line {
              display: grid;
              grid-template-columns: 34px minmax(0, 1fr);
              gap: 6px;
              align-items: start;
            }
            .field-label {
              font-weight: 700;
            }
            .field-value {
              border-bottom: 1px solid #94a3b8;
              min-height: 17px;
              padding: 1px 2px 2px;
              white-space: normal;
              overflow-wrap: anywhere;
              min-width: 0;
            }
            .rx-meta {
              display: grid;
              grid-template-columns: repeat(3, minmax(0, 1fr));
              gap: 6px 10px;
              margin: 4px 0 4px 40px;
              font-weight: 600;
              color: #0f172a;
              font-size: 11px;
            }
            .rx-meta span {
              border-bottom: 1px solid #cbd5e1;
              padding-bottom: 1px;
              white-space: nowrap;
            }
            .notes-box {
              border: 1px solid #334155;
              border-top: 0;
              padding: 8px 10px;
              min-height: 100px;
              margin-bottom: 10px;
              border-radius: 0 0 6px 6px;
              break-inside: avoid;
              page-break-inside: avoid;
            }
            .notes-lines {
              margin-top: 8px;
              padding-top: 6px;
              border-top: 1px solid #94a3b8;
              min-height: 52px;
              white-space: pre-wrap;
            }
            .disclaimer {
              font-size: 10px;
              color: #334155;
              margin-top: 8px;
              line-height: 1.35;
            }
            .signature-grid {
              display: grid;
              grid-template-columns: 1fr 1fr;
              gap: 20px;
              margin-top: 16px;
              break-inside: avoid;
              page-break-inside: avoid;
            }
            .signature-block {
              padding-top: 8px;
            }
            .signature-line {
              display: flex;
              gap: 8px;
              align-items: baseline;
              margin-bottom: 4px;
            }
            .signature-line .value {
              flex: 1;
              border-bottom: 1px solid #475569;
              min-height: 18px;
              padding-bottom: 2px;
            }
            .sub-note {
              font-size: 10px;
              color: #334155;
              text-align: center;
            }
            .footer {
              margin-top: 10px;
              text-align: center;
              font-size: 11px;
              color: #334155;
            }
            .rx-date {
              font-weight: 700;
            }
            @media print {
              body {
                -webkit-print-color-adjust: exact;
                print-color-adjust: exact;
              }
            }
          </style>
        </head>
        <body>
          <section class="sheet">
            <h1 class="title">General Compounded Medication Order Form</h1>

            <div class="grid">
              <section class="card">
                <h2 class="section-head">Patient Information</h2>
                <div class="info-grid">
                  <div>
                    <div class="line-item"><span class="label">Patient Name:</span><span class="value">${this.escapeHtml(patientName)}</span></div>
                    <div class="line-item"><span class="label">MRN:</span><span class="value">${this.escapeHtml(patientMrn)}</span></div>
                    <div class="line-item"><span class="label">Cell Phone:</span><span class="value">${this.escapeHtml(patientPhone)}</span></div>
                    <div class="line-item"><span class="label">Address:</span><span class="value">${this.escapeHtml(patientAddress)}</span></div>
                    <div class="line-item"><span class="label">City:</span><span class="value">${this.escapeHtml(patientCity)}</span></div>
                  </div>
                  <div>
                    <div class="line-item"><span class="label">DOB:</span><span class="value">${this.escapeHtml(patientDob)}</span></div>
                    <div class="line-item"><span class="label">Gender:</span><span class="value">${this.escapeHtml(patientGender)}</span></div>
                    <div class="line-item"><span class="label">Email:</span><span class="value">${this.escapeHtml(patientEmail)}</span></div>
                    <div class="line-item"><span class="label">State:</span><span class="value">${this.escapeHtml(patientState)}</span></div>
                    <div class="line-item"><span class="label">Zip Code:</span><span class="value">${this.escapeHtml(patientZip)}</span></div>
                  </div>
                </div>
              </section>

              <section class="card">
                <h2 class="section-head">Prescriber Information</h2>
                <div class="info-grid">
                  <div>
                    <div class="line-item"><span class="label">Prescriber Name:</span><span class="value">${this.escapeHtml(prescriberName)}</span></div>
                    <div class="line-item"><span class="label">Type:</span><span class="value">${this.escapeHtml(prescriberType)}</span></div>
                    <div class="line-item"><span class="label">NPI:</span><span class="value">${this.escapeHtml(prescriberNpi)}</span></div>
                    <div class="line-item"><span class="label">Phone:</span><span class="value">${this.escapeHtml(prescriberPhone)}</span></div>
                    <div class="line-item"><span class="label">Address:</span><span class="value">${this.escapeHtml(prescriberAddress)}</span></div>
                    <div class="line-item"><span class="label">City:</span><span class="value">${this.escapeHtml(prescriberCity)}</span></div>
                  </div>
                  <div>
                    <div class="line-item"><span class="label">DEA #:</span><span class="value">${this.escapeHtml(prescriberDea)}</span></div>
                    <div class="line-item"><span class="label">Email:</span><span class="value">${this.escapeHtml(prescriberEmail)}</span></div>
                    <div class="line-item"><span class="label">State:</span><span class="value">${this.escapeHtml(prescriberState)}</span></div>
                    <div class="line-item"><span class="label">Zip Code:</span><span class="value">${this.escapeHtml(prescriberZip)}</span></div>
                    <div class="line-item"><span class="label">Rx #:</span><span class="value">${this.escapeHtml(rxNumber)}</span></div>
                  </div>
                </div>
              </section>
            </div>

            <p class="bar-title">PRESCRIPTION</p>
            <section class="rx-box">
              ${rowsHtml}
            </section>

            <p class="bar-title">Notes</p>
            <section class="notes-box">
              <div>${this.escapeHtml(notes)}</div>
              <div class="notes-lines"></div>
            </section>

            <div class="disclaimer">
              Fax Delivery Disclaimer: This message and any attachments are intended only for the named recipient(s).
              If you are not the intended recipient, please notify the sender and delete this message. Do not disclose
              or copy its contents.
            </div>
            <div class="disclaimer">
              The FDA does not review any compounded medication for safety or efficacy.
            </div>

            <section class="signature-grid">
              <div class="signature-block">
                <div class="signature-line">
                  <span><strong>Prescriber Signature:</strong></span>
                  <span class="value"></span>
                </div>
                <div class="signature-line">
                  <span><strong>Rx Date:</strong></span>
                  <span class="value rx-date">${this.escapeHtml(writtenDate)}</span>
                </div>
                <div class="sub-note">Dispense as Written</div>
              </div>

              <div class="signature-block">
                <div class="signature-line">
                  <span><strong>Prescriber Signature:</strong></span>
                  <span class="value"></span>
                </div>
                <div class="signature-line">
                  <span><strong>Rx Date:</strong></span>
                  <span class="value"></span>
                </div>
                <div class="sub-note">May Substitute</div>
              </div>
            </section>

            <div class="footer">
              Phone: ${this.escapeHtml(prescriberPhone)} | Email: ${this.escapeHtml(prescriberEmail)} | ePrescribe via NPI: ${this.escapeHtml(prescriberNpi)}
            </div>
          </section>
        </body>
      </html>
    `;
  }

  private escapeHtml(value: string): string {
    return value
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  private extractZip(address: string): string {
    const zip = (address || '').match(/\b\d{5}(?:-\d{4})?\b/);
    return zip?.[0] || '--';
  }

  private resetModalSearchState(): void {
    this.modalDrugs = [];
    this.modalSupplies = [];
    this.modalDrugsLoading = false;
    this.modalSuppliesLoading = false;
    this.modalDrugSearchTerm = '';
    this.modalSupplySearchTerms = {};
    this.activeSupplySearchIndex = null;
  }

  private setModalDrugResults(results: any[]): void {
    this.modalDrugs = this.mergeUniqueOptions(results, this.model ? [this.model] : []);
  }

  private setModalSupplyResults(index: number, results: any[], preservedSupply?: any): void {
    const currentSupply = preservedSupply ?? this.suppliesFormList?.[index]?.supply;
    if (this.activeSupplySearchIndex === index) {
      this.modalSupplies = this.mergeUniqueOptions(results, currentSupply ? [currentSupply] : []);
      return;
    }

    if (!results.length) return;
    this.modalSupplies = this.mergeUniqueOptions(results, currentSupply ? [currentSupply] : []);
  }

  private mergeUniqueOptions(options: any[], preserved: any[]): any[] {
    const merged = [...preserved.filter(Boolean), ...options.filter(Boolean)];
    const seen = new Set<string>();
    return merged.filter((item) => {
      const identity = this.getOptionIdentity(item);
      if (!identity || seen.has(identity)) return false;
      seen.add(identity);
      return true;
    });
  }

  private getOptionIdentity(item: any): string {
    if (!item) return '';
    if (item?.drugId != null) return `drug:${item.drugId}`;
    if (item?.itemDesignatorID != null) return `item:${item.itemDesignatorID}`;
    if (item?.supplyItemDesignatorID != null) return `supply:${item.supplyItemDesignatorID}`;
    if (item?.productName) return `name:${String(item.productName).trim().toLowerCase()}`;
    if (item?.name) return `name:${String(item.name).trim().toLowerCase()}`;
    return JSON.stringify(item);
  }

  private hasMinSearchTerm(term: string | null | undefined): boolean {
    return (term ?? '').trim().length >= this.modalSearchMinLength;
  }

  private refreshSupplyColumnsFromList(): void {
    let maxSupplies = 0;
    (this.listOfDrugs || []).forEach((drug) => {
      const count = Array.isArray(drug?.supplies) ? drug.supplies.length : 0;
      maxSupplies = count > maxSupplies ? count : maxSupplies;
    });
    this.supplyColumns = Array.from({ length: maxSupplies }, () => ({}));
  }

  private parseNullableNumber(value: any): number | null {
    if (value === null || value === undefined || value === '') {
      return null;
    }
    const n = Number(value);
    return Number.isFinite(n) ? n : null;
  }

  private resolveDrugModel(drugRow: any): any {
    const rowDrugId = drugRow?.drugId;
    const rowItemDesignatorID = drugRow?.itemDesignatorID;

    const byDrugId = this.modalDrugs.find((item) =>
      rowDrugId !== null &&
      rowDrugId !== undefined &&
      String(item?.drugId) === String(rowDrugId)
    );
    if (byDrugId) return byDrugId;

    const byItemDesignator = this.modalDrugs.find((item) =>
      rowItemDesignatorID !== null &&
      rowItemDesignatorID !== undefined &&
      String(item?.itemDesignatorID) === String(rowItemDesignatorID)
    );
    if (byItemDesignator) return byItemDesignator;

    return {
      productName: drugRow?.medicineName ?? drugRow?.productName ?? '',
      drugId: rowDrugId ?? 0,
      itemDesignatorID: rowItemDesignatorID ?? null,
      strenght: drugRow?.strenght ?? drugRow?.strength ?? null,
      strength: drugRow?.strength ?? drugRow?.strenght ?? null,
      dosageForm: drugRow?.dosageForm ?? null,
      packageSize: drugRow?.packageSize ?? null,
      wholesalePrice: this.toNumber(drugRow?.wholesalePrice),
      controlSubstance: drugRow?.controlSubstance ?? drugRow?.control_Substance ?? null
    };
  }

  private resolveSupplyModel(supplyRow: any): any {
    const rowId = supplyRow?.supplyItemDesignatorID ?? supplyRow?.itemDesignatorID;
    const byId = this.modalSupplies.find((item) =>
      rowId !== null &&
      rowId !== undefined &&
      String(item?.itemDesignatorID) === String(rowId)
    );
    if (byId) return byId;

    const rowName = (supplyRow?.name ?? '').toString().trim().toLowerCase();
    const byName = this.modalSupplies.find((item) =>
      (item?.productName ?? '').toString().trim().toLowerCase() === rowName
    );
    if (byName) return byName;

    return {
      productName: supplyRow?.name ?? supplyRow?.supplyDesc ?? '',
      itemDesignatorID: rowId ?? null,
      wholesalePrice: this.toNumber(supplyRow?.wholesalePrice),
      strenght: supplyRow?.strenght ?? supplyRow?.strength ?? null,
      strength: supplyRow?.strength ?? supplyRow?.strenght ?? null,
      dosageForm: supplyRow?.dosageForm ?? null,
      packageSize: supplyRow?.packageSize ?? null
    };
  }

  private resetDrugModalFormState(): void {
    this.model = null;
    this.selectedSyringe = null;
    this.syringeQuantity = null;
    this.selectedNeedle = null;
    this.needleQuantity = null;
    this.drugQuantity = null;
    this.courierMethod = '';
    this.daysSupplies = null;
    this.drugDirections = '';
    this.drugInstructions = '';
    this.suppliesFormList = [];
    this.row = {};
  }

  private printHtmlInHiddenFrame(html: string): void {
    const iframe = document.createElement('iframe');
    iframe.style.position = 'fixed';
    iframe.style.right = '0';
    iframe.style.bottom = '0';
    iframe.style.width = '0';
    iframe.style.height = '0';
    iframe.style.border = '0';
    iframe.setAttribute('aria-hidden', 'true');
    iframe.setAttribute('tabindex', '-1');
    document.body.appendChild(iframe);

    const cleanup = () => {
      window.setTimeout(() => {
        if (iframe.parentNode) {
          iframe.parentNode.removeChild(iframe);
        }
      }, 0);
    };

    const frameWindow = iframe.contentWindow;
    const frameDocument = frameWindow?.document;
    if (!frameWindow || !frameDocument) {
      cleanup();
      this.generalService.showError('Unable to initialize print preview.');
      return;
    }

    frameDocument.open();
    frameDocument.write(html);
    frameDocument.close();

    iframe.onload = () => {
      frameWindow.focus();
      frameWindow.print();
      frameWindow.onafterprint = cleanup;

      window.setTimeout(cleanup, 3000);
    };
  }

  private toNumber(v: any): number {
    const n = Number(v);
    return Number.isFinite(n) ? n : 0;
  }

  private round2(n: number): number {
    return Math.round((n + Number.EPSILON) * 100) / 100;
  }

  formatMoney(v: any): string {
    const n = this.toNumber(v);
    return n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }

  get selectedDrugWholesale(): number {
    return this.toNumber(this.model?.wholesalePrice);
  }

  get selectedDrugTotal(): number {
    const qty = this.toNumber(this.drugQuantity);
    return this.round2(this.selectedDrugWholesale * qty);
  }

  getSuppliesWholesale(index: number): number {
    return this.toNumber(this.suppliesFormList?.[index]?.supply?.wholesalePrice);
  }

  getSuppliesTotal(index: number): number {
    const wp = this.getSuppliesWholesale(index);
    const qty = this.toNumber(this.suppliesFormList?.[index]?.supplyQuantity);
    return this.round2(wp * qty);
  }

  get modalGrandTotal(): number {
    const drugTotal = this.selectedDrugTotal;
    const suppliesTotal = (this.suppliesFormList || []).reduce((sum: number, s: any) => {
      const wp = this.toNumber(s?.supply?.wholesalePrice);
      const qty = this.toNumber(s?.supplyQuantity);
      return sum + this.round2(wp * qty);
    }, 0);

    return this.round2(drugTotal + suppliesTotal);
  }

  get drugsTableScrollX(): string {
    const baseWidth = 1450;
    const perSupplyWidth = 230;
    const dynamicWidth = baseWidth + ((this.supplyColumns || []).length * perSupplyWidth);
    return `${Math.max(2000, dynamicWidth)}px`;
  }

  getMetaLine(item: any): string {
    const parts = [item?.strenght, item?.dosageForm, item?.packageSize]
      .filter((x: any) => x !== null && x !== undefined && x !== '');
    return parts.join(' • ');
  }

  onOrderEmbeddedNavigate = (req: any): void => {
    if (req?.type === 'prescription' || req?.type === 'treatmentMain') {
      this.activeTabIndex = 0;
      this.cdr.markForCheck();
    }
  };

  onOrderActioned(): void {
    this.loadAllPrescriptionData();
  }
}
