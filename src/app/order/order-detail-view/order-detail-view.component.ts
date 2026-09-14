import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  EventEmitter,
  Input,
  OnDestroy,
  OnInit,
  Output,
  SimpleChanges
} from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { Location } from '@angular/common';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { Subject, takeUntil, finalize } from 'rxjs';
import { GeneralService } from 'app/shared/services/general.service';
import { AuthService } from 'app/shared/Auth/auth.service';
import { TitleService } from 'app/shared/services/title.service';
import { NzModalService } from 'ng-zorro-antd/modal';
import { getUnifiedStatusBadgeClass } from 'app/shared/utils/status-badge.util';

export interface MedicineSupply {
  medicineSupplyId: number;
  prescriptionMedicineId: number;
  supplyDesc: string | null;
  supplyQuantity: string | null;
  supplyItemDesignatorID: string;
  name: string;
}
export interface Medicine {
  prescriptionMedicineId: number;
  patientPrescriptionId: number;
  medicineName: string;
  drugId: number;
  daysSupplies: string | null;
  injection: string | null;
  injectionQuantity: string | null;
  needle: string | null;
  needleQuantity: string | null;
  direction: string | null;
  instruction: string | null;
  quantity: string | null;
  itemDesignatorID: string | null;
  strenght: string | null;
  dosageForm: string | null;
  packageSize: string | null;
  controlSubstance: boolean;
  courierMethod: string | null;
  supplies?: MedicineSupply[] | null;
}

type EmbeddedTabNavigationRequest = {
  type: 'order' | 'prescription' | 'soapNote' | 'treatmentMain';
  id?: number;
  data?: any;
};

@Component({
  selector: 'app-order-detail-view',
  templateUrl: './order-detail-view.component.html',
  styleUrl: './order-detail-view.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class OrderDetailViewComponent implements OnInit, OnDestroy {
  @Input() orderIdInput: number | null = null;
  @Input() embeddedInTabs = false;
  @Input() openInTreatmentTabs: ((request: EmbeddedTabNavigationRequest) => void) | null = null;
  @Output() orderActioned = new EventEmitter<void>();

  readonly selectedOrgId: number = Number(localStorage.getItem('OFL'));
  orderId: number = 0;

  orderData: any = null;
  listOfDrugs: any[] = [];

  hasError = false;
  isLoading = false;
  userRole = '';

  supplyColumns: any[] = [];

  isFulfillManuallyModalVisible = false;
  isSubmittingManualFulfillment = false;
  fulfillForm!: FormGroup;

  readonly fulfillmentStatusOptions = [
    'Created',
    'Pending',
    'Processing',
    'Out for Delivery',
    'Completed',
    'Failed',
    'Returned',
    'Cancelled'
  ];
  readonly shippingProviderOptions = ['UPS', 'FedEx', 'USPS', 'DHL', 'Other'];

  private destroy$ = new Subject<void>();

  constructor(
    private route: Router,
    private cdr: ChangeDetectorRef,
    private _location: Location,
    private generalService: GeneralService,
    private router: ActivatedRoute,
    private auth: AuthService,
    private titleService: TitleService,
    private modal: NzModalService,
    private fb: FormBuilder
  ) {
  }

  ngOnInit(): void {
    this.userRole = this.auth.getUserRole() || '';
    this.initFulfillForm();
    this.resolveAndLoadOrder();
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['orderIdInput'] && !changes['orderIdInput'].firstChange) {
      this.resolveAndLoadOrder();
    }
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  private resolveAndLoadOrder(): void {
    const inputId = Number(this.orderIdInput || 0);
    const routeId = Number(this.router.snapshot.paramMap.get('id') || 0);
    const resolvedId = inputId > 0 ? inputId : routeId;

    if (!resolvedId) {
      this.orderData = null;
      this.isLoading = false;
      this.cdr.markForCheck();
      return;
    }

    if (this.orderId !== resolvedId) {
      this.orderId = resolvedId;
      this.getOrderData();
      return;
    }

    if (!this.orderData && !this.isLoading) {
      this.getOrderData();
    }
  }

  getOrderData(): void {
    if (!this.orderId) return;

    this.isLoading = true;
    this.hasError = false;

    this.generalService
      .commonGet(`PatientOrders/getPatientOrderInfo?Id=${this.orderId}&ClientTimezoneOffsetMinutes=${new Date().getTimezoneOffset() * -1}`)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (response) => {
          if (response?.status === 1 && response?.data) {
            this.orderData = response.data;

            this.listOfDrugs = this.orderData?.medicines || [];

            let drugSuppliesLengthList = 0;

            this.listOfDrugs.forEach((drug) => {

              drugSuppliesLengthList = drug.supplies?.length > drugSuppliesLengthList ? drug.supplies?.length : drugSuppliesLengthList

            })

            this.supplyColumns.length = drugSuppliesLengthList;

            this.cdr.markForCheck();

            if (!this.embeddedInTabs) {
              const name = `${this.orderData.firstName ?? ''} ${this.orderData.lastName ?? ''}`.trim() || 'Order Detail';
              this.titleService.updateTitle(name, [
                { label: 'Orders', path: '/order/view' },
                { label: 'Order Detail', path: `/order/detail/${this.orderId}` }
              ]);
            }

            this.isLoading = false;
          } else {
            console.error(response?.message);
            this.hasError = true;
            this.isLoading = false;
          }
          this.cdr.detectChanges();
        },
        error: (err) => {
          console.error(err);
          this.hasError = true;
          this.isLoading = false;
          this.cdr.detectChanges();
        }
      });
  }

  moveBack(): void {
    if (this.embeddedInTabs) return;
    this._location.back();
  }

  navigate(route: string, key: number | string): void {
    if (!this.orderData) return;
    const numericKey = Number(key || 0);

    if (this.embeddedInTabs && this.openInTreatmentTabs) {
      if (route === 'prescription/detail/' && numericKey > 0) {
        this.openInTreatmentTabs({ type: 'prescription', id: numericKey });
        return;
      }
      if (route === 'treatment/detail/') {
        this.openInTreatmentTabs({ type: 'treatmentMain' });
        return;
      }
    }

    this.route.navigate([route, key]);
  }

  getStatusBadgeClass(status: string | null | undefined): string {
    return getUnifiedStatusBadgeClass(status);
  }

  updateOrderStatus = (): void => {
    const title = 'Update Order Status';
    const ID = this.orderId || 0;
    const formPath = 'statusUpdates/update-order-status-form.json';

    this.modalApiUrl = {
      save: 'Patients/updateStatus',
      get: 'Patients/getStatus?Type=Order&Id='
    };

    this.commanModel?.showModal(title, 'form', formPath, ID);
  };

  openSendOrderConfirm(): void {

    if(this.orderData?.medicines?.length == 0) {
      this.generalService.showError('Please add medicines to order before sending!')
    }
    else {
      this.modal.confirm({
        nzTitle: 'Confirm',
        nzContent: 'Are you sure, you want send this order to pharmacy?',
        nzIconType: 'question-circle',
        nzOnOk: () => this.sendOrder(),
      });
    }
  }

  sendOrder(){
    let prescription = this.orderData?.prescriptionId

    this.generalService.sendOrderToPharmacy(prescription).subscribe({
      next: (response) => {
        this.generalService.showSuccess(response.message);
        this.orderActioned.emit();
      },
      error: (err) => {
        this.generalService.showError(err.message);
      }
    })

  }

  get empowerTracking(): any | null {
    const d = this.orderData;
    return d?.empowerTracking ?? d?.Tracking ?? d?.tracking ?? null;
  }

  get manualTracking(): any | null {
    return this.orderData?.manualTracking ?? null;
  }

  get trackingInfo(): any | null {
    return this.empowerTracking;
  }

  get canFulfillManually(): boolean {
    if (this.userRole !== 'Global Admin') return false;
    if (!this.orderData) return false;

    if (this.empowerTracking) return false;
    return true;
  }

  private initFulfillForm(): void {
    this.fulfillForm = this.fb.group({
      orderNumber:      ['', [Validators.maxLength(100)]],
      orderStatus:      ['Shipped', [Validators.required]],
      trackingNumber:   ['', [Validators.maxLength(100)]],
      shippingProvider: [null as string | null],
      trackingUrl:      ['', [Validators.pattern(/^(https?:\/\/.+)?$/i)]],
      dateShipped:      [null as Date | null],
      notes:            ['', [Validators.maxLength(500)]]
    });
  }

  openFulfillManuallyModal(): void {
    if (!this.canFulfillManually) return;

    const mt = this.manualTracking;
    this.fulfillForm.reset({
      orderNumber:      mt?.orderNumber || '',
      orderStatus:      mt ? (this.orderData?.orderStatus || 'Shipped') : 'Shipped',
      trackingNumber:   mt?.trackingNumber || '',
      shippingProvider: mt?.shippingProvider || null,
      trackingUrl:      mt?.trackingUrl || '',
      dateShipped:      mt?.dateShipped ? new Date(mt.dateShipped) : null,
      notes:            mt?.notes || ''
    });

    this.isFulfillManuallyModalVisible = true;
    this.cdr.markForCheck();
  }

  closeFulfillManuallyModal(): void {
    this.isFulfillManuallyModalVisible = false;
    this.cdr.markForCheck();
  }

  submitManualFulfillment(): void {
    if (this.fulfillForm.invalid) {
      this.fulfillForm.markAllAsTouched();
      return;
    }

    const raw = this.fulfillForm.getRawValue();
    const payload = {
      patientOrderId:   this.orderId,
      orderNumber:      (raw.orderNumber || '').trim() || null,
      orderStatus:      String(raw.orderStatus || '').trim(),
      trackingNumber:   (raw.trackingNumber || '').trim() || null,
      trackingUrl:      (raw.trackingUrl || '').trim() || null,
      shippingProvider: raw.shippingProvider || null,
      dateShipped:      raw.dateShipped ? (raw.dateShipped as Date).toISOString() : null,
      notes:            (raw.notes || '').trim() || null
    };

    this.isSubmittingManualFulfillment = true;
    this.cdr.markForCheck();

    this.generalService.fulfillOrderManually(payload)
      .pipe(
        finalize(() => {
          this.isSubmittingManualFulfillment = false;
          this.cdr.markForCheck();
        }),
        takeUntil(this.destroy$)
      )
      .subscribe({
        next: (res: any) => {
          if (res?.status === 1 || res?.success) {
            this.generalService.showSuccess(res?.message || 'Order fulfilled successfully.');
            this.isFulfillManuallyModalVisible = false;
            this.getOrderData();
            this.orderActioned.emit();
          } else {
            this.generalService.showError(res?.message || 'Failed to fulfill order.');
          }
        },
        error: (err: any) => {
          this.generalService.showError(err?.message || 'Failed to fulfill order.');
        }
      });
  }

  get patientDisplayName(): string {
    const first = this.orderData?.firstName || '';
    const last = this.orderData?.lastName || '';
    const full = `${first} ${last}`.trim();
    return full || '--';
  }

  get canSendOrder(): boolean {
    return this.userRole === 'Global Admin' && this.orderData?.orderStatus === 'Created';
  }

  controlledSubstanceClass(drug: any): string {
    const isControlled = drug?.controlSubstance ?? drug?.control_Substance;
    if (isControlled === true) return 'ord-status-pill ord-status-warning';
    if (isControlled === false) return 'ord-status-pill ord-status-neutral';
    return 'ord-status-pill ord-status-muted';
  }

  get controlledSubstanceLabel(): string {
    return 'Controlled Rx';
  }

  controlledSubstanceValue(drug: any): string {
    const isControlled = drug?.controlSubstance ?? drug?.control_Substance;
    if (isControlled === true) return 'Controlled';
    if (isControlled === false) return 'Non-Controlled';
    return '--';
  }

  getDrugSupplies(drug: any): MedicineSupply[] {
    return Array.isArray(drug?.supplies) ? drug.supplies : [];
  }

  refreshData(_title: string): void {

    this.getOrderData();
  }

  modalApiUrl: { save?: string; get?: string } = { save: '', get: '' };

  commanModel: any;
}

