import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  EventEmitter,
  Input,
  OnDestroy,
  OnInit,
  Output
} from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, Subject, takeUntil } from 'rxjs';
import { NzUploadFile } from 'ng-zorro-antd/upload';
import { NzModalService } from 'ng-zorro-antd/modal';
import { Router } from '@angular/router';

interface ConsentFieldDef {
  key: string;
  label: string;
  type: 'text' | 'date' | 'signature';
  required?: boolean;
  placeholder?: string;
}

interface Field {
  id: string;
  groupId?: string;
  label: string;
  description?: string | string[] | null;
  type: string;
  required?: boolean;
  options?: Array<{ value: string; label: string; disableContinue?: boolean }>;
  showTextarea?: boolean;
  nextFields?: { [key: string]: string[] };
  placeholder?: string;

  consentHtml?: string;
  consentFields?: ConsentFieldDef[];
}

@Component({
  selector: 'app-dynamic-intake-form',
  templateUrl: './dynamic-intake-form.component.html',
  styleUrls: ['./dynamic-intake-form.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class DynamicIntakeFormComponent implements OnInit, OnDestroy {
  @Input() formDataIN: any;
  @Input() goType: string = '';
  @Input() JsonPath: string = '';
  @Input() JsonData: any = null;
  @Input() type: string = 'inTake';
  @Input() currentStep: number = 0;
  @Input() showContinueButton: boolean = true;
  @Input() renderContinueInsideContainer: boolean = false;
  @Input() renderAsMultiQuestionPreview: boolean = false;
  @Output() onContinue = new EventEmitter<any>();
  @Output() onPrevious = new EventEmitter<any>();

  allFormData: Field[] = [];
  formData: Field[] = [];
  currentField: Field | null = null;
  currentIndex = 0;
  userSelections: { [key: string]: any } = {};
  visitedFields: { id: string; index: number }[] = [];
  notSuitable = false;
  showREror = false;
  showErrorMap: Record<string, boolean> = {};
  previewStepIndex = 0;
  consentPreviewFields: Field[] = [];
  questionPreviewFields: Field[] = [];

  private readonly questionPageSize = 5;

  private destroy$ = new Subject<void>();

  constructor(
    private http: HttpClient,
    private cdr: ChangeDetectorRef,
    private modal: NzModalService,
    private route: Router
  ) {}

  ngOnInit(): void {
    if (this.JsonPath) {
      this.loadJsonData(this.JsonPath)
        .pipe(takeUntil(this.destroy$))
        .subscribe((data) => this.initializeForm(data));
    } else if (this.JsonData) {
      this.initializeForm(this.JsonData);
    } else {
      console.error('No JSON data or path provided.');
    }
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  loadJsonData(jsonPath: string): Observable<{ fields: Field[] }> {
    return this.http.get<{ fields: Field[] }>(jsonPath);
  }

  initializeForm(data: { fields: Field[] }) {
    const allFields = data?.fields || [];

    allFields.forEach((f) => {
      if (f.type === 'consent' && Array.isArray(f.consentFields)) {
        f.consentFields = f.consentFields.map((sf) => ({
          ...sf,
          type: (sf.key === 'sign' && sf.type === 'text') ? 'signature' : (sf.type ?? 'text'),
        }) as ConsentFieldDef);
      }
    });

    this.allFormData = allFields;
    if (this.renderAsMultiQuestionPreview) {

      const filteredFieldIds = new Set(
        allFields.flatMap((f) => Object.values(f.nextFields || {}).flat())
      );
      this.formData = allFields.filter((f) => !filteredFieldIds.has(f.id));
      this.consentPreviewFields = this.formData.filter((f) => f.type === 'consent');
      this.questionPreviewFields = this.formData.filter((f) => f.type !== 'consent');
    } else {
      const filteredFieldIds = new Set(
        allFields.flatMap((f) => Object.values(f.nextFields || {}).flat())
      );
      this.formData = allFields.filter((f) => !filteredFieldIds.has(f.id));
      this.consentPreviewFields = [];
      this.questionPreviewFields = [];
    }

    this.initializeSelections();

    if (this.formDataIN && this.formDataIN.userSelections != null && this.formDataIN.visitedFields != null) {
      this.userSelections = this.formDataIN.userSelections;
      this.visitedFields = this.formDataIN.visitedFields;

      if (this.goType === 'previous' && this.visitedFields.length > 0) {
        const lastVisited = this.visitedFields[this.visitedFields.length - 1];
        if (lastVisited) {
          this.currentIndex = lastVisited.index;
          this.currentField = this.formData[this.currentIndex] || null;
        }
      } else {
        this.currentField = this.formData[this.currentIndex] || null;
      }
    } else {
      this.currentField = this.formData[this.currentIndex] || null;
    }

    this.cdr.markForCheck();
  }

  initializeSelections() {
    this.formData.forEach((f) => {
      if (f.type === 'checkbox' && f.options) {
        const obj: any = {};
        f.options.forEach((o) => (obj[o.value] = false));
        this.userSelections[f.id] = obj;
      } else if (f.type === 'select-multiple') {
        this.userSelections[f.id] = [];
      } else if (f.type === 'consent') {
        const obj: any = {};
        (f.consentFields || []).forEach((sf) => (obj[sf.key] = null));
        this.userSelections[f.id] = obj;
      } else {
        this.userSelections[f.id] = null;
      }
      this.showErrorMap[f.id] = false;
    });

    this.previewStepIndex = 0;
    this.cdr.markForCheck();
  }

  isArray(v: any): v is any[] {
    return Array.isArray(v);
  }

  isFixedFooterMode(): boolean {
    return this.showContinueButton && !this.renderContinueInsideContainer && this.type === 'inTake';
  }

  getContinueFooterClassMap() {
    return {
      'fixed bottom-0 right-0 left-0 w-full bg-white dark:bg-gray-900': !this.renderContinueInsideContainer && this.type === 'inTake',
      'sticky bottom-0 w-full bg-white dark:bg-gray-900': !this.renderContinueInsideContainer && this.type === 'visitIntakeForm',
    };
  }

  get previewPageFields(): Field[] {
    if (!this.renderAsMultiQuestionPreview) return this.currentField ? [this.currentField] : [];
    if (this.isConsentPreviewPage) {
      const consent = this.consentPreviewFields[this.previewStepIndex];
      return consent ? [consent] : [];
    }
    const start = this.questionPreviewPageIndex * this.questionPageSize;
    const end = start + this.questionPageSize;
    return this.questionPreviewFields.slice(start, end);
  }

  get previewPageStart(): number {
    if (this.isConsentPreviewPage || !this.previewPageFields.length) return 0;
    return this.questionPreviewPageIndex * this.questionPageSize + 1;
  }

  get previewPageEnd(): number {
    if (this.isConsentPreviewPage) return 0;
    return Math.min(this.totalQuestions, this.previewPageStart + this.previewPageFields.length - 1);
  }

  get isLastPreviewPage(): boolean {
    return this.totalPreviewPages > 0 && this.previewStepIndex >= this.totalPreviewPages - 1;
  }

  canGoToPreviousPreviewPage(): boolean {
    return this.previewStepIndex > 0;
  }

  get isConsentPreviewPage(): boolean {
    return this.renderAsMultiQuestionPreview && this.previewStepIndex < this.totalConsents;
  }

  get currentConsentIndex(): number {
    return this.isConsentPreviewPage ? this.previewStepIndex + 1 : 0;
  }

  get totalConsents(): number {
    return this.consentPreviewFields.length;
  }

  get totalQuestions(): number {
    return this.questionPreviewFields.length;
  }

  get totalQuestionPages(): number {
    return Math.ceil(this.totalQuestions / this.questionPageSize);
  }

  get totalPreviewPages(): number {
    return this.totalConsents + this.totalQuestionPages;
  }

  get questionPreviewPageIndex(): number {
    return Math.max(0, this.previewStepIndex - this.totalConsents);
  }

  get questionPageIndices(): number[] {
    return Array.from({ length: this.totalQuestionPages }, (_, i) => i);
  }

  jumpToPreviewPage(pageIndex: number): void {
    if (pageIndex < 0 || pageIndex >= this.totalPreviewPages) return;
    this.previewStepIndex = pageIndex;
    this.cdr.markForCheck();
  }

  getPageRangeLabel(pageIdx: number): string {
    const start = pageIdx * this.questionPageSize + 1;
    const end = Math.min((pageIdx + 1) * this.questionPageSize, this.totalQuestions);
    return `Q ${start}–${end}`;
  }

  trackByField(_: number, field: Field): string {
    return field.id;
  }

  trackByOption(_: number, option: { value: string; label: string; disableContinue?: boolean }): string {
    return option.value;
  }

  trackByConsentField(_: number, sub: ConsentFieldDef): string {
    return sub.key;
  }

  isFieldError(fieldId: string): boolean {
    return !!this.showErrorMap[fieldId];
  }

  clearFieldError(fieldId: string) {
    this.showErrorMap[fieldId] = false;
  }

  onInputChange(field: Field, inputValue: any) {
    if (field.type === 'select-multiple') {
      this.userSelections[field.id] = inputValue || [];
      this.isDisContinue(field);
    } else {
      this.userSelections[field.id] = inputValue;
    }
    if (inputValue !== null && inputValue !== undefined && inputValue !== '') this.showREror = false;
    this.clearFieldError(field.id);
  }

  onSelectionChange(field: Field, selectedValue: string) {
    this.userSelections[field.id] = selectedValue;
    if (selectedValue) this.showREror = false;
    this.clearFieldError(field.id);
    this.isDisContinue(field);

    if (this.renderAsMultiQuestionPreview && field.nextFields) {
      this.applyPreviewConditionalLogic(field, selectedValue);
    }
  }

  private applyPreviewConditionalLogic(field: Field, selectedValue: string): void {

    const allDependentIds = new Set<string>(
      Object.values(field.nextFields || {}).flat()
    );

    this.formData = this.formData.filter((f) => !allDependentIds.has(f.id));

    const insertAfterIndex = this.formData.findIndex((f) => f.id === field.id);
    const nextFieldIds: string[] = field.nextFields?.[selectedValue] ?? [];

    nextFieldIds.forEach((id, i) => {
      const fieldToAdd = this.allFormData.find((f) => f.id === id);
      if (fieldToAdd && !this.formData.some((f) => f.id === id)) {
        this.formData.splice(insertAfterIndex + 1 + i, 0, fieldToAdd);

        if (fieldToAdd.type === 'checkbox' && fieldToAdd.options) {
          const obj: any = {};
          fieldToAdd.options.forEach((o) => (obj[o.value] = false));
          this.userSelections[fieldToAdd.id] = obj;
        } else if (fieldToAdd.type === 'select-multiple') {
          this.userSelections[fieldToAdd.id] = [];
        } else if (fieldToAdd.type === 'consent') {
          const obj: any = {};
          (fieldToAdd.consentFields || []).forEach((sf) => (obj[sf.key] = null));
          this.userSelections[fieldToAdd.id] = obj;
        } else {
          this.userSelections[fieldToAdd.id] = null;
        }
      }
    });

    this.questionPreviewFields = this.formData.filter((f) => f.type !== 'consent');
    this.cdr.markForCheck();
  }

  onCheckboxChange(field: Field, optionValue: string, isChecked: boolean) {
    if (!this.userSelections[field.id]) this.userSelections[field.id] = {};
    this.userSelections[field.id][optionValue] = isChecked;

    const hasSelected = Object.values(this.userSelections[field.id]).some((v) => v === true);
    if (hasSelected) this.showREror = false;
    this.clearFieldError(field.id);

    this.isDisContinue(field);
  }

  onConsentChange(field: Field, subKey: string, value: any) {
    const obj = this.userSelections[field.id] || {};
    obj[subKey] = value;
    this.userSelections[field.id] = obj;
    this.showREror = false;
    this.clearFieldError(field.id);
  }

  onUploadChange(info: { fileList: NzUploadFile[] }, fieldId: string) {
    this.userSelections[fieldId] = info.fileList;
    this.showREror = false;
    this.clearFieldError(fieldId);
  }

  private hasValue(v: any, t: 'text' | 'date' | 'signature' | undefined): boolean {
    if (t === 'date') return !!v;
    if (v == null) return false;
    if (typeof v === 'string') return v.trim().length > 0;
    return !!v;
  }

  continue() {
    if (this.renderAsMultiQuestionPreview) {
      this.continuePreviewPage();
      return;
    }

    if (!this.currentField) return;

    const currentFieldType = this.currentField.type;
    const isRequired = this.currentField.required !== false;
    const selections = this.userSelections[this.currentField.id];
    let isEmpty = false;

    if (currentFieldType === 'file') {
      isEmpty = !selections;
    } else if (
      currentFieldType === 'select' ||
      currentFieldType === 'select-multiple' ||
      currentFieldType === 'radio' ||
      currentFieldType === 'number' ||
      currentFieldType === 'date'
    ) {
      isEmpty = selections?.length === 0 || !selections;
    } else if (currentFieldType === 'checkbox') {
      isEmpty = !selections || Object.values(selections).every((v) => !v);
    } else if (currentFieldType === 'consent') {
      const subs = this.currentField.consentFields || [];
      const val = selections || {};
      isEmpty = subs.some((sf) => (sf.required !== false) && !this.hasValue(val[sf.key], sf.type));
    } else {
      isEmpty = !selections?.trim?.();
    }

    if (isRequired && isEmpty) {
      this.showREror = true;
      return;
    }

    let nextFieldIds: string[] | undefined;

    if (this.currentField.nextFields) {
      nextFieldIds = isEmpty
        ? this.currentField.nextFields['No']
        : currentFieldType === 'select' || currentFieldType === 'radio'
          ? this.currentField.nextFields[this.userSelections[this.currentField.id]]
          : this.currentField.nextFields['Yes'];

      Object.keys(this.currentField.nextFields).forEach((optionKey) => {
        if (optionKey !== selections && this.currentField?.nextFields?.[optionKey]) {
          const unselectedIds = this.currentField.nextFields[optionKey];
          this.formData = this.formData.filter((f) => !unselectedIds?.includes(f.id));
        }
      });
    }

    if (nextFieldIds && nextFieldIds[0] === 'discontinue') {
      this.route.navigate(['/disqualify']);
      return;
    } else if (nextFieldIds && nextFieldIds[0] === 'done') {
      const data = {
        stage: 'continue',
        userSelections: this.userSelections,
        visitedFields: this.visitedFields
      };
      this.onContinue.emit(data);
      return;
    }

    if (nextFieldIds && nextFieldIds.length > 0) {
      const FieldToAdd = this.allFormData.find((f) => f.id === nextFieldIds![0]);
      if (FieldToAdd && !this.formData.some((f) => f.id === nextFieldIds![0])) {
        this.formData.splice(this.currentIndex + 1, 0, FieldToAdd);

        if (FieldToAdd.type === 'checkbox' && FieldToAdd.options) {
          const obj: any = {};
          FieldToAdd.options.forEach((o) => (obj[o.value] = false));
          this.userSelections[FieldToAdd.id] = obj;
        } else if (FieldToAdd.type === 'select-multiple') {
          this.userSelections[FieldToAdd.id] = [];
        } else if (FieldToAdd.type === 'consent') {
          const obj: any = {};
          (FieldToAdd.consentFields || []).forEach((sf) => (obj[sf.key] = null));
          this.userSelections[FieldToAdd.id] = obj;
        } else {
          this.userSelections[FieldToAdd.id] = null;
        }
      }

      this.visitedFields.push({ id: this.currentField.id, index: this.currentIndex });
      this.currentField = this.formData.find((f) => f.id === nextFieldIds![0]) || null;
      this.currentIndex = this.currentField ? this.formData.indexOf(this.currentField) : this.currentIndex;
    } else if (this.currentIndex < this.formData.length - 1) {
      this.visitedFields.push({ id: this.currentField.id, index: this.currentIndex });
      this.currentIndex++;
      this.currentField = this.formData[this.currentIndex] || null;
    } else if (this.notSuitable) {
      this.route.navigate(['/disqualify']);
      return;
    } else {
      const data = {
        stage: 'continue',
        userSelections: this.userSelections,
        visitedFields: this.visitedFields
      };
      this.onContinue.emit(data);
    }
  }

  previous() {
    if (this.renderAsMultiQuestionPreview) {
      this.previousPreviewPage();
      return;
    }

    if (this.visitedFields.length > 0) {
      const lastVisited = this.visitedFields.pop();
      if (lastVisited) {
        this.currentIndex = lastVisited.index;
        this.currentField = this.formData[this.currentIndex] || null;
      }
    } else {
      const data = {
        stage: 'previous',
        userSelections: this.userSelections,
        visitedFields: this.visitedFields
      };
      this.onPrevious.emit(data);
    }
  }

  private isFieldEmptyForValidation(field: Field): boolean {
    const selections = this.userSelections[field.id];
    if (field.type === 'file') {
      return !selections || !Array.isArray(selections) || selections.length === 0;
    }
    if (
      field.type === 'select' ||
      field.type === 'select-multiple' ||
      field.type === 'radio' ||
      field.type === 'number' ||
      field.type === 'date'
    ) {
      return selections?.length === 0 || !selections;
    }
    if (field.type === 'checkbox') {
      return !selections || Object.values(selections).every((v) => !v);
    }
    if (field.type === 'consent') {
      const subs = field.consentFields || [];
      const val = selections || {};
      return subs.some((sf) => (sf.required !== false) && !this.hasValue(val[sf.key], sf.type));
    }
    return !selections?.trim?.();
  }

  private validateCurrentPreviewPage(): boolean {
    let hasError = false;
    this.previewPageFields.forEach((field) => {
      this.showErrorMap[field.id] = false;
      const isRequired = field.required !== false;
      if (!isRequired) return;

      const isEmpty = this.isFieldEmptyForValidation(field);
      if (isEmpty) {
        hasError = true;
        this.showErrorMap[field.id] = true;
      }
    });
    return !hasError;
  }

  private continuePreviewPage() {
    if (!this.validateCurrentPreviewPage()) return;
    if (this.isLastPreviewPage) return;
    this.previewStepIndex += 1;
    this.cdr.markForCheck();
  }

  private previousPreviewPage() {
    if (!this.canGoToPreviousPreviewPage()) return;
    this.previewStepIndex = Math.max(0, this.previewStepIndex - 1);
    this.cdr.markForCheck();
  }

  isDisContinue(field: Field | null) {
    if (!field) return;
    const selection = this.userSelections[field.id];

    if (field.type === 'radio' || field.type === 'select') {
      const selectedOption = field.options?.find((o) => o.value === selection);
      if (selectedOption?.disableContinue) this.notSuitable = true;
    }
    if (field.type === 'checkbox') {
      const vals = selection || {};
      const hasDisabled = field.options?.some((o) => vals[o.value] && o.disableContinue);
      if (hasDisabled) this.notSuitable = true;
    }
    if (field.type === 'select-multiple') {
      const selectedOptions = selection || [];
      const hasDisabled = selectedOptions.some((sv: any) =>
        field.options?.find((o) => o.value === sv && o.disableContinue)
      );
      if (hasDisabled) this.notSuitable = true;
    }
  }

  error(): void {
    this.modal.error({
      nzTitle: 'Prescription Not Suitable',
      nzContent: `
        <p>This prescription may not be right for you. Unfortunately, you may not be eligible for this medication.</p>
        <p class="text-sm">
          <i>Based on the information you provided, your doctor would not recommend this specific medication. Please consider an alternative treatment.Based on the information you provided, your doctor would not recommend this specific medication. Please consider an alternative treatment.</i>
        </p>
      `,
      nzClassName: 'errorNoBtn',
      nzCentered: true
    });
  }

  success(): void {
    this.modal.success({
      nzTitle: 'Prescription Approved',
      nzContent: `
        <p>Your prescription has been successfully approved.</p>
        <p class="text-sm">
          <i>Based on the information you provided, your doctor has confirmed that this medication is suitable for you. Your prescription will be processed, and the charges will be applied to your card.</i>
        </p>
      `,
      nzClassName: 'successNoBtn',
      nzCentered: true
    });
  }
}
