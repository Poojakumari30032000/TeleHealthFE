import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  EventEmitter,
  Input,
  OnDestroy,
  OnInit,
  Output,
} from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, Subject, takeUntil } from 'rxjs';
import { NzUploadFile } from 'ng-zorro-antd/upload';
import { NzModalService } from 'ng-zorro-antd/modal';
import { Router } from '@angular/router';

interface ConsentFieldDef {
  key: string;
  label: string;
  type: 'text' | 'date';
  required?: boolean;
  placeholder?: string;
}

interface Field {
  id: string;
  groupId?: string;
  label: string;
  description?: string | string[];
  type: string;
  required?: boolean;
  options?: Array<{ value: string; label: string; disableContinue?: boolean }>;
  showTextarea?: boolean;
  nextFields?: { [key: string]: string[] };
  placeholder?: string;

  consentHtml?: string;
  consentFields?: ConsentFieldDef[];
}

interface IntakeDraft {
  userSelections: { [key: string]: any };
  visitedFields: { id: string; index: number }[];
  currentIndex: number;
  ts: number;
}

@Component({
  selector: 'app-patient-questionnaire',
  templateUrl: './patient-questionnaire.component.html',
  styleUrls: ['./patient-questionnaire.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PatientQuestionnaireComponent implements OnInit, OnDestroy {
  @Input() formDataIN: any;
  @Input() goType: string = '';
  @Input() JsonPath: string = '';
  @Input() JsonData: any = null;
  @Input() type: string = 'inTake';
  @Input() currentStep: number = 0;

  @Input() storageKey: string = 'default';

  @Output() onContinue = new EventEmitter<any>();
  @Output() onPrevious = new EventEmitter<any>();

  allFormData: Field[] = [];
  formData: Field[] = [];
  currentField: Field | null = null;
  currentIndex = 0;
  userSelections: { [key: string]: any } = {};
  visitedFields: { id: string; index: number }[] = [];
  notSuitable = false;

  showErrorMap: Record<string, boolean> = {};
  private destroy$ = new Subject<void>();

  private readonly questionPageSize = 5;

  private get questionsOnly(): Field[] {
    return (this.formData || []).filter(f => f.type !== 'consent');
  }
  private get consentIndices(): number[] {
    return this.formData.reduce<number[]>((acc, f, i) => {
      if (f.type === 'consent') acc.push(i);
      return acc;
    }, []);
  }

  get isConsentPage(): boolean {
    return this.currentField?.type === 'consent';
  }

  get currentConsentIndex(): number {
    if (!this.isConsentPage) return 0;
    return this.consentIndices.indexOf(this.currentIndex) + 1;
  }
  get totalConsents(): number {
    return this.consentIndices.length;
  }

  private get currentQuestionIndex(): number {
    if (!this.currentField || this.isConsentPage) return 0;
    return this.questionsOnly.findIndex(q => q.id === this.currentField!.id);
  }
  get pageStart(): number {
    if (this.isConsentPage) return 0;
    return Math.min(this.questionsOnly.length, this.currentQuestionIndex) + 1;
  }
  get pageEnd(): number {
    if (this.isConsentPage) return 0;
    return Math.min(this.questionsOnly.length, this.currentQuestionIndex + this.questionPageSize);
  }
  get total(): number {
    if (this.isConsentPage) return 0;
    return this.questionsOnly.length;
  }

  get pageFields(): Field[] {
    if (!this.currentField) return [];
    if (this.isConsentPage) return [this.currentField];
    const start = this.currentQuestionIndex;
    const end = Math.min(this.questionsOnly.length, start + this.questionPageSize);
    return this.questionsOnly.slice(start, end);
  }

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

  initializeForm(data: { fields: Field[] }) {
    const allFields = data.fields;
    if (!allFields) return;

    const filteredFieldIds = new Set(
      allFields.flatMap((field) => Object.values(field.nextFields || {}).flat())
    );

    this.allFormData = allFields;
    this.formData = allFields.filter((field) => !filteredFieldIds.has(field.id));

    this.formData.forEach((field) => {
      if (field.type === 'checkbox' && field.options) {
        const obj: any = {};
        field.options.forEach((option) => (obj[option.value] = false));
        this.userSelections[field.id] = obj;
      } else if (field.type === 'select-multiple') {
        this.userSelections[field.id] = [];
      } else if (field.type === 'consent') {
        const obj: any = {};
        (field.consentFields || []).forEach(sf => (obj[sf.key] = null));
        this.userSelections[field.id] = obj;
      } else {
        this.userSelections[field.id] = null;
      }
      this.showErrorMap[field.id] = false;
    });

    if (this.formDataIN && this.formDataIN.userSelections !== null && this.formDataIN.visitedFields !== null) {
      this.userSelections = this.mergeSelections(this.formDataIN.userSelections);
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
      const draft = this.loadDraft();
      if (draft) {
        this.userSelections = this.mergeSelections(draft.userSelections);
        this.visitedFields = Array.isArray(draft.visitedFields) ? draft.visitedFields : [];
        this.currentIndex = Math.min(Math.max(0, draft.currentIndex || 0), Math.max(0, this.formData.length - 1));
        this.currentField = this.formData[this.currentIndex] || null;
      } else {
        this.currentField = this.formData[this.currentIndex] || null;
      }
    }

    this.cdr.markForCheck();
  }

  private mergeSelections(saved: { [key: string]: any }): { [key: string]: any } {
    const merged: { [key: string]: any } = { ...this.userSelections };
    for (const f of this.formData) {
      const v = saved?.[f.id];
      if (f.type === 'checkbox' && f.options) {
        const base: any = {};
        f.options.forEach(o => (base[o.value] = false));
        if (v && typeof v === 'object') for (const k of Object.keys(v)) base[k] = !!v[k];
        merged[f.id] = base;
      } else if (f.type === 'select-multiple') {
        merged[f.id] = Array.isArray(v) ? v.slice() : [];
      } else if (f.type === 'consent') {
        const base: any = {};
        (f.consentFields || []).forEach(sf => (base[sf.key] = null));
        if (v && typeof v === 'object') for (const k of Object.keys(v)) base[k] = v[k];
        merged[f.id] = base;
      } else {
        merged[f.id] = v ?? null;
      }
    }
    return merged;
  }

  loadJsonData(jsonPath: string): Observable<{ fields: Field[] }> {
    return this.http.get<{ fields: Field[] }>(jsonPath);
  }

  isArray(value: any): value is any[] {
    return Array.isArray(value);
  }

  onInputChange(field: Field, inputValue: any) {
    if (field.type === 'select-multiple') {
      this.userSelections[field.id] = inputValue || [];
      this.isDisContinue(field);
    } else {
      this.userSelections[field.id] = inputValue;
    }
    this.clearError(field.id);
    this.saveDraft();
  }

  onSelectionChange(field: Field, selectedValue: string) {
    this.userSelections[field.id] = selectedValue;
    this.clearError(field.id);
    this.isDisContinue(field);
    this.saveDraft();
  }

  onCheckboxChange(field: Field, optionValue: string, isChecked: boolean) {
    if (!this.userSelections[field.id]) this.userSelections[field.id] = {};
    this.userSelections[field.id][optionValue] = isChecked;
    const hasSelected = Object.values(this.userSelections[field.id]).some((v) => v === true);
    if (hasSelected) this.clearError(field.id);
    this.isDisContinue(field);
    this.saveDraft();
  }

  onUploadChange(info: { fileList: NzUploadFile[] }, fieldId: string) {
    this.userSelections[fieldId] = info.fileList;
    this.clearError(fieldId);
    this.saveDraft();
  }

  onConsentChange(field: Field, subKey: string, value: any) {
    const obj = this.userSelections[field.id] || {};
    obj[subKey] = value;
    this.userSelections[field.id] = obj;
    this.clearError(field.id);
    this.saveDraft();
  }

  private setError(fieldId: string, value: boolean) {
    this.showErrorMap[fieldId] = value;
  }
  private clearError(fieldId: string) {
    if (this.showErrorMap[fieldId]) this.showErrorMap[fieldId] = false;
  }
  isFieldError(fieldId: string): boolean {
    return !!this.showErrorMap[fieldId];
  }

  continue() {
    const currentFieldType = this.currentField?.type;
    const isRequired = this.currentField?.required;
    const fieldId = this.currentField!.id;
    const selections = this.userSelections[fieldId];
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
      isEmpty = !selections || Object.values(selections).every((value) => !value);
    } else if (currentFieldType === 'consent') {
      const subs = this.currentField?.consentFields || [];
      const val = selections || {};
      isEmpty = subs.some(sf => (sf.required !== false) && !this.hasValue(val[sf.key], sf.type));
    } else {
      isEmpty = !selections?.trim();
    }

    if ((isRequired || isRequired === undefined) && isEmpty) {
      this.setError(fieldId, true);
      this.saveDraft();
      return;
    } else {
      this.clearError(fieldId);
    }

    let nextFieldIds: string[] | undefined = undefined;

    if (this.currentField?.nextFields) {
      nextFieldIds = isEmpty
        ? this.currentField.nextFields['No']
        : currentFieldType === 'select' || currentFieldType === 'radio'
          ? this.currentField.nextFields[this.userSelections[this.currentField.id]]
          : this.currentField.nextFields['Yes'];

      Object.keys(this.currentField.nextFields).forEach((optionKey) => {
        if (optionKey !== selections && this.currentField?.nextFields?.[optionKey]) {
          const unselectedFieldIds = this.currentField.nextFields[optionKey];
          this.formData = this.formData.filter((field) => !unselectedFieldIds?.includes(field.id));
        }
      });
    }

    if (nextFieldIds && nextFieldIds[0] === 'discontinue') {
      this.saveDraft();
      this.route.navigate(['/disqualify']);
      return;
    } else if (nextFieldIds && nextFieldIds[0] === 'done') {
      const data = {
        stage: 'continue',
        userSelections: this.userSelections,
        visitedFields: this.visitedFields,
      };
      this.saveDraft();
      this.onContinue.emit(data);
      return;
    }

    if (nextFieldIds && nextFieldIds.length > 0) {
      const Field = this.allFormData.find((f) => f.id === nextFieldIds[0]);
      if (Field && !this.formData.some((f) => f.id === nextFieldIds[0])) {
        this.formData.splice(this.currentIndex + 1, 0, Field);
        if (Field.type === 'checkbox' && Field.options) {
          const obj: any = {};
          Field.options.forEach((option) => (obj[option.value] = false));
          this.userSelections[Field.id] = obj;
        } else if (Field.type === 'select-multiple') {
          this.userSelections[Field.id] = [];
        } else if (Field.type === 'consent') {
          const obj: any = {};
          (Field.consentFields || []).forEach(sf => (obj[sf.key] = null));
          this.userSelections[Field.id] = obj;
        } else {
          this.userSelections[Field.id] = null;
        }
      }

      this.visitedFields.push({ id: this.currentField!.id, index: this.currentIndex });
      this.currentField = this.formData.find((f) => f.id === nextFieldIds[0]) || null;
      this.currentIndex = this.currentField ? this.formData.indexOf(this.currentField) : this.currentIndex;
    } else if (this.currentIndex < this.formData.length - 1) {
      this.visitedFields.push({ id: this.currentField!.id, index: this.currentIndex });
      this.currentIndex++;
      this.currentField = this.formData[this.currentIndex] || null;
    } else if (this.notSuitable) {
      this.saveDraft();
      this.route.navigate(['/disqualify']);
      return;
    } else {
      const data = {
        stage: 'continue',
        userSelections: this.userSelections,
        visitedFields: this.visitedFields,
      };
      this.saveDraft();
      this.onContinue.emit(data);
    }

    this.saveDraft();
  }

  private hasValue(v: any, t: 'text' | 'date' | undefined): boolean {
    if (t === 'date') return !!v;
    if (v == null) return false;
    if (typeof v === 'string') return v.trim().length > 0;
    return !!v;
  }

  previous() {
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
        visitedFields: this.visitedFields,
      };
      this.saveDraft();
      this.onPrevious.emit(data);
      return;
    }
    this.saveDraft();
  }

  continuePage(): void {
    const maxSteps = this.isConsentPage ? 1 : this.questionPageSize;
    let steps = 0;
    while (steps < maxSteps) {
      const beforeIdx = this.currentIndex;
      const beforeId = this.currentField?.id;
      this.continue();
      if (beforeId && this.isFieldError(beforeId)) break;
      if (this.currentIndex === beforeIdx && this.currentField?.id === beforeId) break;
      steps++;
    }
  }

  previousPage(): void {
    const maxSteps = this.isConsentPage ? 1 : this.questionPageSize;
    let steps = 0;
    while (steps < maxSteps) {
      const beforeIdx = this.currentIndex;
      this.previous();
      if (this.currentIndex === beforeIdx) break;
      steps++;
    }
  }

  isDisContinue(field: Field | null) {
    if (!field) return;
    const selection = this.userSelections[field.id];

    if (field.type === 'radio' || field.type === 'select') {
      const selectedOption = field.options?.find((option) => option.value === selection);
      if (selectedOption?.disableContinue) this.notSuitable = true;
    }
    if (field.type === 'checkbox') {
      const vals = selection || {};
      const hasDisabled = field.options?.some(o => vals[o.value] && o.disableContinue);
      if (hasDisabled) this.notSuitable = true;
    }
    if (field.type === 'select-multiple') {
      const selectedOptions = selection || [];
      const hasDisabled = selectedOptions.some((sv: any) =>
        field.options?.find(o => o.value === sv && o.disableContinue)
      );
      if (hasDisabled) this.notSuitable = true;
    }
  }

  error(): void {
    this.modal.error({
      nzTitle: 'Prescription Not Suitable',
      nzContent: `
        <p>This prescription may not be right for you. Unfortunately, you may not be eligible for this medication.</p>
        <p class="text-sm"><i>Based on the information you provided, your doctor would not recommend this specific medication. Please consider an alternative treatment.</i></p>
      `,
      nzClassName: 'errorNoBtn',
      nzCentered: true,
    });
  }

  success(): void {
    this.modal.success({
      nzTitle: 'Prescription Approved',
      nzContent: `
        <p>Your prescription has been successfully approved.</p>
        <p class="text-sm"><i>Based on the information you provided, your doctor has confirmed that this medication is suitable for you.</i></p>
      `,
      nzClassName: 'successNoBtn',
      nzCentered: true,
    });
  }

  private lsKey(): string {
    return `intake:${this.storageKey}`;
  }
  private loadDraft(): IntakeDraft | null {
    try {
      const raw = localStorage.getItem(this.lsKey());
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      if (!parsed || typeof parsed !== 'object') return null;
      return {
        userSelections: parsed.userSelections ?? {},
        visitedFields: Array.isArray(parsed.visitedFields) ? parsed.visitedFields : [],
        currentIndex: Number.isFinite(parsed.currentIndex) ? parsed.currentIndex : 0,
        ts: parsed.ts ?? Date.now(),
      };
    } catch {
      return null;
    }
  }
  private saveDraft(): void {
    try {
      const draft: IntakeDraft = {
        userSelections: this.userSelections,
        visitedFields: this.visitedFields,
        currentIndex: this.currentIndex,
        ts: Date.now(),
      };
      localStorage.setItem(this.lsKey(), JSON.stringify(draft));
    } catch {}
  }

  trackByField = (_: number, f: Field) => f.id;
  trackByOption = (_: number, o: { value: string }) => o.value;
  trackByConsentField = (_: number, cf: ConsentFieldDef) => cf.key;
}
