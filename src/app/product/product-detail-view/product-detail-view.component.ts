import {
  Component,
  OnDestroy,
  OnInit,
  ChangeDetectionStrategy,
  ChangeDetectorRef
} from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import {
  AbstractControl,
  FormBuilder,
  FormGroup,
  ValidatorFn,
  Validators,
} from '@angular/forms';
import { Location } from '@angular/common';
import { Subject } from 'rxjs';
import { takeUntil, finalize } from 'rxjs/operators';
import { GeneralService } from 'app/shared/services/general.service';
import { PermissionsService } from 'app/shared/permission/permissions.service';
import { TitleService } from 'app/shared/services/title.service';

interface ApiResponse {
  status: number;
  message: string;
  data: any;
}

type MarkupType = 'Percentage' | 'Amount';

@Component({
  selector: 'app-product-detail-view',
  templateUrl: './product-detail-view.component.html',
  styleUrls: ['./product-detail-view.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ProductDetailViewComponent implements OnInit, OnDestroy {
  drugForm!: FormGroup;
  readonly markupTypeOptions: MarkupType[] = ['Percentage', 'Amount'];

  productId = 0;
  isLoading = false;
  hasError = false;
  isDisabled = false;
  isSaving = false;

  private destroy$ = new Subject<void>();

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

  constructor(
    private route: ActivatedRoute,
    private fb: FormBuilder,
    private generalService: GeneralService,
    private permissionService: PermissionsService,
    private _location: Location,
    private titleService: TitleService,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    this.productId = Number(this.route.snapshot.paramMap.get('id')) || 0;
    this.isDisabled = !this.permissionService.hasAnyPermission(['product_edit']);

    this.titleService.updateTitle(
      'Drug',
      [
        { label: 'Drugs Catalog', path: '/product/view/Drugs' },
        { label: 'Drug Detail', path: `/product/drug/${this.productId}` }
      ]
    );

    this.initForm();
    this.wireWholesaleComputation();

    if (this.productId) {
      this.getDrugDetails();
    } else {

      this.isLoading = false;
      this.cdr.markForCheck();
    }
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  private initForm(): void {
    this.drugForm = this.fb.group({

      name: ['', [Validators.required, this.whitespaceValidator()]],

      strenght: ['', [Validators.required, this.whitespaceValidator()]],
      dosageForm: [null, [Validators.required]],
      controlSubstance: [null, [this.booleanSelectedValidator()]],

      price: [null, [Validators.required, Validators.min(0)]],
      markupType: ['Percentage' as MarkupType, [Validators.required]],
      markup: [0, [Validators.required, Validators.min(0), Validators.max(100)]],
      comparePrice: [{ value: null, disabled: true }],
      suggestedRetail: [null, [Validators.min(0)]],

      packageSize: ['', [Validators.required, this.whitespaceValidator()]],
    });

    if (this.isDisabled) this.drugForm.disable();
    this.cdr.markForCheck();
  }

  private wireWholesaleComputation(): void {
    this.drugForm.get('price')!
      .valueChanges.pipe(takeUntil(this.destroy$))
      .subscribe(() => this.computeWholesale());

    this.drugForm.get('markup')!
      .valueChanges.pipe(takeUntil(this.destroy$))
      .subscribe(() => this.computeWholesale());

    this.drugForm.get('markupType')!
      .valueChanges.pipe(takeUntil(this.destroy$))
      .subscribe((markupType: MarkupType) => {
        this.applyMarkupValidators(markupType);
        this.computeWholesale();
      });
  }

  private normalizeMarkupType(value: any): MarkupType {
    return value === 'Amount' ? 'Amount' : 'Percentage';
  }

  private applyMarkupValidators(markupType: MarkupType): void {
    const markupControl = this.drugForm.get('markup');
    if (!markupControl) return;

    if (markupType === 'Percentage') {
      markupControl.setValidators([Validators.required, Validators.min(0), Validators.max(100)]);
    } else {
      markupControl.setValidators([Validators.required, Validators.min(0)]);
    }

    markupControl.updateValueAndValidity({ emitEvent: false });
    this.cdr.markForCheck();
  }

  getDrugDetails(): void {
    this.isLoading = true;
    this.hasError = false;
    this.cdr.markForCheck();

    this.generalService
      .commonGet(`Products/GetDrugByIdNew?Id=${this.productId}`)
      .pipe(
        takeUntil(this.destroy$),
        finalize(() => {
          this.isLoading = false;
          this.cdr.markForCheck();
        })
      )
      .subscribe({
        next: (res: ApiResponse) => {
          if (res?.status === 1 && res?.data) {
            const d = res.data || {};
            const markupType = this.normalizeMarkupType(d.markupType);

            const priceFromApi = d.pharmacyPrice ?? d.price ?? null;
            const markupFromApi = d.markupPercent;
            const wholesaleFromApi = d.wholesalePrice;

            let derivedMarkup = 0;
            if ((markupFromApi == null || isNaN(Number(markupFromApi))) &&
                priceFromApi != null && Number(priceFromApi) > 0 &&
                wholesaleFromApi != null) {
              derivedMarkup = markupType === 'Amount'
                ? Number(wholesaleFromApi) - Number(priceFromApi)
                : (Number(wholesaleFromApi) / Number(priceFromApi) - 1) * 100;
            }

            const finalMarkup = (markupFromApi != null && !isNaN(Number(markupFromApi)))
              ? Number(markupFromApi)
              : Math.max(0, Math.round(derivedMarkup * 100) / 100);

            const finalCompare = (wholesaleFromApi != null && !isNaN(Number(wholesaleFromApi)))
              ? Number(wholesaleFromApi)
              : (priceFromApi != null && !isNaN(Number(priceFromApi)))
                ? markupType === 'Amount'
                  ? Math.round((Number(priceFromApi) + finalMarkup) * 100) / 100
                  : Math.round((Number(priceFromApi) * (1 + finalMarkup / 100)) * 100) / 100
                : null;

            this.drugForm.patchValue({
              name: d.name ?? '',
              strenght: d.strenght ?? '',
              dosageForm: d.dosageForm ?? null,
              controlSubstance: typeof d.controlSubstance === 'boolean' ? d.controlSubstance : null,

              price: priceFromApi,
              markupType,
              markup: finalMarkup,
              comparePrice: finalCompare,
              suggestedRetail: d.suggestedRetail ?? null,

              packageSize: d.packageSize ?? '',
            });

            this.titleService.updateTitle(
              d.name ?? 'Drug',
              [
                { label: 'Drugs Catalog', path: '/product/view/Drugs' },
                { label: 'Drug Detail', path: `/product/drug/${this.productId}` }
              ]
            );
          } else {
            this.hasError = true;
            this.titleService.updateTitle('Error');
            this.generalService.showError(res?.message || 'Failed to load drug details.');
          }

          this.cdr.markForCheck();
        },
        error: (err) => {
          this.hasError = true;
          this.titleService.updateTitle('Error');
          this.generalService.showError(err?.message || 'Network error while loading drug details.');
          this.cdr.markForCheck();
        }
      });
  }

  saveDrug(): void {
    if (this.drugForm.invalid) {
      this.drugForm.markAllAsTouched();
      this.generalService.showError('Please fill all required fields.');
      this.cdr.markForCheck();
      return;
    }

    this.isSaving = true;
    this.cdr.markForCheck();

    const v = this.drugForm.getRawValue();

    const payload = {
      drugId: this.productId,
      name: (v.name ?? '').trim(),
      strenght: (v.strenght ?? '').trim(),
      dosageForm: v.dosageForm,
      packageSize: (v.packageSize ?? '').trim(),
      controlSubstance: !!v.controlSubstance,

      price: Number(v.price),
      markupType: this.normalizeMarkupType(v.markupType),
      markup: Number(v.markup),
      comparePrice: v.comparePrice != null ? Number(v.comparePrice) : null,
      suggestedRetail: v.suggestedRetail != null ? Number(v.suggestedRetail) : null
    };

    this.generalService
      .commonPost('Products/saveDrug', payload)
      .pipe(
        takeUntil(this.destroy$),
        finalize(() => {
          this.isSaving = false;
          this.cdr.markForCheck();
        })
      )
      .subscribe({
        next: (res: ApiResponse) => {
          if (res?.status === 1) {
            this.generalService.showSuccess(res?.message || 'Saved successfully.');

            this.getDrugDetails();
          } else {
            this.generalService.showError(res?.message || 'Save failed.');
          }
        },
        error: (err) => {
          this.generalService.showError(err?.message || 'Network error while saving.');
        }
      });
  }

  moveBack(): void {
    this._location.back();
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

  private computeWholesale(): void {
    const price = Number(this.drugForm.get('price')!.value);
    const markup = Number(this.drugForm.get('markup')!.value);
    const markupType = this.normalizeMarkupType(this.drugForm.get('markupType')!.value);
    if (isFinite(price) && price >= 0 && isFinite(markup) && markup >= 0) {
      const computed = markupType === 'Amount'
        ? price + markup
        : price * (1 + markup / 100);
      const rounded = Math.round(computed * 100) / 100;
      this.drugForm.get('comparePrice')!.setValue(rounded, { emitEvent: false });
    } else {
      this.drugForm.get('comparePrice')!.setValue(null, { emitEvent: false });
    }
    this.cdr.markForCheck();
  }

  private whitespaceValidator(): ValidatorFn {
    return (control: AbstractControl) => {
      const value = (control.value ?? '').toString();
      if (!value) return null;
      return value.trim().length === 0 ? { whitespace: true } : null;
    };
  }

  private booleanSelectedValidator(): ValidatorFn {
    return (control: AbstractControl) => {
      const v = control.value;
      return v === true || v === false ? null : { required: true };
    };
  }
}
