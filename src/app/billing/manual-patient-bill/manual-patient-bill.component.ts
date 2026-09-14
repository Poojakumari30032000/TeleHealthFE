import { ChangeDetectionStrategy, ChangeDetectorRef, Component, Input, OnDestroy, OnInit } from '@angular/core';
import { Subject } from 'rxjs';
import { debounceTime, finalize, takeUntil } from 'rxjs/operators';
import { TitleService } from 'app/shared/services/title.service';
import { GeneralService } from 'app/shared/services/general.service';
import {NzNotificationService} from "ng-zorro-antd/notification";
import {Router} from "@angular/router";
import { NzModalService } from 'ng-zorro-antd/modal';

interface ApiResponse<T = any> {
  status: number;
  success?: boolean | null;
  message?: string | null;
  count?: number | null;
  data: T;
  totalEntityCount?: number | null;
  totalPages?: number | null;
}

interface FacilityDropdownItem {
  facilityId: number;
  titlelong: string;
  titleshort: string;
  guid: string;
  organizationId: number;
  organizationName: string;
}

interface PatientDropdownItem {
  patientId: number;
  patientName: string;
  facilityId: number;
}

interface PatientDetail {
  guid: string;
  patientId: number;
  facilityId: number;
  firstName: string | null;
  lastName: string | null;
  email: string | null;
  gender: string | null;
  dob: string | null;
  address: string | null;
  street: string | null;
  cityId: number | null;
  stateId: number | null;
  zipcode: string | null;
  phone: string | null;
  status: string | null;
}

interface DrugSupplyDropdownItem {
  productId: number;
  drugId: number;
  productName: string;
  productType: string | null;
  dosageForm: string | null;
  packageSize: string | null;
  strenght: string | null;
  price: number | null;

  displayLabel?: string;
}

interface CatalogOption {
  catalogId: number;
  catalogName: string;
  isSystemDefined: boolean;
  isActive: boolean;
}

interface InvoiceLineItem {
  catalogId?: number | null;
  drugId?: number | null;
  productId?: number | null;
  productName?: string | null;
  quantity: number;
  unitPrice: number;
  lineTotal?: number;

  rowProducts?: DrugSupplyDropdownItem[];
  rowProductsLoading?: boolean;
  rowSearchTerm?: string;
  selectedProduct?: DrugSupplyDropdownItem | null;
}

@Component({
  selector: 'app-manual-patient-bill',
  templateUrl: './manual-patient-bill.component.html',
  styleUrl: './manual-patient-bill.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ManualPatientBillComponent implements OnInit, OnDestroy {
  @Input() embeddedInTabs = false;
  @Input() openCreatedInvoiceTab?: (invoiceId: number) => void;

  errorMsg: string | null = null;

  invoiceDate = new Date();

  loadingFacilities = false;
  loadingPatients = false;
  loadingPatientDetail = false;
  savingInvoice:boolean = false;

  facilities: FacilityDropdownItem[] = [];
  patients: PatientDropdownItem[] = [];

  selectedFacilityId: number | null = null;
  selectedPatientId: number | null = null;

  catalogOptions: CatalogOption[] = [];
  catalogOptionsLoading = false;

  private readonly productSearch$ = new Subject<{ rowIndex: number; term: string }>();
  private readonly destroy$ = new Subject<void>();

  patientEmail: string | null = null;
  patientAddress: string | null = null;
  patientPhone: string | null = null;

  lineItems: InvoiceLineItem[] = [];

  totalQty = 0;
  totalLineAmount = 0;

  get subtotal(): number {
    return Number(this.totalLineAmount || 0);
  }

  get amountDue(): number {
    return this.subtotal;
  }

  constructor(
    private cdr: ChangeDetectorRef,
    private title: TitleService,
    private gs: GeneralService,
    private notification: NzNotificationService,
    private router: Router,
    private modal: NzModalService,
  ) {}

  ngOnInit(): void {
    if (!this.embeddedInTabs) {
      this.title.updateTitle('Create Patient Invoice', [
        { label: 'Patient Invoices', path: '/billing/clinicInvoices' },
        { label: 'Create', path: 'billing/manualPatientBills' },
      ]);
    }

    this.loadFacilities();
    this.loadCatalogOptions();

    this.productSearch$
      .pipe(debounceTime(300), takeUntil(this.destroy$))
      .subscribe(({ rowIndex, term }) => {
        const row = this.lineItems[rowIndex];
        if (!row?.catalogId || !this.selectedFacilityId) return;
        if (term.length < 3) {
          this.updateRowState(rowIndex, { rowProducts: [], rowSearchTerm: term });
          return;
        }
        this.loadRowProducts(rowIndex, this.selectedFacilityId, row.catalogId, term);
      });

    this.resetLineItemsToDefault();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  private loadFacilities(): void {
    this.loadingFacilities = true;
    this.errorMsg = null;

    this.gs
      .getAllFacilitiesDropdown()
      .pipe(finalize(() => (this.loadingFacilities = false)))
      .subscribe({
        next: (res: ApiResponse<FacilityDropdownItem[]>) => {
          this.facilities = Array.isArray(res.data) ? res.data : [];
          this.cdr.markForCheck();
        },
        error: (err) => {
          this.errorMsg =
            err?.error?.message || 'Failed to load facilities. Please try again later.';
          this.cdr.markForCheck();
        },
      });
  }

  onFacilityChange(facilityId: number | null): void {
    this.selectedFacilityId = facilityId ?? null;

    this.selectedPatientId = null;
    this.patients = [];
    this.clearPatientFields();
    this.resetLineItemsToDefault();

    if (!this.selectedFacilityId) {
      this.cdr.markForCheck();
      return;
    }

    this.loadPatients(this.selectedFacilityId);
    this.cdr.markForCheck();
  }

  private loadCatalogOptions(): void {
    this.catalogOptionsLoading = true;
    this.cdr.markForCheck();
    this.gs
      .commonGet('DropDowns/getAllCatalogsDropDown')
      .pipe(finalize(() => { this.catalogOptionsLoading = false; this.cdr.markForCheck(); }))
      .subscribe({
        next: (res: any) => {
          this.catalogOptions = (Array.isArray(res?.data) ? res.data : []).filter(
            (c: CatalogOption) => c.isActive
          );
          this.cdr.markForCheck();
        },
        error: () => { this.catalogOptions = []; },
      });
  }

  onRowCatalogChange(rowIndex: number, catalogId: number | null): void {
    this.updateRowState(rowIndex, {
      catalogId: catalogId ?? null,
      drugId: null,
      productId: null,
      productName: null,
      selectedProduct: null,
      rowProducts: [],
      rowSearchTerm: '',
      unitPrice: 0,
      lineTotal: 0,
      quantity: 0,
    });
    this.recalculateTotals(true);
  }

  onRowProductSearch(rowIndex: number, term: string): void {

    this.productSearch$.next({ rowIndex, term });
  }

  private loadRowProducts(rowIndex: number, facilityId: number, catalogId: number, term: string): void {
    this.updateRowState(rowIndex, { rowProductsLoading: true, rowSearchTerm: term });
    this.gs
      .commonGet(`DropDowns/GetAllDrugsAndSupplies?FacilityId=${facilityId}&CatalogId=${catalogId}&SearchTerm=${encodeURIComponent(term)}`)
      .pipe(finalize(() => this.updateRowState(rowIndex, { rowProductsLoading: false })))
      .subscribe({
        next: (res: any) => {
          const items: DrugSupplyDropdownItem[] = (Array.isArray(res?.data) ? res.data : []).map((x: any) => ({
            ...x,
            displayLabel: this.buildProductLabel(x),
          }));
          this.updateRowState(rowIndex, { rowProducts: items });
        },
        error: () => { this.updateRowState(rowIndex, { rowProducts: [] }); },
      });
  }

  private updateRowState(rowIndex: number, patch: Partial<InvoiceLineItem>): void {
    this.lineItems = this.lineItems.map((item, i) =>
      i === rowIndex ? { ...item, ...patch } : item
    );
    this.cdr.markForCheck();
  }

  getRowSearchHint(row: InvoiceLineItem): string {
    if (!row.catalogId) return 'Select a catalog first';
    if (row.rowProductsLoading) return 'Searching...';
    if (!row.rowSearchTerm || row.rowSearchTerm.length < 3) return 'Type at least 3 characters to search';
    return 'No results found';
  }

  private loadPatients(facilityId: number): void {
    this.loadingPatients = true;
    this.errorMsg = null;

    this.gs
      .getAllPatientsDropdown(facilityId)
      .pipe(finalize(() => (this.loadingPatients = false)))
      .subscribe({
        next: (res: ApiResponse<PatientDropdownItem[]>) => {
          this.patients = Array.isArray(res.data) ? res.data : [];
          this.cdr.markForCheck();
        },
        error: (err) => {
          this.errorMsg =
            err?.error?.message || 'Failed to load patients. Please try again later.';
          this.cdr.markForCheck();
        },
      });
  }

  onPatientChange(patientId: number | null): void {
    this.selectedPatientId = patientId ?? null;
    this.clearPatientFields();

    if (!this.selectedFacilityId || !this.selectedPatientId) {
      this.cdr.markForCheck();
      return;
    }

    this.loadPatientDetail(this.selectedPatientId, this.selectedFacilityId);
  }

  private loadPatientDetail(patientId: number, facilityId: number): void {
    this.loadingPatientDetail = true;
    this.errorMsg = null;

    this.gs
      .getPatientById(patientId, facilityId)
      .pipe(finalize(() => (this.loadingPatientDetail = false)))
      .subscribe({
        next: (res: ApiResponse<PatientDetail>) => {
          const p = res.data;

          this.patientEmail = (p?.email || '').trim() || null;
          this.patientPhone = (p?.phone || '').trim() || null;
          this.patientAddress = this.formatPatientAddress(p);

          this.cdr.markForCheck();
        },
        error: (err) => {
          this.errorMsg =
            err?.error?.message || 'Failed to load patient details. Please try again later.';
          this.cdr.markForCheck();
        },
      });
  }

  private formatPatientAddress(p: PatientDetail | null | undefined): string | null {
    if (!p) return null;

    const parts: string[] = [];
    const address = (p.address || '').trim();
    const street = (p.street || '').trim();
    const zipcode = (p.zipcode || '').trim();

    if (address) parts.push(address);
    if (street) parts.push(street);
    if (zipcode) parts.push(zipcode);

    const joined = parts.filter(Boolean).join(', ');
    return joined || null;
  }

  private clearPatientFields(): void {
    this.patientEmail = null;
    this.patientAddress = null;
    this.patientPhone = null;
  }

  private buildProductLabel(x: DrugSupplyDropdownItem): string {
    const name = (x.productName || '').trim();
    const s = (x.strenght || '').trim() || '-';
    const df = (x.dosageForm || '').trim() || '-';
    const ps = (x.packageSize || '').trim() || '-';
    return `${name} - ${s} - ${df} - ${ps}`;
  }

  private emptyLineItem(): InvoiceLineItem {
    return {
      catalogId: null,
      drugId: null,
      productId: null,
      productName: null,
      quantity: 0,
      unitPrice: 0,
      lineTotal: 0,
      rowProducts: [],
      rowProductsLoading: false,
      rowSearchTerm: '',
      selectedProduct: null,
    };
  }

  private resetLineItemsToDefault(): void {
    this.lineItems = [this.emptyLineItem()];
    this.recalculateTotals(true);
  }

  onProductSelect(rowIndex: number, drugId: number | null): void {
    const row = this.lineItems[rowIndex];
    if (!row) return;

    if (!drugId) {
      this.updateRowState(rowIndex, {
        drugId: null,
        productId: null,
        productName: null,
        selectedProduct: null,
        unitPrice: 0,
        lineTotal: 0,
        quantity: 0,
      });
      this.recalculateTotals(true);
      return;
    }

    const selected = (row.rowProducts ?? []).find((p) => p.drugId === drugId);
    if (!selected) return;

    const qty = (!row.quantity || row.quantity < 0) ? 1 : row.quantity;
    this.updateRowState(rowIndex, {
      drugId: selected.drugId,
      productId: selected.productId,
      productName: selected.productName,
      selectedProduct: selected,
      unitPrice: Number(selected.price ?? 0),
      quantity: qty,
      lineTotal: qty * Number(selected.price ?? 0),
    });
    this.recalculateTotals(true);
  }

  onQtyChange(rowIndex: number, qty: number | null): void {
    const row = this.lineItems[rowIndex];
    if (!row) return;

    const q = Math.min(this.maxQty, Math.max(0, Number(qty ?? 0)));
    row.quantity = q;
    row.lineTotal = q * Number(row.unitPrice || 0);

    this.recalculateTotals(true);
  }

  private recalculateTotals(mark = false): void {
    const items = Array.isArray(this.lineItems) ? this.lineItems : [];

    this.lineItems = items.map((it) => {
      const qty = Math.max(0, Number(it.quantity || 0));
      const unit = Math.max(0, Number(it.unitPrice || 0));
      const lineTotal = qty * unit;
      return { ...it, quantity: qty, unitPrice: unit, lineTotal };
    });

    this.totalQty = this.lineItems.reduce((s, r) => s + (Number(r.quantity) || 0), 0);
    this.totalLineAmount = this.lineItems.reduce(
      (s, r) => s + (Number(r.lineTotal) || 0),
      0
    );

    if (mark) this.cdr.markForCheck();
  }

  readonly maxQty = 999;

  addLineItem(): void {
    this.lineItems = [...(this.lineItems || []), this.emptyLineItem()];
    this.recalculateTotals(true);
  }

  removeLineItem(index: number): void {
    const items = Array.isArray(this.lineItems) ? [...this.lineItems] : [];
    if (items.length <= 1) {
      items[0] = this.emptyLineItem();
      this.lineItems = items;
      this.recalculateTotals(true);
      return;
    }
    items.splice(index, 1);
    this.lineItems = items;
    this.recalculateTotals(true);
  }

  onQtyInput(rowIndex: number, ev: Event): void {
    const input = ev.target as HTMLInputElement;

    const raw = (input.value || '').trim();
    let digits = '';
    for (const ch of raw) {
      if (ch >= '0' && ch <= '9') digits += ch;
    }

    if (digits.length > 3) digits = digits.slice(0, 3);

    let num = digits ? Number(digits) : 0;

    if (num > this.maxQty) num = this.maxQty;
    if (num < 0) num = 0;

    input.value = String(num);

    this.onQtyChange(rowIndex, num);
  }

  onUnitPriceChange(rowIndex: number, amount: number | null): void {
    const row = this.lineItems[rowIndex];
    if (!row) return;

    const numeric = Number(amount ?? 0);
    const safeAmount = Number.isFinite(numeric) ? Math.max(0, numeric) : 0;

    row.unitPrice = safeAmount;
    row.lineTotal = Number(row.quantity || 0) * safeAmount;
    this.recalculateTotals(true);
  }

  createInvoice(): void {
    const payload = this.buildCreateInvoicePayload();
    if (!payload) return;

    this.modal.confirm({
      nzTitle: 'Confirm invoice creation',
      nzContent: 'Please confirm the data is correct. Once the invoice is created, it cannot be edited.',
      nzIconType: 'question-circle',
      nzOkText: 'Create Invoice',
      nzCancelText: 'Cancel',
      nzOnOk: () => this.submitCreateInvoice(payload),
    });
  }

  private buildCreateInvoicePayload():
    | {
        facilityId: number;
        patientId: number;
        amountDue: number;
        items: Array<{
          drugId: number;
          productId: number | null;
          productLineItemName: string;
          qty: number;
          unitPrice: number;
          lineTotal: number;
        }>;
      }
    | null {
    const facilityId = this.selectedFacilityId;
    const patientId = this.selectedPatientId;

    if (!facilityId || !patientId) {
      this.notification.warning(
        'Missing information',
        'Please select a facility and a patient before creating the invoice.'
      );
      return null;
    }

    const selectedLines = (this.lineItems || []).filter((li) => !!li.drugId);

    if (selectedLines.length === 0) {
      this.notification.warning('No products', 'Please select at least one product.');
      return null;
    }

    const invalidQtyLines = selectedLines.filter(
      (li) => Math.max(0, Number(li.quantity ?? 0)) === 0
    );

    if (invalidQtyLines.length > 0) {
      const rowNumbers = invalidQtyLines
        .map((li) => this.lineItems.indexOf(li) + 1)
        .filter((n) => n > 0)
        .join(', ');

      this.notification.error(
        'Invalid quantity',
        rowNumbers
          ? `Quantity must be greater than 0 for row(s): ${rowNumbers}.`
          : 'Quantity must be greater than 0 for all selected products.'
      );
      return null;
    }

    const items = selectedLines.map((li) => {
      const qty = Math.min(this.maxQty, Math.max(0, Number(li.quantity ?? 0)));
      const unitPrice = Math.max(0, Number(li.unitPrice ?? 0));
      const lineTotal = qty * unitPrice;

      const product = li.selectedProduct ?? null;

      const productId =
        (li.productId ?? product?.productId ?? null) as number | null;

      const productLineItemName = String(
        product?.displayLabel ||
        li.productName ||
        product?.productName ||
        `Drug #${li.drugId}`
      );

      return {
        drugId: li.drugId as number,
        productId,
        productLineItemName,
        qty,
        unitPrice,
        lineTotal,
      };
    });

    const amountDue = items.reduce((sum, x) => sum + (Number(x.lineTotal) || 0), 0);

    const payload = {
      facilityId,
      patientId,
      amountDue,
      items,
    };
    return payload;
  }

  private submitCreateInvoice(payload: {
    facilityId: number;
    patientId: number;
    amountDue: number;
    items: Array<{
      drugId: number;
      productId: number | null;
      productLineItemName: string;
      qty: number;
      unitPrice: number;
      lineTotal: number;
    }>;
  }): void {
    this.savingInvoice = true;
    this.cdr.markForCheck();

    this.gs.createManualClinicToPatientInvoice(payload).subscribe({
      next: (res:any) => {
        this.savingInvoice = false;
        this.notification.success('Invoice created', res.message);
        this.cdr.markForCheck();

        const createdInvoiceId = Number(res?.data?.invoiceId || 0);
        if (createdInvoiceId > 0) {
          if (this.embeddedInTabs && this.openCreatedInvoiceTab) {
            this.openCreatedInvoiceTab(createdInvoiceId);
          } else {
            this.router.navigate(['billing/clinicInvoices/detail', createdInvoiceId]);
          }
        }
      },
      error: (err) => {
        this.notification.error('Error', err?.message || 'Failed to create invoice.');
        this.savingInvoice = false;
        this.cdr.markForCheck();
      }
    })
  }

  readonly noClientFilter = () => true;

  trackByFacilityId = (_: number, x: FacilityDropdownItem) => x.facilityId;
  trackByPatientId = (_: number, x: PatientDropdownItem) => x.patientId;

  trackByDrugId = (_: number, x: DrugSupplyDropdownItem) => x.drugId;

  trackByIdx = (i: number) => i;
}
