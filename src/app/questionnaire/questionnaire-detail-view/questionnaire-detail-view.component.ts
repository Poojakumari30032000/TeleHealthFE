import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  ComponentFactoryResolver,
  ViewChild,
  ViewContainerRef,
} from '@angular/core';
import { CdkDrag, CdkDragDrop, CdkDropList } from '@angular/cdk/drag-drop';
import { Location } from '@angular/common';
import { DynamicIntakeFormComponent } from 'app/pages/content-page/dynamic-intake-form/dynamic-intake-form.component';
import { ActivatedRoute, Router } from '@angular/router';
import { HttpService } from 'app/shared/services/http.service';
import { CanComponentDeactivate } from 'app/shared/Guard/can-deactivate.guard';
import { TitleService } from 'app/shared/services/title.service';
import { NzNotificationService } from 'ng-zorro-antd/notification';
import { Subject, takeUntil } from 'rxjs';
import {AuthService} from "../../shared/Auth/auth.service";
import {GeneralService} from "../../shared/services/general.service";

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

interface Questionnaire {
  fields: Field[];
}

interface ApiData {
  guid: string;
  questionnaireId: number;
  questionnaireName: string;
  questionnaireJson: string;
  questionaireType: string | null;
  productId: number[];
  language: string;
  categoryId: number[];
  createdBy: number;
  createdByName: string;
  status: string;
}

@Component({
  selector: 'app-questionnaire-detail-view',
  templateUrl: './questionnaire-detail-view.component.html',
  styleUrls: ['./questionnaire-detail-view.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class QuestionnaireDetailViewComponent implements CanComponentDeactivate {
  @ViewChild('previewContainer', { read: ViewContainerRef })
  previewContainer!: ViewContainerRef;

  questionnaire: Questionnaire = { fields: [] };
  isDrawerOpen = false;
  selectedField: Field | null = null;

  editorConfig = {
    toolbar: [
      ['bold', 'italic', 'underline'],
      [{ list: 'ordered' }, { list: 'bullet' }],
      [{ header: [1, 2, 3, false] }],
      ['link', 'image'],
      ['clean'],
    ],
  };

  isPreviewModalVisible = false;
  previewModalTitle = 'Questionnaire Preview';
  private previewPayload: Questionnaire | null = null;
  private previewMode: 'full' | 'single' = 'full';
  isloading = false;
  hasError = false;
  questionnaireId = 0;
  apiData: ApiData | null = null;
  isFormDirty = false;

  userRole: string | null = '';

  private destroy$ = new Subject<void>();

  canDeactivate(): boolean | Promise<boolean> {
    return !this.isFormDirty;
  }

  constructor(
    private location: Location,
    private resolver: ComponentFactoryResolver,
    private route: ActivatedRoute,
    private router: Router,
    private api: HttpService,
    private notification: NzNotificationService,
    private titleService: TitleService,
    private cdr: ChangeDetectorRef,
    private authService: AuthService,
    private generalService: GeneralService,
  ) {}

  ngOnInit() {

    this.userRole = this.authService.getUserRole()

    this.route.paramMap.pipe(takeUntil(this.destroy$)).subscribe((params) => {
      this.questionnaireId = +(params.get('id') || 0);
      this.loadQuestionnaire();
    });
  }

  getTagColor(type: string): string {
    const colors: Record<string, string> = {
      text: 'blue',
      textarea: 'cyan',
      checkbox: 'green',
      radio: 'orange',
      select: 'purple',
      'select-multiple': 'geekblue',
      file: 'volcano',
      date: 'gold',
      number: 'lime',
      consent: 'magenta',
    };
    return colors[type] || 'default';
  }

  getTypeLabel(type: string): string {
    const labels: Record<string, string> = {
      text: 'Text Input',
      textarea: 'Text Area',
      checkbox: 'Checkboxes',
      radio: 'Radio Buttons',
      select: 'Dropdown',
      'select-multiple': 'Multi Select',
      file: 'File Upload',
      date: 'Date Picker',
      number: 'Number Input',
      consent: 'Consent',
    };
    return labels[type] || type;
  }

  showOptionsSection(): boolean {
    return !!this.selectedField && (
      this.selectedField.type === 'checkbox' ||
      this.selectedField.type === 'radio' ||
      this.selectedField.type === 'select' ||
      this.selectedField.type === 'select-multiple'
    );
  }

  getFacilitySpecificQuestionnaire(){
    const facilityId = this.authService.getUserFacilityId();
    this.generalService.getFacilitySpecificQuestionnaire(this.questionnaireId,facilityId).subscribe({
      next:(response) => {
        this.apiData = response?.data ?? null;
        if (response.status === 1 && this.apiData) {
          try {
            const raw = this.apiData.questionnaireJson ? JSON.parse(this.apiData.questionnaireJson) : { fields: [] };

            console.log(raw)

            const fields: Field[] = (raw.fields || []).map((f: any) => {
              const base: Field = {
                id: String(f.id),
                label: f.label,
                type: f.type,

                options: Array.isArray(f.options) ? f.options : [],
                nextFields: f.nextFields ?? {},

                description: f.description ?? null,
              };

              const withOptionals: Field = {
                ...base,
                ...(typeof f.groupId === 'string' ? { groupId: f.groupId } : {}),
                ...(typeof f.required === 'boolean' ? { required: f.required } : {}),
                ...(typeof f.showTextarea === 'boolean' ? { showTextarea: f.showTextarea } : {}),
                ...(typeof f.placeholder === 'string' ? { placeholder: f.placeholder } : {}),
              };

              if (f.type === 'consent') {
                return {
                  ...withOptionals,
                  ...(typeof f.consentHtml === 'string' ? { consentHtml: f.consentHtml } : {}),
                  consentFields: Array.isArray(f.consentFields) ? f.consentFields : [],
                };
              }

              return withOptionals;
            });

            this.questionnaire = { fields };

            this.titleService.updateTitle(this.apiData.questionnaireName, [
              { label: 'Forms', path: '/forms' },
              { label: 'Form Detail', path: `/forms/${this.questionnaireId}` },
            ]);
            this.isloading = false;
            this.cdr.markForCheck();
            this.notification.success('Data Fetched Successfully', '');
            return;
          } catch (err) {
            console.error('Error parsing questionnaire JSON:', err);
            this.titleService.updateTitle('Error', [
              { label: 'Forms', path: '/forms' },
              { label: 'Form Detail', path: `/forms/${this.questionnaireId}` },
            ]);
            this.notification.error('Invalid data format, try again later', '');
            this.isloading = false;
            this.cdr.markForCheck();
            this.hasError = true;
            return;
          }
        }

        this.notification.error('Something went wrong, try again later', '');
        this.isloading = false;
        this.cdr.markForCheck();
        this.hasError = true;

      },
      error:(error) => {
        console.error('Error loading questionnaire:', error);
        this.notification.error(error.message, '');
        this.isloading = false;
        this.cdr.markForCheck();
        this.hasError = true;
      }
    })
  }

  loadQuestionnaire() {
    this.isloading = true;
    this.hasError = false;
    if (this.userRole === 'Clinic Admin') {
      this.getFacilitySpecificQuestionnaire()
    }
    else if(this.userRole === 'Global Admin') {
    this.api
      .get(`Questionnaires/getQuestionnaireById?Id=${this.questionnaireId}`)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (response) => {
          this.apiData = response?.data ?? null;
          if (response.status === 1 && this.apiData) {
            try {
              const raw = this.apiData.questionnaireJson ? JSON.parse(this.apiData.questionnaireJson) : { fields: [] };

              const fields: Field[] = (raw.fields || []).map((f: any) => {
                const base: Field = {
                  id: String(f.id),
                  label: f.label,
                  type: f.type,

                  options: Array.isArray(f.options) ? f.options : [],
                  nextFields: f.nextFields ?? {},

                  description: f.description ?? null,
                };

                const withOptionals: Field = {
                  ...base,
                  ...(typeof f.groupId === 'string' ? { groupId: f.groupId } : {}),
                  ...(typeof f.required === 'boolean' ? { required: f.required } : {}),
                  ...(typeof f.showTextarea === 'boolean' ? { showTextarea: f.showTextarea } : {}),
                  ...(typeof f.placeholder === 'string' ? { placeholder: f.placeholder } : {}),
                };

                if (f.type === 'consent') {
                  return {
                    ...withOptionals,
                    ...(typeof f.consentHtml === 'string' ? { consentHtml: f.consentHtml } : {}),
                    consentFields: Array.isArray(f.consentFields) ? f.consentFields : [],
                  };
                }

                return withOptionals;
              });

              this.questionnaire = { fields };

              this.titleService.updateTitle(this.apiData.questionnaireName, [
                { label: 'Forms', path: '/forms' },
                { label: 'Form Detail', path: `/forms/${this.questionnaireId}` },
              ]);
              this.isloading = false;
              this.cdr.markForCheck();
              this.notification.success('Data Fetched Successfully', '');
              return;
            } catch (err) {
              console.error('Error parsing questionnaire JSON:', err);
              this.titleService.updateTitle('Error', [
                { label: 'Forms', path: '/forms' },
                { label: 'Form Detail', path: `/forms/${this.questionnaireId}` },
              ]);
              this.notification.error('Invalid data format, try again later', '');
              this.isloading = false;
              this.cdr.markForCheck();
              this.hasError = true;
              return;
            }
          }

          this.notification.error('Something went wrong, try again later', '');
          this.isloading = false;
          this.cdr.markForCheck();
          this.hasError = true;
        },
        error: (error) => {
          console.error('Error loading questionnaire:', error);
          this.notification.error(error.message, '');
          this.isloading = false;
          this.cdr.markForCheck();
          this.hasError = true;
        },
      });
    }
  }

  saveQuestionnaire(status: string) {
    if (!this.apiData) return;

    if(this.userRole === 'Clinic Admin') {

      let facilityId = this.authService.getUserFacilityId()

      let payload = {
        questionnaireId: this.apiData.questionnaireId,
        json: JSON.stringify(this.questionnaire),
        facilityId: facilityId
      }

      this.generalService.updateQuestionnaireByFacilityId(payload).subscribe({
        next: (response) => {
          if (response.status === 1 && response.data === true) {
            this.isFormDirty = false;
            this.notification.success(response.message, '');
            this.router.navigate(['/forms']);
            return;
          }
          this.notification.error(response.message, '');
        },
        error: (error) => {
          console.error('Error saving questionnaire:', error);
          this.notification.error(error.message, '');
        },
      })
    }

    else if(this.userRole === 'Global Admin') {
    const payload = {
      questionnaireId: this.apiData.questionnaireId,
      questionnaireName: this.apiData.questionnaireName,
      questionnaireJson: JSON.stringify(this.questionnaire),
      questionaireType: this.apiData.questionaireType,
      productId: this.apiData.productId,
      categoryId: this.apiData.categoryId,
      status,
      questionCount: this.questionnaire.fields.length,
    };

    this.api
      .post('Questionnaires/saveQuestionnaire', payload)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (response) => {
          if (response.status === 1 && response.data === true) {
            this.isFormDirty = false;
            this.notification.success(response.message, '');
            this.router.navigate(['/forms']);
            return;
          }
          this.notification.error(response.message, '');
        },
        error: (error) => {
          console.error('Error saving questionnaire:', error);
          this.notification.error(error.message, '');
        },
      });
    }
  }

  private nextMap(f?: Field | null) {
    return f?.nextFields ?? {};
  }

  isFieldLocked(fieldId: string): boolean {
    return (this.questionnaire.fields || []).some((f) =>
      Object.values(this.nextMap(f)).some((ids) => Array.isArray(ids) && ids.includes(fieldId))
    );
  }

  isParentField(fieldId: string): boolean {
    return !(this.questionnaire.fields || []).some((f) =>
      Object.values(this.nextMap(f)).some((ids) => Array.isArray(ids) && ids.includes(fieldId))
    );
  }

  getParentField(fieldId: string): Field | undefined {
    return (this.questionnaire.fields || []).find((f) =>
      Object.values(this.nextMap(f)).some((ids) => Array.isArray(ids) && ids.includes(fieldId))
    );
  }

  getIndentLevel(field: Field): number {
    let level = 0;
    let current: Field | undefined = field;

    while (true) {
      const parent = (this.questionnaire.fields || []).find((f) =>
        Object.values(this.nextMap(f)).some((ids) => Array.isArray(ids) && ids.includes(current!.id))
      );
      if (!parent) break;
      level++;
      current = parent;
    }
    return level;
  }

  private getDependentFieldIds(field: Field): string[] {
    const ids = new Set<string>();
    const stack = [...(Object.values(this.nextMap(field)).flat() as string[])];

    while (stack.length > 0) {
      const currentId = stack.pop();
      if (!currentId || ids.has(currentId)) continue;

      ids.add(currentId);

      const nextField = (this.questionnaire.fields || []).find((f) => f.id === currentId);
      if (nextField) {
        const more = Object.values(this.nextMap(nextField)).flat() as string[];
        stack.push(...more);
      }
    }
    return Array.from(ids);
  }

  getAvailableNextFields(currentFieldId: string): Field[] {
    const currentIndex = (this.questionnaire.fields || []).findIndex((f) => f.id === currentFieldId);
    if (currentIndex === -1) return [];
    return (this.questionnaire.fields || []).filter(
      (field, index) => field.id !== currentFieldId && index > currentIndex
    );
  }

  canMoveBetweenLists = (_drag: CdkDrag<Field>, drop: CdkDropList<Field[]>) => {
    const isRestricted = (drop.data || []).some((field) => this.getDependentFieldIds(field).length > 0);
    return !isRestricted;
  };

  drop(event: CdkDragDrop<Field[]>) {
    const previousIndex = event.previousIndex;
    const currentIndex = event.currentIndex;
    const draggedField = event.item.data;

    const isDroppingInsideGroup = (this.questionnaire.fields || []).some((field) => {
      if (this.isParentField(field.id)) {
        const parentIndex = (this.questionnaire.fields || []).findIndex((f) => f.id === field.id);
        const dependents = this.getDependentFieldIds(field);
        const groupEnd = parentIndex + dependents.length;
        return currentIndex > parentIndex && currentIndex <= groupEnd;
      }
      return false;
    });

    if (isDroppingInsideGroup) return;

    const dependentFieldIds = this.getDependentFieldIds(draggedField);
    const allAffectedFields = [
      draggedField,
      ...dependentFieldIds
        .map((id) => (this.questionnaire.fields || []).find((f) => f.id === id))
        .filter((f): f is Field => !!f),
    ];

    const removedFields: Field[] = [];
    allAffectedFields.forEach((field) => {
      const idx = (this.questionnaire.fields || []).findIndex((f) => f.id === field.id);
      if (idx > -1) {
        const removed = this.questionnaire.fields.splice(idx, 1)[0];
        if (removed) removedFields.push(removed);
      }
    });

    const adjustedIndex =
      currentIndex > previousIndex ? currentIndex - removedFields.length + 1 : currentIndex;

    this.isFormDirty = true;
    this.questionnaire.fields.splice(adjustedIndex, 0, ...removedFields);
  }

  hasCircularDependency(field: Field): boolean {
    const visited = new Set<string>();
    const stack = [field.id];

    while (stack.length > 0) {
      const currentId = stack.pop()!;
      if (visited.has(currentId)) return true;

      visited.add(currentId);
      const currentField = (this.questionnaire.fields || []).find((f) => f.id === currentId);
      if (currentField) {
        const dependencies = (Object.values(this.nextMap(currentField)).flat() as string[]).filter(
          (id) => !['done', 'discontinue'].includes(id)
        );
        stack.push(...dependencies);
      }
    }
    return false;
  }

  saveChanges() {
    if (!this.selectedField) return;

    this.isFormDirty = true;
    if (this.hasCircularDependency(this.selectedField)) {
      alert('Circular dependency detected!');
      return;
    }

    const idx = (this.questionnaire.fields || []).findIndex((f) => f.id === this.selectedField!.id);
    if (idx > -1) {

      const base: Field = {
        id: this.selectedField.id,
        label: this.selectedField.label,
        type: this.selectedField.type,
        options: this.selectedField.options ?? [],
        nextFields: this.selectedField.nextFields ?? {},
        description: this.selectedField.description ?? null,
      };

      let updated: Field = {
        ...base,
        ...(typeof this.selectedField.groupId === 'string' ? { groupId: this.selectedField.groupId } : {}),
        ...(typeof this.selectedField.required === 'boolean' ? { required: this.selectedField.required } : {}),
        ...(typeof this.selectedField.showTextarea === 'boolean' ? { showTextarea: this.selectedField.showTextarea } : {}),
        ...(typeof this.selectedField.placeholder === 'string' ? { placeholder: this.selectedField.placeholder } : {}),
      };

      if (this.selectedField.type === 'consent') {
        updated = {
          ...updated,
          ...(typeof this.selectedField.consentHtml === 'string' ? { consentHtml: this.selectedField.consentHtml } : {}),
          consentFields: Array.isArray(this.selectedField.consentFields)
            ? this.selectedField.consentFields
            : [],
        };
      }

      this.questionnaire.fields[idx] = updated;
    }

    const parentIndex = (this.questionnaire.fields || []).findIndex((f) => f.id === this.selectedField!.id);
    if (parentIndex !== -1 && (this.selectedField!.type === 'radio' || this.selectedField!.type === 'select')) {
      let currentParentIndex = parentIndex;

      const nextFieldIds: string[] = [];
      (this.selectedField!.options ?? []).forEach((option) => {
        const nextIds = (this.selectedField!.nextFields ?? {})[option.value] || [];
        nextIds.forEach((id) => {
          if (id !== 'done' && id !== 'discontinue') nextFieldIds.push(id);
        });
      });

      nextFieldIds.forEach((id) => {
        const fieldIndex = (this.questionnaire.fields || []).findIndex((f) => f.id === id);
        if (fieldIndex === -1) return;

        if (fieldIndex !== currentParentIndex + 1) {
          const [field] = this.questionnaire.fields.splice(fieldIndex, 1);
          if (field) this.questionnaire.fields.splice(currentParentIndex + 1, 0, field);
        }
        currentParentIndex++;
      });
    }

    this.closeDrawer();
  }

  moveBack() {
    this.location.back();
  }

  addQuestion() {
    this.isFormDirty = true;
    (this.questionnaire.fields || []).push({
      id: `${(this.questionnaire.fields || []).length + 1}`,
      label: 'New Question',
      type: 'text',
      options: [],
      nextFields: {},
      description: null,
      required: false,
    });
  }

  deleteQuestion(index: number) {
    this.isFormDirty = true;
    this.questionnaire.fields.splice(index, 1);
  }

  addOption(field: Field) {
    field.options = field.options ?? [];
    field.options.push({
      label: 'New Option',
      value: `option_${field.options.length + 1}`,
      disableContinue: false,
    });
  }

  deleteOption(field: Field, index: number) {
    if (!field.options) return;
    field.options.splice(index, 1);
  }

  addConsentField() {
    if (!this.selectedField || this.selectedField.type !== 'consent') return;
    this.selectedField.consentFields = Array.isArray(this.selectedField.consentFields)
      ? this.selectedField.consentFields
      : [];
    this.selectedField.consentFields.push({
      key: `field_${this.selectedField.consentFields.length + 1}`,
      label: 'New field',
      type: 'text',
      required: true,
      placeholder: '',
    });
  }

  deleteConsentField(index: number) {
    if (!this.selectedField || this.selectedField.type !== 'consent') return;
    if (!Array.isArray(this.selectedField.consentFields)) return;
    this.selectedField.consentFields.splice(index, 1);
  }

  openDrawer(field: Field) {

    const base: Field = {
      id: field.id,
      label: field.label,
      type: field.type,
      options: field.options ? field.options.map(o => ({ ...o })) : [],
      nextFields: field.nextFields ?? {},

      description: Array.isArray(field.description)
        ? field.description.join('\n')
        : (field.description ?? null),
      ...(typeof field.groupId === 'string' ? { groupId: field.groupId } : {}),
      ...(typeof field.required === 'boolean' ? { required: field.required } : {}),
      ...(typeof field.showTextarea === 'boolean' ? { showTextarea: field.showTextarea } : {}),
      ...(typeof field.placeholder === 'string' ? { placeholder: field.placeholder } : {}),
    };

    const editModel: Field =
      field.type === 'consent'
        ? {
            ...base,
            ...(typeof field.consentHtml === 'string' ? { consentHtml: field.consentHtml } : {}),
            consentFields: Array.isArray(field.consentFields)
              ? field.consentFields.map(cf => ({ ...cf }))
              : [],
          }
        : base;

    this.selectedField = editModel;
    this.isDrawerOpen = true;
  }

  closeDrawer() {
    this.isDrawerOpen = false;
  }

  previewForm() {
    this.openPreviewModal(this.cloneQuestionnaire(this.questionnaire), 'Questionnaire Preview', 'full');
  }

  previewSingleQuestion(field: Field) {
    const fields = this.buildSingleQuestionPreviewFields(field);
    this.openPreviewModal({ fields }, `Preview: ${field.label}`, 'single');
  }

  renderPreviewComponent() {
    if (!this.previewPayload) return;

    this.previewContainer.clear();
    const factory = this.resolver.resolveComponentFactory(DynamicIntakeFormComponent);
    const componentRef = this.previewContainer.createComponent(factory);
    componentRef.instance.JsonData = this.previewPayload;
    componentRef.instance.showContinueButton = this.previewMode === 'full';
    componentRef.instance.renderContinueInsideContainer = this.previewMode === 'full';
    componentRef.instance.renderAsMultiQuestionPreview = this.previewMode === 'full';
    componentRef.instance.type = 'inTake';
  }

  closePreviewModal() {
    this.isPreviewModalVisible = false;
    this.previewPayload = null;
    this.previewMode = 'full';
    if (this.previewContainer) {
      this.previewContainer.clear();
    }
  }

  private openPreviewModal(payload: Questionnaire, title: string, mode: 'full' | 'single') {
    this.previewPayload = payload;
    this.previewModalTitle = title;
    this.previewMode = mode;
    this.isPreviewModalVisible = true;
  }

  private buildSingleQuestionPreviewFields(field: Field): Field[] {
    const fieldById = new Map((this.questionnaire.fields || []).map((item) => [item.id, item]));
    const collectedIds = new Set<string>();
    const stack: string[] = [field.id];

    while (stack.length > 0) {
      const currentId = stack.pop();
      if (!currentId || collectedIds.has(currentId)) continue;

      const currentField = fieldById.get(currentId);
      if (!currentField) continue;

      collectedIds.add(currentId);

      const nextIds = (Object.values(this.nextMap(currentField)).flat() as string[]).filter(
        (id) => id && id !== 'done' && id !== 'discontinue'
      );
      stack.push(...nextIds);
    }

    return (this.questionnaire.fields || [])
      .filter((item) => collectedIds.has(item.id))
      .map((item) => this.cloneField(item));
  }

  private cloneQuestionnaire(data: Questionnaire): Questionnaire {
    return {
      fields: (data.fields || []).map((field) => this.cloneField(field)),
    };
  }

  private cloneField(field: Field): Field {
    const cloned: Field = {
      ...field,
      options: Array.isArray(field.options) ? field.options.map((option) => ({ ...option })) : [],
      nextFields: Object.entries(field.nextFields || {}).reduce((acc, [key, value]) => {
        acc[key] = Array.isArray(value) ? [...value] : [];
        return acc;
      }, {} as { [key: string]: string[] }),
      description: Array.isArray(field.description) ? [...field.description] : (field.description ?? null),
    };

    if (field.type === 'consent') {
      cloned.consentFields = Array.isArray(field.consentFields)
        ? field.consentFields.map((consentField) => ({ ...consentField }))
        : [];
    }

    return cloned;
  }

  ngOnDestroy(): void{
    this.destroy$.next();
    this.destroy$.complete();
  }
}
