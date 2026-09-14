import { ChangeDetectionStrategy, ChangeDetectorRef, Component, Input, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { finalize } from 'rxjs/operators';
import { NzModalService } from 'ng-zorro-antd/modal';
import { NzNotificationService } from 'ng-zorro-antd/notification';
import { GeneralService } from 'app/shared/services/general.service';
import { TitleService } from 'app/shared/services/title.service';

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
  guid?: string;
  organizationId?: number;
  organizationName?: string;
}

interface FacilityDetail {
  guid: string;
  facilityId: number;
  titleLong: string;
  titleShort: string;
  email: string | null;
  phone: string | null;
  status: string | null;
  completeAddress: string | null;
  address: string | null;
  zipCode: string | null;
}

interface InvoiceLineItem {
  productLineItemName: string;
  qty: number;
  unitPrice: number;
  lineTotal: number;
}

@Component({
  selector: 'app-manual-clinic-bill',
  templateUrl: './manual-clinic-bill.component.html',
  styleUrl: './manual-clinic-bill.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ManualClinicBillComponent implements OnInit {
  @Input() embeddedInTabs = false;
  @Input() openCreatedInvoiceTab?: (invoiceId: number) => void;

  errorMsg: string | null = null;
  invoiceDate = new Date();

  loadingFacilities = false;
  loadingFacilityDetail = false;
  savingInvoice = false;

  facilities: FacilityDropdownItem[] = [];
  selectedFacilityId: number | null = null;

  facilityName: string | null = null;
  facilityEmail: string | null = null;
  facilityPhone: string | null = null;
  facilityAddress: string | null = null;
  facilityStatus: string | null = null;

  lineItems: InvoiceLineItem[] = [];
  totalQty = 0;
  totalLineAmount = 0;

  readonly maxQty = 999;

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
      this.title.updateTitle('Create Clinic Invoice', [
        { label: 'Clinic Invoices', path: '/billing/clinicBills' },
        { label: 'Create', path: 'billing/manualClinicBills' },
      ]);
    }

    this.loadFacilities();
    this.resetLineItemsToDefault();
  }

  private loadFacilities(): void {
    this.loadingFacilities = true;
    this.errorMsg = null;

    this.gs
      .getAllFacilitiesDropdown()
      .pipe(finalize(() => {
        this.loadingFacilities = false;
        this.cdr.markForCheck();
      }))
      .subscribe({
        next: (res: ApiResponse<FacilityDropdownItem[]>) => {
          this.facilities = Array.isArray(res?.data) ? res.data : [];
        },
        error: (err) => {
          this.errorMsg =
            err?.error?.message || 'Failed to load facilities. Please try again later.';
        },
      });
  }

  onFacilityChange(facilityId: number | null): void {
    this.selectedFacilityId = facilityId ?? null;
    this.clearFacilityFields();

    if (!this.selectedFacilityId) {
      this.cdr.markForCheck();
      return;
    }

    this.loadFacilityDetail(this.selectedFacilityId);
  }

  private loadFacilityDetail(facilityId: number): void {
    this.loadingFacilityDetail = true;
    this.errorMsg = null;

    this.gs
      .getFacilityById(facilityId)
      .pipe(finalize(() => {
        this.loadingFacilityDetail = false;
        this.cdr.markForCheck();
      }))
      .subscribe({
        next: (res: ApiResponse<FacilityDetail>) => {
          const facility = res?.data;
          this.facilityName = facility?.titleLong?.trim() || this.getFacilityNameById(facilityId);
          this.facilityEmail = facility?.email?.trim() || null;
          this.facilityPhone = facility?.phone?.trim() || null;
          this.facilityAddress =
            facility?.completeAddress?.trim() ||
            facility?.address?.trim() ||
            null;
          this.facilityStatus = facility?.status?.trim() || null;
        },
        error: (err) => {
          this.errorMsg =
            err?.error?.message || 'Failed to load clinic details. Please try again later.';
        },
      });
  }

  private clearFacilityFields(): void {
    this.facilityName = null;
    this.facilityEmail = null;
    this.facilityPhone = null;
    this.facilityAddress = null;
    this.facilityStatus = null;
  }

  private resetLineItemsToDefault(): void {
    this.lineItems = [
      {
        productLineItemName: '',
        qty: 0,
        unitPrice: 0,
        lineTotal: 0,
      },
    ];
    this.recalculateTotals(true);
  }

  private recalculateTotals(mark = false): void {
    const items = Array.isArray(this.lineItems) ? this.lineItems : [];

    this.lineItems = items.map((it) => {
      const qty = Math.max(0, Number(it.qty || 0));
      const unitPrice = Math.max(0, Number(it.unitPrice || 0));
      const productLineItemName = String(it.productLineItemName || '');
      return {
        ...it,
        productLineItemName,
        qty,
        unitPrice,
        lineTotal: qty * unitPrice,
      };
    });

    this.totalQty = this.lineItems.reduce((sum, item) => sum + (Number(item.qty) || 0), 0);
    this.totalLineAmount = this.lineItems.reduce(
      (sum, item) => sum + (Number(item.lineTotal) || 0),
      0
    );

    if (mark) {
      this.cdr.markForCheck();
    }
  }

  addLineItem(): void {
    this.lineItems = [
      ...this.lineItems,
      {
        productLineItemName: '',
        qty: 0,
        unitPrice: 0,
        lineTotal: 0,
      },
    ];
    this.recalculateTotals(true);
  }

  removeLineItem(index: number): void {
    const items = Array.isArray(this.lineItems) ? [...this.lineItems] : [];
    if (items.length <= 1) {
      items[0] = {
        productLineItemName: '',
        qty: 0,
        unitPrice: 0,
        lineTotal: 0,
      };
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
      if (ch >= '0' && ch <= '9') {
        digits += ch;
      }
    }

    if (digits.length > 3) {
      digits = digits.slice(0, 3);
    }

    let num = digits ? Number(digits) : 0;
    if (num > this.maxQty) num = this.maxQty;
    if (num < 0) num = 0;

    input.value = String(num);
    this.onQtyChange(rowIndex, num);
  }

  onQtyChange(rowIndex: number, qty: number | null): void {
    const row = this.lineItems[rowIndex];
    if (!row) return;

    row.qty = Math.min(this.maxQty, Math.max(0, Number(qty ?? 0)));
    row.lineTotal = row.qty * Number(row.unitPrice || 0);
    this.recalculateTotals(true);
  }

  onUnitPriceChange(rowIndex: number, amount: number | null): void {
    const row = this.lineItems[rowIndex];
    if (!row) return;

    const numeric = Number(amount ?? 0);
    const safeAmount = Number.isFinite(numeric) ? Math.max(0, numeric) : 0;

    row.unitPrice = safeAmount;
    row.lineTotal = Number(row.qty || 0) * safeAmount;
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
        amountDue: number;
        invoiceDate: string;
        items: Array<{
          productLineItemName: string;
          qty: number;
          unitPrice: number;
          lineTotal: number;
        }>;
      }
    | null {
    const facilityId = this.selectedFacilityId;

    if (!facilityId) {
      this.notification.warning(
        'Missing information',
        'Please select a clinic before creating the invoice.'
      );
      return null;
    }

    const selectedLines = (this.lineItems || [])
      .map((line, index) => ({
        ...line,
        productLineItemName: String(line.productLineItemName || '').trim(),
        index,
      }))
      .filter(
        (line) =>
          line.productLineItemName.length > 0 ||
          Number(line.qty ?? 0) > 0 ||
          Number(line.unitPrice ?? 0) > 0
      );

    if (selectedLines.length === 0) {
      this.notification.warning('No line items', 'Please add at least one line item.');
      return null;
    }

    const invalidDetailLines = selectedLines.filter(
      (line) => line.productLineItemName.length === 0
    );
    if (invalidDetailLines.length > 0) {
      const rowNumbers = invalidDetailLines.map((line) => line.index + 1).join(', ');
      this.notification.error(
        'Missing line item detail',
        rowNumbers
          ? `Line item detail cannot be empty for row(s): ${rowNumbers}.`
          : 'Line item detail cannot be empty.'
      );
      return null;
    }

    const invalidQtyLines = selectedLines.filter(
      (line) => !Number.isFinite(Number(line.qty ?? 0)) || Number(line.qty ?? 0) <= 0
    );
    if (invalidQtyLines.length > 0) {
      const rowNumbers = invalidQtyLines.map((line) => line.index + 1).join(', ');
      this.notification.error(
        'Invalid quantity',
        rowNumbers
          ? `Quantity must be greater than 0 for row(s): ${rowNumbers}.`
          : 'Quantity must be greater than 0 for all line items.'
      );
      return null;
    }

    const invalidUnitPriceLines = selectedLines.filter(
      (line) => !Number.isFinite(Number(line.unitPrice ?? 0)) || Number(line.unitPrice ?? 0) <= 0
    );
    if (invalidUnitPriceLines.length > 0) {
      const rowNumbers = invalidUnitPriceLines.map((line) => line.index + 1).join(', ');
      this.notification.error(
        'Invalid unit price',
        rowNumbers
          ? `Unit price must be greater than 0 for row(s): ${rowNumbers}.`
          : 'Unit price must be greater than 0 for all line items.'
      );
      return null;
    }

    const items = selectedLines.map((line) => {
      const qty = Math.min(this.maxQty, Math.max(0, Number(line.qty ?? 0)));
      const unitPrice = Math.max(0, Number(line.unitPrice ?? 0));
      return {
        productLineItemName: line.productLineItemName,
        qty,
        unitPrice,
        lineTotal: qty * unitPrice,
      };
    });

    const amountDue = items.reduce((sum, item) => sum + (Number(item.lineTotal) || 0), 0);

    return {
      facilityId,
      amountDue,
      invoiceDate: this.invoiceDate.toISOString(),
      items,
    };
  }

  private submitCreateInvoice(payload: {
    facilityId: number;
    amountDue: number;
    invoiceDate: string;
    items: Array<{
      productLineItemName: string;
      qty: number;
      unitPrice: number;
      lineTotal: number;
    }>;
  }): void {
    this.savingInvoice = true;
    this.cdr.markForCheck();

    this.gs.createManualGAToClinicInvoice(payload).subscribe({
      next: (res: any) => {
        this.savingInvoice = false;
        this.notification.success('Invoice created', res?.message || 'Invoice created successfully.');
        this.cdr.markForCheck();

        const createdInvoiceId = Number(res?.data?.invoiceId || 0);
        if (createdInvoiceId > 0) {
          if (this.embeddedInTabs && this.openCreatedInvoiceTab) {
            this.openCreatedInvoiceTab(createdInvoiceId);
          } else {
            this.router.navigate(['billing/clinicBills/manual', createdInvoiceId]);
          }
        }
      },
      error: (err) => {
        this.notification.error('Error', err?.error?.message || err?.message || 'Failed to create invoice.');
        this.savingInvoice = false;
        this.cdr.markForCheck();
      }
    });
  }

  private getFacilityNameById(facilityId: number): string {
    return this.facilities.find((facility) => facility.facilityId === facilityId)?.titlelong || `Clinic #${facilityId}`;
  }

  trackByFacilityId = (_: number, facility: FacilityDropdownItem) => facility.facilityId;
  trackByIdx = (index: number) => index;
}
