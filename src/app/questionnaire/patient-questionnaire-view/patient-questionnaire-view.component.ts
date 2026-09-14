import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  EventEmitter,
  OnDestroy,
  OnInit,
  Output,
} from '@angular/core';
import { Subject, takeUntil, of, map, lastValueFrom, Observable } from 'rxjs';
import { NzUploadFile } from 'ng-zorro-antd/upload';
import { GeneralService } from 'app/shared/services/general.service';

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
  selector: 'app-patient-questionnaire-view',
  templateUrl: './patient-questionnaire-view.component.html',
  styleUrls: ['./patient-questionnaire-view.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class PatientQuestionnaireViewComponent implements OnInit, OnDestroy {

  @Output() questionnaireSubmitted = new EventEmitter<string>();

  selectedSub: any[] = [];

  currentStep = 0;
  intakeFormJson: any = '';
  intakeFormData: any = { userSelections: null, visitedFields: null };

  storageKey = 'intake:default';

  allFormData: Field[] = [];
  formData: Field[] = [];
  currentField: Field | null = null;
  currentIndex = 0;
  userSelections: { [key: string]: any } = {};
  visitedFields: { id: string; index: number }[] = [];
  notSuitable = false;
  showErrorMap: Record<string, boolean> = {};
  selectedTreatmentIdForSavingIntakeForm: any = null;
  isFormSubmitting: boolean = false;

  private readonly questionPageSize = 5;

  private destroy$ = new Subject<void>();
   showSubmitButton: boolean = false;

  constructor(
    private generalService: GeneralService,
    private cdr: ChangeDetectorRef,
  ) {}

  ngOnInit(): void {
    console.log('PatientQuestionnaireViewComponent ngOnInit');
    this.getPatientQuestionnaireInfo();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  private coerceToDate(v: any): Date | null {
    if (!v) return null;

    if (v instanceof Date) return isNaN(v.getTime()) ? null : v;

    if (typeof v === 'string' || typeof v === 'number') {
      const d = new Date(v);
      return isNaN(d.getTime()) ? null : d;
    }

    if (typeof v === 'object') {

      if (typeof (v as any).toDate === 'function') {
        const d = (v as any).toDate();
        return d instanceof Date && !isNaN(d.getTime()) ? d : null;
      }

      if ((v as any).$d instanceof Date) {
        const d = (v as any).$d as Date;
        return !isNaN(d.getTime()) ? d : null;
      }
    }

    return null;
  }

  private fmtDate(v: any): string {
    const d = this.coerceToDate(v);
    return d ? d.toLocaleDateString() : '';
  }

  getPatientQuestionnaireInfo() {
    this.generalService.getPatientIntakeFormByPatientID().subscribe(
      (res) => {
        this.selectedSub = res?.data;
        this.cdr.markForCheck();
        this.loadIntakeFormData();
      },
      (error) => {
        console.error('Failed to load patient questionnaire info', error);
        this.generalService.showError('Failed to load patient questionnaire info');
      }
    );
  }

  loadIntakeFormData() {
    let categoryId = null;
    this.selectedSub.forEach((element: any) => {
      if (element.isFirstQuestionaire === true) {
        categoryId = element.category;
        this.selectedTreatmentIdForSavingIntakeForm = element.patientTreatmentId;
      }
    });

    if (!categoryId) return;

    this.storageKey = `intake:${categoryId}`;

    this.generalService
      .commonGet(`UnAuthorize/getQuestionnaireJsonById?CategoryId=${categoryId}`)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (response: any) => {
          const json = response?.data?.questionnaireJson;
          if (!json) {
            this.intakeFormJson = null;
            this.generalService.showError('No Questionnaire found for this product');
            this.cdr.markForCheck();
            return;
          }
          try {
            this.intakeFormJson = JSON.parse(json);
            this.initializeForm(this.intakeFormJson);
          } catch {
            this.intakeFormJson = null;
            this.generalService.showError('Invalid questionnaire JSON');
          }
          this.cdr.markForCheck();
        },
        error: (error) => {
          console.error('Failed to load questionnaire JSON', error);
          this.generalService.showError('Failed to load questionnaire');
          this.cdr.markForCheck();
        }
      });
  }

  private get questionsOnly(): Field[] {
    return (this.formData || []).filter(f => f.type !== 'consent');
  }
  private get consentIndices(): number[] {
    return this.formData.reduce<number[]>((acc, f, i) => (f.type === 'consent' ? acc.concat(i) : acc), []);
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

  get progressPercent(): number {
    const total = this.formData.length;
    if (total === 0) return 0;
    return Math.round((this.currentIndex / total) * 100);
  }

  get pageFields(): Field[] {
    if (!this.currentField) return [];
    if (this.isConsentPage) return [this.currentField];
    const start = this.currentQuestionIndex;
    const end = Math.min(this.questionsOnly.length, start + this.questionPageSize);
    return this.questionsOnly.slice(start, end);
  }

  private initializeForm(data: { fields: Field[] }) {
    const allFields = data?.fields || [];

    allFields.forEach((f) => {
      if (f.type === 'consent' && Array.isArray(f.consentFields)) {
        f.consentFields = f.consentFields.map((sf) => ({
          ...sf,
          type: (sf.key === 'sign' && sf.type === 'text') ? 'signature' : (sf.type ?? 'text'),
        }) as ConsentFieldDef);
      }
    });

    const filteredIds = new Set(
      allFields.flatMap((f) => Object.values(f.nextFields || {}).flat())
    );

    this.allFormData = allFields;
    this.formData = allFields.filter((f) => !filteredIds.has(f.id));

    this.formData.forEach((f) => {
      if (f.type === 'checkbox' && f.options) {
        const obj: any = {};
        f.options.forEach((o) => (obj[o.value] = false));
        this.userSelections[f.id] = obj;
      } else if (f.type === 'select-multiple') {
        this.userSelections[f.id] = [];
      } else if (f.type === 'consent') {
        const obj: any = {};
        (f.consentFields || []).forEach(sf => (obj[sf.key] = null));
        this.userSelections[f.id] = obj;
      } else {
        this.userSelections[f.id] = null;
      }
      this.showErrorMap[f.id] = false;
    });

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

      } else if (f.type === 'date') {

        merged[f.id] = this.coerceToDate(v) ?? null;

      } else if (f.type === 'consent') {
        const base: any = {};
        const defs = (f.consentFields || []);

        defs.forEach(sf => (base[sf.key] = null));

        if (v && typeof v === 'object') {
          defs.forEach(sf => {
            const raw = (v as any)[sf.key];
            base[sf.key] = sf.type === 'date' ? (this.coerceToDate(raw) ?? null) : (raw ?? null);
          });

          for (const k of Object.keys(v)) {
            if (!(k in base)) base[k] = (v as any)[k];
          }
        }

        merged[f.id] = base;

      } else {
        merged[f.id] = v ?? null;
      }
    }

    return merged;
  }

  private ensureDefaultsFor(nxt: Field): void {
    if (nxt.type === 'checkbox' && nxt.options) {
      const obj: any = {};
      nxt.options.forEach(o => (obj[o.value] = false));
      this.userSelections[nxt.id] = obj;
    } else if (nxt.type === 'select-multiple') {
      this.userSelections[nxt.id] = [];
    } else if (nxt.type === 'consent') {
      const obj: any = {};
      (nxt.consentFields || []).forEach(sf => (obj[sf.key] = null));
      this.userSelections[nxt.id] = obj;
    } else {
      if (!(nxt.id in this.userSelections)) this.userSelections[nxt.id] = null;
    }
    this.showErrorMap[nxt.id] = false;
  }

  isArray(v: any): v is any[] { return Array.isArray(v); }

  onInputChange(field: Field, inputValue: any) {

    if (field.type === 'select-multiple') {
      this.userSelections[field.id] = inputValue || [];
      this.isDisContinue(field);
    } else {
      this.userSelections[field.id] = inputValue;
    }

    this.clearError(field.id);

    if (field.type === 'select' || field.type === 'select-multiple') {
      this.updateNextFieldsFor(field);
    }

    this.saveDraft();
  }

  onSelectionChange(field: Field, selectedValue: string) {
    this.userSelections[field.id] = selectedValue;
    this.clearError(field.id);
    this.isDisContinue(field);

    this.updateNextFieldsFor(field);

    this.saveDraft();
  }

  onCheckboxChange(field: Field, optionValue: string, isChecked: boolean) {
    if (!this.userSelections[field.id]) this.userSelections[field.id] = {};
    this.userSelections[field.id][optionValue] = isChecked;

    const hasSelected = Object.values(this.userSelections[field.id]).some((v) => v === true);
    if (hasSelected) this.clearError(field.id);

    this.isDisContinue(field);

    this.updateNextFieldsFor(field);

    this.saveDraft();
  }

  onUploadChange(info: { fileList: NzUploadFile[] }, fieldId: string) {
    this.userSelections[fieldId] = info.fileList;
    this.clearError(fieldId);
    this.saveDraft();
  }

  onConsentChange(field: Field, subKey: string, value: any) {
    const obj = this.userSelections[field.id] || {};
    const def = (field.consentFields || []).find(d => d.key === subKey);

    obj[subKey] = def?.type === 'date' ? (this.coerceToDate(value) ?? null) : value;

    this.userSelections[field.id] = obj;
    this.clearError(field.id);
    this.saveDraft();
  }

  private updateNextFieldsFor(field: Field): void {
    const mapping = field.nextFields;
    if (!mapping) return;

    let selectedKeys: string[] = [];
    const sel = this.userSelections[field.id];

    if (field.type === 'radio' || field.type === 'select') {
      if (sel) selectedKeys = [sel];
    } else if (field.type === 'checkbox') {
      const vals = sel || {};
      selectedKeys = (field.options || [])
        .filter(o => vals[o.value])
        .map(o => o.value);
    } else if (field.type === 'select-multiple') {
      selectedKeys = Array.isArray(sel) ? sel.slice() : [];
    }

    Object.keys(mapping).forEach(key => {
      if (!selectedKeys.includes(key)) {
        const ids = mapping[key] || [];
        this.formData = this.formData.filter(f => !ids.includes(f.id));
        ids.forEach(id => {
          delete this.userSelections[id];
          delete this.userSelections[`${id}_other_text`];
          delete this.showErrorMap[id];
        });
      }
    });

    let insertAt = this.formData.findIndex(f => f.id === field.id);
    insertAt = insertAt === -1 ? this.currentIndex + 1 : insertAt + 1;

    const toInsert: string[] = [];
    selectedKeys.forEach(k => (mapping[k] || []).forEach(id => {
      if (!toInsert.includes(id)) toInsert.push(id);
    }));

    for (const id of toInsert) {
      const nxt = this.allFormData.find(f => f.id === id);
      if (!nxt) continue;

      const existingIdx = this.formData.findIndex(f => f.id === id);

      if (existingIdx === -1) {
        this.formData.splice(insertAt, 0, nxt);
        this.ensureDefaultsFor(nxt);
        insertAt++;
      } else {
        if (existingIdx < insertAt) {
          const moved = this.formData.splice(existingIdx, 1)[0];
          if (moved) this.formData.splice(insertAt - 1, 0, moved);
        }
        insertAt = Math.max(insertAt, existingIdx + 1);
      }
    }

    this.cdr.markForCheck();
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

  private hasValue(v: any, t: 'text' | 'date' | 'signature' | undefined): boolean {
    if (t === 'date') return !!this.coerceToDate(v);
    if (v == null) return false;
    if (typeof v === 'string') return v.trim().length > 0;
    return !!v;
  }

  continue() {
    if (!this.currentField) return;

    const currentFieldType = this.currentField.type;
    const isRequired = this.currentField.required;
    const fieldId = this.currentField.id;
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
      isEmpty = !selections || Object.values(selections).every((v) => !v);
    } else if (currentFieldType === 'consent') {
      const subs = this.currentField?.consentFields || [];
      const val = selections || {};
      isEmpty = subs.some(sf => (sf.required !== false) && !this.hasValue(val[sf.key], sf.type));
    } else {
      isEmpty = !selections?.trim?.();
    }

    if ((isRequired || isRequired === undefined) && isEmpty) {
      this.setError(fieldId, true);
      this.saveDraft();
      return;
    } else {
      this.clearError(fieldId);
    }

    let nextFieldIds: string[] | undefined = undefined;

    if (this.currentField.nextFields) {
      nextFieldIds = isEmpty
        ? this.currentField.nextFields['No']
        : (currentFieldType === 'select' || currentFieldType === 'radio')
          ? this.currentField.nextFields[this.userSelections[this.currentField.id]]
          : this.currentField.nextFields['Yes'];

      Object.keys(this.currentField.nextFields).forEach((optionKey) => {
        if (optionKey !== selections && this.currentField?.nextFields?.[optionKey]) {
          const unselectedFieldIds = this.currentField.nextFields[optionKey];
          this.formData = this.formData.filter((f) => !unselectedFieldIds?.includes(f.id));
        }
      });
    }

    if (nextFieldIds && nextFieldIds[0] === 'discontinue') {
      this.saveDraft();
      return;
    } else if (nextFieldIds && nextFieldIds[0] === 'done') {
      this.saveDraft();
      this.showSubmitButton = true;

      return;
    }

    if (nextFieldIds && nextFieldIds.length > 0) {

      let insertAt = this.currentIndex + 1;

      for (const id of nextFieldIds) {
        const nxt = this.allFormData.find(f => f.id === id);
        if (!nxt) continue;

        const existingIdx = this.formData.findIndex(f => f.id === id);

        if (existingIdx === -1) {
          this.formData.splice(insertAt, 0, nxt);
          this.ensureDefaultsFor(nxt);
          insertAt++;
        } else {
          if (existingIdx < insertAt) {
            const moved = this.formData.splice(existingIdx, 1)[0];
            if (moved) {
              this.formData.splice(insertAt - 1, 0, moved);
            }
          }
          insertAt = Math.max(insertAt, existingIdx + 1);
        }
      }

      this.visitedFields.push({ id: this.currentField.id, index: this.currentIndex });

      const firstId = nextFieldIds[0];
      this.currentField = this.formData.find(f => f.id === firstId) || null;
      this.currentIndex = this.currentField ? this.formData.indexOf(this.currentField) : this.currentIndex;

    } else if (this.currentIndex < this.formData.length - 1) {
      this.visitedFields.push({ id: this.currentField.id, index: this.currentIndex });
      this.currentIndex++;
      this.currentField = this.formData[this.currentIndex] || null;

    } else if (this.notSuitable) {
      this.saveDraft();
      return;

    } else {
      this.saveDraft();
      this.showSubmitButton = true;

    }

    this.saveDraft();
    this.cdr.markForCheck();
  }

  previous() {
    if (this.visitedFields.length > 0) {
      const lastVisited = this.visitedFields.pop();
      if (lastVisited) {
        this.currentIndex = lastVisited.index;
        this.currentField = this.formData[this.currentIndex] || null;
      }
    }
    this.saveDraft();
    this.cdr.markForCheck();
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
      console.log(steps);
    }
  }

  previousPage(): void {
    this.showSubmitButton = false;
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
      const selectedOption = field.options?.find((o) => o.value === selection);
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

  private lsKey(): string {
    return this.storageKey;
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

  private formatIntakeData(): Observable<
    { question_text: string; answer: string; other_text?: string; type: string; consentHtml?: string }[]
  > {
    return of(this.intakeFormJson).pipe(
      map((data: any) => {
        const out: { question_text: string; answer: string; other_text?: string; type: string; consentHtml?: string }[] = [];

        const jsonFields: Field[] = (data?.fields ?? []) as Field[];

        const orderedFields: Field[] = (this.formData?.length ? this.formData : jsonFields) as Field[];

        const selections = this.userSelections || {};

        const getOptLabel = (field: Field, v: any) =>
          field.options?.find((o) => o.value === v)?.label || null;

        for (const field of orderedFields) {
          const key = field.id;

          if (!(key in selections)) continue;

          const value = selections[key];
          const type = field.type ?? 'text';
          const question_text = field.label ?? '';

          let answer = '';
          let other_text: string | undefined;

          const otherKey = `${key}_other_text`;
          if (otherKey in selections && selections[otherKey] != null && String(selections[otherKey]).trim() !== '') {
            other_text = String(selections[otherKey]);
          }

          if (type === 'file') {
            if (Array.isArray(value) && value.length > 0 && value.every((f: any) => f?.name)) {
              answer = value.map((f: any) => f.name).join(', ');
            } else {
              answer = 'No files attached';
            }

          } else if (type === 'date') {
            answer = this.fmtDate(value);

          } else if (type === 'consent' && value && typeof value === 'object') {
            const defs = field.consentFields || [];
            const parts = defs
              .map((sf) => {
                const raw = (value as any)[sf.key];
                const v = sf.type === 'date' ? this.fmtDate(raw) : (raw ?? '');
                return v ? `${sf.label}: ${v}` : '';
              })
              .filter(Boolean);
            answer = parts.join(' | ');

          } else if (Array.isArray(value)) {

            answer = value.map((v) => getOptLabel(field, v) || String(v)).join(', ');

          } else if (typeof value === 'string') {

            answer = getOptLabel(field, value) || value;

          } else if (typeof value === 'object' && value !== null) {

            const trues = Object.entries(value)
              .filter(([_, checked]) => checked === true)
              .map(([optVal]) => getOptLabel(field, optVal) || String(optVal));
            answer = trues.length ? trues.join(', ') : 'None';

          } else {
            answer = String(value ?? '');
          }

          if (question_text) {
            out.push({
              question_text,
              answer,
              ...(other_text ? { other_text } : {}),
              type,
              ...(type === 'consent' && field.consentHtml ? { consentHtml: field.consentHtml } : {}),
            });
          }
        }

        return out;
      })
    );
  }

  private createTreatmentPayload(intakeFormData: any[]): any {
    return {
      inTakeForm: intakeFormData.map(i => ({
        question: i.question_text,
        answer: i.answer,
        otherText: i.other_text || '',
        type: i.type,
        ...(i.consentHtml ? { consentHtml: i.consentHtml } : {}),
      }))
    };
  }

  async submitIntakeToTreatment(): Promise<void> {
    try {
      const intakeFormData = await lastValueFrom(this.formatIntakeData());
      const payload = this.createTreatmentPayload(intakeFormData);
      const res = await this.submitTreatmentData(payload);
      console.log('savePatientTreatment (intake-only) response:', res);
    } catch (err: any) {
      console.error('savePatientTreatment failed:', err);
      this.generalService.showError(err?.message || 'Treatment submission failed');
    } finally {
      this.cdr.markForCheck();
    }
  }

  private async submitTreatmentData(payload: any): Promise<any> {
    console.log('Submitting payload to savePatientTreatment:', payload);

    this.isFormSubmitting = true;
    this.cdr.markForCheck();

    let payloadWithTreatmentId = {
      patientTreatmentId: this.selectedTreatmentIdForSavingIntakeForm,
      items: payload.inTakeForm
    };

    this.generalService.savePatientIntakeFormByTreatmentID(payloadWithTreatmentId).subscribe(
      (res) => {
        console.log('savePatientTreatment (intake-only) response:', res);
        this.generalService.showSuccess('Questionnaire submitted successfully');
        this.isFormSubmitting = false;
        localStorage.removeItem(this.lsKey());
        this.questionnaireSubmitted.emit('formClosed');
        this.cdr.markForCheck();
      },
      (error) => {
        console.error('savePatientTreatment failed:', error);
        this.generalService.showError('Treatment submission failed');
        this.isFormSubmitting = false;
        this.cdr.markForCheck();
      }
    );

    return Promise.resolve(true);
  }

  trackByField = (_: number, f: Field) => f.id;
  trackByOption = (_: number, o: { value: string }) => o.value;
  trackByConsentField = (_: number, cf: ConsentFieldDef) => cf.key;
}
