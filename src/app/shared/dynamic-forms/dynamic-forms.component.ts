import { HttpClient } from '@angular/common/http';
import { ChangeDetectionStrategy, ChangeDetectorRef, Component, EventEmitter, Input, Output } from '@angular/core';
import { FormGroup, FormBuilder, Validators, ValidatorFn } from '@angular/forms';
import { NzUploadChangeParam, NzUploadFile } from 'ng-zorro-antd/upload';
import { HttpService } from '../services/http.service';
import { ValidationService } from '../Validation/validation.service';
import { GeneralService } from '../services/general.service';
import { debounceTime, distinctUntilChanged, Observable, Subject, takeUntil } from 'rxjs';
import { environment } from 'environments/environment';
import {AuthService} from "../Auth/auth.service";

type BeforeUploadFn = (file: NzUploadFile, fileList: NzUploadFile[]) => boolean | Observable<boolean>;

interface DynamicFormConfig {
  title: string;
  primaryId: string;
  rows: FormRow[];
}

interface FormRow {
  class: string;
  title?: string;
  des?: string;
  fields: FormField[];
  visibilityCondition?: VisibilityCondition;
}

interface FormField {
  type: 'text' | 'tel' | 'email' | 'password' | 'number' | 'checkbox' | 'radio' | 'textarea' | 'select' | 'date' | 'switch' | 'multi-select' | 'month' | 'file' | 'file-drag' | 'payment-mode-cards';
  label?: string;
  name: string;
  placeholder?: string;
  class?: string;
  fieldClass?: string;
  labelClass?: string;
  disabled?: boolean;
  loading?: boolean;
  validations?: Validations;
  options?: SelectOption[];
  fetchUrl?: string;
  labelKey?: string[];
  valueKey?: string;
  joinBy?: string;
  dependsOn?: string | string[];
  visibilityCondition?: VisibilityCondition;

  enabledWhen?: { name: string; value: any };
  iconText?: string;
  additionalText?: string;
  fileAllowed?: 'single' | 'multiple';
  checkedLabel?: string;
  unCheckedLabel?: string;
  disableDates?: DisableDatesConfig;
  hiddenForRoleIds?: number[];
  visibleForRoleIds?: number[];
}

interface Validations {
  required?: boolean;
  minLength?: number;
  pattern?: string;
  min?: number;
  max?: number;
}

interface SelectOption {
  label: string;
  value: string | number | boolean;
}

interface VisibilityCondition {
  name: string;
  value: any;
}

interface DisableDatesConfig {
  type: 'future' | 'past' | 'range' | 'list' | 'dynamic';
  minDate?: string;
  maxDate?: string;
  dates?: string[];
  dependsOnDate?: string;
  restrict?: 'before' | 'after';
}

@Component({
  selector: 'app-dynamic-forms',
  templateUrl: './dynamic-forms.component.html',
  styleUrl: './dynamic-forms.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush
})

export class DynamicFormsComponent {

  @Input() jsonPath: string = '';
  @Input() apiUrl: { save?: string; get?: string } = {};
  @Input() editData: any = null;
  @Input() isCustomSubmit: boolean = false;
  @Input() isCustomGet: boolean = false;
  @Input() primaryId: number = 0;
  @Input() facilityId: number = 0;
  @Input() roleId: number = 0;
  @Input() type: string = '';

  @Output() formSubmit = new EventEmitter<any>();
  @Output() formStatus = new EventEmitter<{
    success: boolean;
    message: string;
    data: string | boolean | number | null;
    isValidationError?: boolean;
  }>();

  uploadFileLists: Record<string, NzUploadFile[]> = {};
  beforeUploadHandlers: Record<string, BeforeUploadFn> = {};

  defaultBeforeUpload: BeforeUploadFn = () => true;

  formGroup!: FormGroup;
  formConfig!: DynamicFormConfig;
  loadingForm: boolean = false;
  btnLoading: boolean = false;
  passwordFieldTypes: { [key: string]: string } = {};
  uploadUrl: string = `${environment.IAMGE_PATH}/api/Commons/UploadFile`;
  token: string | null = this.auth.getToken()
  private destroy$ = new Subject<void>();
  isUpdateForm: boolean = false;
  readonly selectedFacilityId: number = Number(localStorage.getItem('FOS'));

  constructor(
    private fb: FormBuilder,
    private http: HttpClient,
    private api: HttpService,
    private cdr: ChangeDetectorRef,
    private validationService: ValidationService,
    private generalService: GeneralService,
    private auth: AuthService,
  ) {}

  trackByRow = (index: number): string => index.toString();
  trackByField = (index: number, field: FormField): string => field.name || index.toString();

  isFieldVisibleForRole(field: FormField): boolean {
    const effectiveRoleId = this.roleId > 0 ? this.roleId : Number(this.auth.getUserRoleId() || 0);

    if (Array.isArray(field.hiddenForRoleIds) && field.hiddenForRoleIds.includes(effectiveRoleId)) {
      return false;
    }

    if (Array.isArray(field.visibleForRoleIds) && field.visibleForRoleIds.length > 0) {
      return field.visibleForRoleIds.includes(effectiveRoleId);
    }

    return true;
  }

  disableDates(field: FormField): (current: Date) => boolean {
    return (current: Date): boolean => {
      if (!field.disableDates) {
        return false;
      }

      const today = new Date();
      today.setHours(0, 0, 0, 0);

      if (field.disableDates.type === 'future') {
        return current >= today;
      } else if (field.disableDates.type === 'past') {
        return current < today;
      } else if (field.disableDates.type === 'range') {
        const minDate = field.disableDates.minDate ? new Date(field.disableDates.minDate) : null;
        const maxDate = field.disableDates.maxDate ? new Date(field.disableDates.maxDate) : null;
        if (minDate && maxDate) {
          return current < minDate || current > maxDate;
        } else if (minDate) {
          return current < minDate;
        } else if (maxDate) {
          return current > maxDate;
        }
      } else if (field.disableDates.type === 'list' && field.disableDates.dates) {
        const disabledDates = field.disableDates.dates.map((d: string) => new Date(d).toDateString());
        return disabledDates.includes(current.toDateString());
      } else if (field.disableDates.type === 'dynamic' && field.disableDates.dependsOnDate) {
        const dependentDate = this.formGroup.get(field.disableDates.dependsOnDate)?.value;
        if (dependentDate) {
          const compareDate = new Date(dependentDate);
          if (field.disableDates.restrict === 'after') {
            return current <= compareDate;
          } else if (field.disableDates.restrict === 'before') {
            return current >= compareDate;
          }
        }
      }

      return false;
    };
  }

  ngOnInit() {
    this.loadFormConfig();
  }

  ngOnDestroy() {
    this.destroy$.next();
    this.destroy$.complete();
    this.passwordFieldTypes = {};
  }

  loadFormConfig() {
    this.loadingForm = true;
    if (this.jsonPath) {
      this.http.get<DynamicFormConfig>(this.jsonPath).pipe(takeUntil(this.destroy$)).subscribe({
        next: (config) => {
          this.formConfig = config;
          this.buildForm();
          this.registerUploadHandlers();
          this.setupFieldDependencies();
          this.setupEnabledWhenConditions();
          if (this.primaryId > 0) {
            this.getData();
          }
          this.loadingForm = false;
          this.cdr.detectChanges();
        },
        error: () => {
          this.loadingForm = false;
          this.cdr.detectChanges();
        }
      });
    } else {
      console.error('No JSON path provided for dynamic form configuration.');
      this.cdr.detectChanges();
    }
  }

  setupFieldDependencies(): void {
    this.formConfig.rows.forEach((row: FormRow) => {
      row.fields.forEach((field: FormField) => {
        if (field.dependsOn) {
          const dependencies = Array.isArray(field.dependsOn) ? field.dependsOn : [field.dependsOn];
          dependencies.forEach((dependentFieldName: string) => {
            const dependentControl = this.formGroup.get(dependentFieldName);
            if (dependentControl) {
              dependentControl.valueChanges.pipe(
                debounceTime(50),
                distinctUntilChanged(),
                takeUntil(this.destroy$)
              ).subscribe(() => {
                field.loading = true;
                this.updateFieldOptions(field);
                this.checkVisibilityCondition(field);
              });
            }
          });
          this.updateFieldOptions(field);
          this.checkVisibilityCondition(field);
        } else {
          this.loadDynamicOptions(field);
        }
      });
    });
  }

  setupEnabledWhenConditions(): void {
    this.formConfig?.rows?.forEach((row: FormRow) => {
      row.fields.forEach((field: FormField) => {
        if (!field.enabledWhen) return;
        const controller = this.formGroup.get(field.enabledWhen.name);
        if (controller) {
          controller.valueChanges
            .pipe(takeUntil(this.destroy$))
            .subscribe(() => this.applyEnabledWhen(field));
        }

        this.applyEnabledWhen(field);
      });
    });
  }

  private applyEnabledWhen(field: FormField): void {
    if (!field.enabledWhen) return;
    const control = this.formGroup.get(field.name);
    const controller = this.formGroup.get(field.enabledWhen.name);
    if (!control || !controller) return;

    const shouldEnable = controller.value === field.enabledWhen.value;
    if (shouldEnable) {
      if (control.disabled) control.enable({ emitEvent: false });
    } else {
      if (!control.disabled) control.disable({ emitEvent: false });
      if (control.value !== false) control.setValue(false, { emitEvent: false });
    }
  }

  private applyAllEnabledWhen(): void {
    this.formConfig?.rows?.forEach((row: FormRow) => {
      row.fields.forEach((field: FormField) => {
        if (field.enabledWhen) this.applyEnabledWhen(field);
      });
    });
  }

  updateFieldOptions(field: FormField): void {
    const dependenciesMet = Array.isArray(field.dependsOn)
      ? field.dependsOn.every((dep: string) => !!this.formGroup.get(dep)?.value)
      : !!this.formGroup.get(field.dependsOn as string)?.value;

    if (dependenciesMet) {
      field.options = [];
      this.loadDynamicOptions(field);
      if (this.isUpdateForm) return;
      this.formGroup.get(field.name)?.setValue(null);
    } else {
      this.formGroup.get(field.name)?.setValue(null);
      field.options = [];
      field.loading = false;
    }
  }

  private loadDynamicOptions(field: FormField): void {
    if (!field.fetchUrl) return;

    let url = field.fetchUrl;

    if (url === 'Dropdowns/getAllUSCities') {
      this.loadCities().pipe(takeUntil(this.destroy$)).subscribe((cities) => {
        field.options = this.transformOptions(cities, field.labelKey, field.valueKey, field?.joinBy);
      });
      return;
    }

    if (Array.isArray(field.dependsOn)) {
      field.dependsOn.forEach((dep: string) => {
        const value = this.formGroup.get(dep)?.value || '';
        url = url.replace(`{${dep}}`, value);
      });
    } else if (field.dependsOn) {
      const value = this.formGroup.get(field.dependsOn as string)?.value || '';
      url = url.replace(`{${field.dependsOn}}`, value);
    }

    if (url.includes('{FacId}')) {
      url = url.replace('{FacId}', this.selectedFacilityId.toString());
    }

    if (url.includes('{primaryId}')) {
      url = url.replace('{primaryId}', this.primaryId.toString());
    }

    this.api.get(url).pipe(takeUntil(this.destroy$)).subscribe({
      next: (res: any) => {
        if (res.status === 1 && res.data) {
          field.options = this.transformOptions(res.data, field.labelKey, field.valueKey, field?.joinBy);
          this.cdr.markForCheck();
        }
      },
      error: (error: any) => {
        console.error(`Failed to load options for ${field.name}`, error);
        this.cdr.markForCheck();

      },
      complete: () => {
        field.loading = false;
        this.cdr.markForCheck();
      },
    });
  }

  loadCities(): Observable<any[]> {
    return this.generalService.getAllCities();
  }

  transformOptions(data: any[] | {}, labelKeys: string[] | undefined, valueKey: string | undefined, joinBy?: string): any[] {
    const dataArray = Array.isArray(data) ? data : [data];
    return dataArray.map((item: any) => {
      const label = labelKeys
        ? labelKeys
            .map((key) => item[key])
            .filter((value) => !!value)
            .join(joinBy || ' ')
        : item.toString();
      return { label, value: valueKey ? item[valueKey] : item };
    });
  }

  isFieldsVisible(data: FormRow | FormField): boolean {
    if (!data.visibilityCondition) return true;
    const { name, value } = data.visibilityCondition;
    const controlValue = this.formGroup.get(name)?.value;

    if (controlValue === value) {
      if ('fields' in data && data.fields) {
        data.fields.forEach((field: FormField) => {
          const control = this.formGroup.get(field.name);
          const validators = this.getFieldValidators(field);
          if (control) {
            control.setValidators(validators);
            control.updateValueAndValidity();
          }
        });
      } else if ('name' in data) {
        const control = this.formGroup.get(data.name);
        const validators = this.getFieldValidators(data as FormField);
        if (control) {
          control.setValidators(validators);
          control.updateValueAndValidity();
        }
      }
      return true;
    } else {
      if ('fields' in data && data.fields) {
        data.fields.forEach((field: FormField) => {
          const control = this.formGroup.get(field.name);
          if (control) {
            control.setValidators([]);
            control.updateValueAndValidity();
          }
        });
      } else if ('name' in data) {
        const control = this.formGroup.get(data.name);
        if (control) {
          control.setValidators([]);
          control.updateValueAndValidity();
        }
      }
      return false;
    }
  }

  checkVisibilityCondition(field: FormField) {
    if (field.visibilityCondition) {
      const { name, value } = field.visibilityCondition;
      const controlValue = this.formGroup.get(name)?.value;

      if (controlValue === value) {
        this.showField(field);
      } else {
        this.hideField(field);
      }
    }
  }

  showField(field: FormField) {
    this.formGroup.addControl(field.name, this.fb.control(null, this.getFieldValidators(field)));
  }

  hideField(field: FormField) {
    this.formGroup.removeControl(field.name);
  }

  buildForm() {
    const group: { [key: string]: any } = {};

    if (this.formConfig?.primaryId) {
      const primaryIdField = this.formConfig.primaryId;
      group[primaryIdField] = [this.primaryId || 0];
    }

    if (this.facilityId && this.facilityId > 0) {
      group['facilityId'] = this.facilityId;
    }

    if (this.roleId && this.roleId > 0) {
      group['roleId'] = this.roleId;
    }

    this.formConfig?.rows?.forEach((row: FormRow) => {
      row.fields.forEach((field: FormField) => {
        const validators = this.getFieldValidators(field);
        group[field.name] = [field.type === 'checkbox' ? false : null, validators];
      });
    });

    this.formGroup = this.fb.group(group);
    this.validationService.applyGlobalValidators(this.formGroup);
  }

  private getFieldValidators(field: FormField): ValidatorFn[] {
    const validators: ValidatorFn[] = [];
    if (field.validations) {
      if (field.validations.required) validators.push(Validators.required);
      if (field.validations.minLength) validators.push(Validators.minLength(field.validations.minLength));
      if (field.validations.pattern) validators.push(Validators.pattern(field.validations.pattern));
      if (field.validations.min) validators.push(Validators.min(field.validations.min));
      if (field.validations.max) validators.push(Validators.max(field.validations.max));
    }
    return validators;
  }

  populateEditData(data: any) {
    if (!data) return;
    this.isUpdateForm = true;
    this.formGroup.patchValue(data);

    this.formConfig?.rows?.forEach((row: any) => {
      row?.fields?.forEach((field: any) => {
        if (field?.disableOnEdit) {
          this.formGroup.get(field.name)?.disable({ emitEvent: false });
        }
        if (field?.hideOnEdit) {
          const ctrl = this.formGroup.get(field.name);
          if (ctrl) {
            ctrl.clearValidators();
            ctrl.clearAsyncValidators();
            ctrl.updateValueAndValidity({ emitEvent: false });
          }
        }
      });
    });

    this.applyAllEnabledWhen();

    setTimeout(() => {
      this.isUpdateForm = false;
    }, 2000);
  }

  isFieldHiddenOnEdit(field: any): boolean {
    return !!field?.hideOnEdit && Number(this.primaryId) > 0;
  }

  onSubmit(): void {
    this.btnLoading = true;
    if (this.formGroup.invalid) {
      Object.keys(this.formGroup.controls).forEach((field) => {
        const control = this.formGroup.get(field);
        if (control) {
          control.markAsTouched({ onlySelf: true });
          control.updateValueAndValidity();
        }
      });
      this.formStatus.emit({
        success: false,
        message: 'Form is not valid!',
        data: null,
        isValidationError: true
      });
      this.btnLoading = false;
      this.generalService.showError('Please fill out all required fields');
      return;
    }

    const payload = this.buildSubmitPayload();
    this.formSubmit.emit(payload);
    if (!this.apiUrl?.save) {
      this.btnLoading = false;
      return;
    }
    this.api.post(this.apiUrl.save, payload).pipe(takeUntil(this.destroy$)).subscribe({
      next: (res: any) => {
        if (res.status === 1 && res.data !== null) {
          this.formStatus.emit({
            success: true,
            message: 'Data saved successfully!',
            data: res.data,
            isValidationError: false
          });
          this.generalService.showSuccess(res.message);
        }
        else if (res.status === 200) {
          this.formStatus.emit({
            success: true,
            message: 'Data saved successfully!',
            data: res.data,
            isValidationError: false
          });
          this.generalService.showSuccess(res.message);
        }
        else {
          this.formStatus.emit({
            success: false,
            message: 'Error while Submitting',
            data: res.data,
            isValidationError: false
          });
          this.generalService.showError(res.message || 'Something went wrong!');
        }
        this.btnLoading = false;
      },
      error: (error) => {
        this.formStatus.emit({
          success: false,
          message: 'Save failed!',
          data: null,
          isValidationError: false
        });
        this.generalService.showError(error.message || 'Something went wrong!');
        this.btnLoading = false;
      }
    });
  }

  private buildSubmitPayload(): any {

    const payload = { ...this.formGroup.getRawValue() };

    Object.keys(payload).forEach((key) => {
      if (!this.isPhoneField(key)) return;
      const value = payload[key];
      if (typeof value !== 'string') return;
      payload[key] = value.replace(/\D/g, '');
    });

    return payload;
  }

  private isPhoneField(fieldName: string): boolean {
    return /phone/i.test(fieldName);
  }

  onTelInput(event: Event, field: FormField): void {
    if (!this.isPhoneLikeField(field)) return;
    const input = event.target as HTMLInputElement;
    const digits = this.normalizeUsPhoneDigits(input.value || '');
    const formatted = this.formatUsPhone(digits);
    input.value = formatted;
    this.formGroup.get(field.name)?.setValue(formatted, { emitEvent: false });
  }

  onTelPaste(event: ClipboardEvent, field: FormField): void {
    if (!this.isPhoneLikeField(field)) return;
    event.preventDefault();
    const input = event.target as HTMLInputElement;
    const pasted = event.clipboardData?.getData('text') || '';
    const digits = this.normalizeUsPhoneDigits(pasted);
    const formatted = this.formatUsPhone(digits);
    input.value = formatted;
    this.formGroup.get(field.name)?.setValue(formatted, { emitEvent: false });
  }

  private isPhoneLikeField(field: FormField): boolean {
    const key = `${field?.name || ''} ${field?.label || ''} ${field?.placeholder || ''}`.toLowerCase();
    return key.includes('phone');
  }

  private normalizeUsPhoneDigits(value: string): string {
    let digits = String(value || '').replace(/\D/g, '');
    if (digits.length === 11 && digits.startsWith('1')) {
      digits = digits.slice(1);
    }
    return digits.slice(0, 10);
  }

  private formatUsPhone(digits: string): string {
    if (!digits) return '';
    if (digits.length > 6) {
      return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
    }
    if (digits.length > 3) {
      return `(${digits.slice(0, 3)}) ${digits.slice(3)}`;
    }
    return `(${digits}`;
  }

  getData() {
    if (this.apiUrl?.get) {
      this.api.get(this.apiUrl.get + this.primaryId).pipe(takeUntil(this.destroy$)).subscribe(
        (res) => {
          if (res.status === 1 && res.data) {
            this.populateEditData(res.data);
          } else {
            this.formStatus.emit({
              success: false,
              message: 'Error while getting data!',
              data: null,
              isValidationError: false
            });
            this.generalService.showError('Something went wrong! Try again later');
          }
        },
        (error) => {
          console.error('Error fetching data', error);
          this.formStatus.emit({
            success: false,
            message: 'Error while getting data!',
            data: null,
            isValidationError: false
          });
          this.generalService.showError(error.message || 'Something went wrong!');
        }
      );
    } else {
      this.populateEditData(this.editData);
    }
  }

  togglePasswordVisibility(fieldName: string) {
    this.passwordFieldTypes[fieldName] = this.passwordFieldTypes[fieldName] === 'text' ? 'password' : 'text';
  }

  private registerUploadHandlers(): void {
    if (!this.formConfig?.rows) return;

    this.formConfig.rows.forEach((row) => {
      row.fields.forEach((field) => {
        if (field.type === 'file' || field.type === 'file-drag') {
          const allowed: 'single' | 'multiple' = (field.fileAllowed || 'single') as any;

          this.beforeUploadHandlers[field.name] = (file, fileList) =>
            this.beforeUploadFile(file, fileList, field.name, allowed);
        }
      });
    });
  }

  private beforeUploadFile(
    file: NzUploadFile,
    _fileList: NzUploadFile[],
    controlName: string,
    allowed: 'single' | 'multiple'
  ): boolean {
    const maxBytes = 10 * 1024 * 1024;

    const mime = (file.type || '').toLowerCase();
    const name = (file.name || '').toLowerCase();

    const isPdf = mime === 'application/pdf' || name.endsWith('.pdf');
    const isImage = mime.startsWith('image/') || /\.(png|jpe?g|gif|bmp|webp|svg)$/.test(name);

    if (!isPdf && !isImage) {
      this.generalService.showError('Only image files and PDFs are allowed.');
      return false;
    }

    if ((file.size || 0) > maxBytes) {
      this.generalService.showError('File must be 10MB or smaller.');
      return false;
    }

    if (allowed !== 'multiple') {
      this.uploadFileLists[controlName] = [];

    }

    return true;
  }

  onFileChange(event: NzUploadChangeParam, name: string, type: string): void {
    const isMultiple = type === 'multiple';

    this.uploadFileLists[name] = isMultiple ? (event.fileList || []) : (event.fileList || []).slice(-1);

    if (event.type === 'success') {
      const fileUrl = event.file.response?.fileDetails?.filePath;
      if (!fileUrl) return;

      if (isMultiple) {
        const currentValue = this.formGroup.get(name)?.value || [];
        const nextValue = Array.isArray(currentValue) ? [...currentValue, fileUrl] : [fileUrl];
        this.formGroup.get(name)?.setValue(nextValue);
        this.generalService.showSuccess('Files uploaded successfully!');
      } else {

        this.formGroup.get(name)?.setValue(fileUrl);
        this.generalService.showSuccess('File uploaded successfully!');
      }
    }

    if (event.type === 'error') {
      this.generalService.showError('File upload failed.');
    }

    if (event.type === 'removed') {
      if (isMultiple) {
        const removedUrl = event.file.response?.fileDetails?.filePath || event.file.url || '';
        const currentValue = this.formGroup.get(name)?.value || [];
        const nextValue = Array.isArray(currentValue) ? currentValue.filter((u: string) => u !== removedUrl) : [];
        this.formGroup.get(name)?.setValue(nextValue);
      } else {
        this.formGroup.get(name)?.setValue(null);
        this.uploadFileLists[name] = [];
      }
      this.generalService.showSuccess('File removed successfully!');
    }
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

  isArray(value: any): boolean {
    return Array.isArray(value);
  }

}
