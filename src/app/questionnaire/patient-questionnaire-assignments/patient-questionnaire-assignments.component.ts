import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  Input,
  OnChanges,
  OnDestroy,
  SimpleChanges,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Subject, takeUntil } from 'rxjs';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzDatePickerModule } from 'ng-zorro-antd/date-picker';
import { NzModalModule, NzModalService } from 'ng-zorro-antd/modal';
import { NzSelectModule } from 'ng-zorro-antd/select';
import { NzTableModule } from 'ng-zorro-antd/table';
import { NzTagModule } from 'ng-zorro-antd/tag';
import { NzAlertModule } from 'ng-zorro-antd/alert';
import { GeneralService } from 'app/shared/services/general.service';
import {
  QuestionnaireAnswersComponent,
  QuestionnaireAnswerView,
} from '../questionnaire-answers/questionnaire-answers.component';

type AssignmentStatus = 'Assigned' | 'InProgress' | 'Submitted' | 'Cancelled' | 'Expired';

interface Assignment {
  patientQuestionnaireId: number;
  questionnaireId: number;
  questionnaireName: string | null;
  patientTreatmentId: number | null;
  status: AssignmentStatus;
  assignedDate: string;
  assignedByName: string | null;
  dueDate: string | null;
  startedDate: string | null;
  submittedDate: string | null;
  answerCount: number;
}

interface AssignableQuestionnaire {
  questionnaireId: number;
  questionnaireName: string | null;
  questionaireType: string | null;
  status: string | null;
  hasOpenAssignment: boolean;
}

/** A treatment the assignment can be tied to. */
export interface AssignableTreatment {
  patientTreatmentId: number;
  name: string | null;
}

/**
 * Staff view of one patient's questionnaires (TEL-57): what is assigned, its
 * status, and the submitted answers. Staff with edit rights can assign and
 * cancel. Access is enforced server side; the inputs only shape the UI.
 */
@Component({
  selector: 'app-patient-questionnaire-assignments',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    NzButtonModule,
    NzDatePickerModule,
    NzModalModule,
    NzSelectModule,
    NzTableModule,
    NzTagModule,
    NzAlertModule,
    QuestionnaireAnswersComponent,
  ],
  templateUrl: './patient-questionnaire-assignments.component.html',
  styleUrls: ['./patient-questionnaire-assignments.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PatientQuestionnaireAssignmentsComponent implements OnChanges, OnDestroy {
  @Input() patientId: number | null = null;
  @Input() canAssign = false;
  @Input() treatments: AssignableTreatment[] = [];

  assignments: Assignment[] = [];
  loading = false;
  loadError: string | null = null;

  // Assign modal
  isAssignVisible = false;
  assignable: AssignableQuestionnaire[] = [];
  loadingAssignable = false;
  selectedQuestionnaireId: number | null = null;
  selectedTreatmentId: number | null = null;
  dueDate: Date | null = null;
  assigning = false;

  // Answers modal
  isAnswersVisible = false;
  viewing: Assignment | null = null;
  answers: QuestionnaireAnswerView[] = [];
  loadingAnswers = false;
  answersError: string | null = null;

  private destroy$ = new Subject<void>();

  constructor(
    private generalService: GeneralService,
    private modal: NzModalService,
    private cdr: ChangeDetectorRef,
  ) {}

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['patientId']) this.load();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  trackById = (_: number, a: Assignment) => a.patientQuestionnaireId;

  load(): void {
    if (!this.patientId) {
      this.assignments = [];
      return;
    }
    this.loading = true;
    this.loadError = null;
    this.cdr.markForCheck();

    this.generalService
      .getPatientQuestionnaireAssignments(this.patientId)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (res: any) => {
          if (res?.status === 1) {
            this.assignments = res.data ?? [];
          } else {
            this.assignments = [];
            this.loadError = res?.message || 'Questionnaires could not be loaded.';
          }
          this.loading = false;
          this.cdr.markForCheck();
        },
        error: () => {
          this.assignments = [];
          this.loadError = 'Questionnaires could not be loaded.';
          this.loading = false;
          this.cdr.markForCheck();
        },
      });
  }

  // ------------------------------------------------------------ assign

  openAssign(): void {
    if (!this.patientId) return;
    this.selectedQuestionnaireId = null;
    this.selectedTreatmentId = null;
    this.dueDate = null;
    this.isAssignVisible = true;
    this.loadingAssignable = true;
    this.cdr.markForCheck();

    this.generalService
      .getAssignableQuestionnaires(this.patientId)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (res: any) => {
          this.assignable = res?.status === 1 ? (res.data ?? []) : [];
          if (res?.status !== 1) this.generalService.showError(res?.message || 'Questionnaires could not be loaded.');
          this.loadingAssignable = false;
          this.cdr.markForCheck();
        },
        error: () => {
          this.assignable = [];
          this.loadingAssignable = false;
          this.generalService.showError('Questionnaires could not be loaded.');
          this.cdr.markForCheck();
        },
      });
  }

  closeAssign(): void {
    this.isAssignVisible = false;
    this.cdr.markForCheck();
  }

  disablePastDates = (current: Date): boolean => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return current < today;
  };

  assign(): void {
    if (!this.patientId || !this.selectedQuestionnaireId || this.assigning) return;

    this.assigning = true;
    this.cdr.markForCheck();

    this.generalService
      .assignPatientQuestionnaire({
        patientId: this.patientId,
        questionnaireId: this.selectedQuestionnaireId,
        patientTreatmentId: this.selectedTreatmentId,
        dueDate: this.dueDate ? this.toDateOnly(this.dueDate) : null,
      })
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (res: any) => {
          this.assigning = false;
          if (res?.status === 1) {
            this.generalService.showSuccess(res?.message || 'Questionnaire assigned.');
            this.isAssignVisible = false;
            this.load();
          } else {
            this.generalService.showError(res?.message || 'The questionnaire could not be assigned.');
          }
          this.cdr.markForCheck();
        },
        error: () => {
          this.assigning = false;
          this.generalService.showError('The questionnaire could not be assigned.');
          this.cdr.markForCheck();
        },
      });
  }

  // ------------------------------------------------------------ cancel

  confirmCancel(item: Assignment): void {
    this.modal.confirm({
      nzTitle: 'Cancel this questionnaire?',
      nzContent: `${item.questionnaireName || 'This questionnaire'} will be removed from the patient's list. Any progress they have saved is kept on record but they can no longer submit it.`,
      nzOkText: 'Cancel questionnaire',
      nzOkDanger: true,
      nzCancelText: 'Keep',
      nzOnOk: () => this.cancel(item),
    });
  }

  private cancel(item: Assignment): void {
    this.generalService
      .cancelPatientQuestionnaire(item.patientQuestionnaireId)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (res: any) => {
          if (res?.status === 1) {
            this.generalService.showSuccess(res?.message || 'Assignment cancelled.');
            this.load();
          } else {
            this.generalService.showError(res?.message || 'The assignment could not be cancelled.');
          }
        },
        error: () => this.generalService.showError('The assignment could not be cancelled.'),
      });
  }

  // ------------------------------------------------------------ answers

  openAnswers(item: Assignment): void {
    this.viewing = item;
    this.answers = [];
    this.answersError = null;
    this.isAnswersVisible = true;
    this.loadingAnswers = true;
    this.cdr.markForCheck();

    this.generalService
      .getPatientQuestionnaireSubmission(item.patientQuestionnaireId)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (res: any) => {
          if (res?.status === 1) {
            this.answers = res.data?.answers ?? [];
          } else {
            this.answersError = res?.message || 'These answers could not be loaded.';
          }
          this.loadingAnswers = false;
          this.cdr.markForCheck();
        },
        error: () => {
          this.answersError = 'These answers could not be loaded.';
          this.loadingAnswers = false;
          this.cdr.markForCheck();
        },
      });
  }

  closeAnswers(): void {
    this.isAnswersVisible = false;
    this.viewing = null;
    this.answers = [];
    this.cdr.markForCheck();
  }

  // ------------------------------------------------------------ helpers

  isOpen(item: Assignment): boolean {
    return item.status === 'Assigned' || item.status === 'InProgress';
  }

  isOverdue(item: Assignment): boolean {
    if (!this.isOpen(item) || !item.dueDate) return false;
    const due = new Date(item.dueDate);
    due.setHours(23, 59, 59, 999);
    return due.getTime() < Date.now();
  }

  statusLabel(status: AssignmentStatus): string {
    return status === 'InProgress' ? 'In progress' : status;
  }

  statusColor(status: AssignmentStatus): string {
    switch (status) {
      case 'Submitted': return 'success';
      case 'InProgress': return 'processing';
      case 'Cancelled': return 'default';
      case 'Expired': return 'warning';
      default: return 'blue';
    }
  }

  treatmentName(id: number | null): string | null {
    if (!id) return null;
    return this.treatments.find(t => t.patientTreatmentId === id)?.name ?? `Treatment #${id}`;
  }

  /** The due date is a calendar day; send it without a timezone shift. */
  private toDateOnly(d: Date): string {
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    return `${d.getFullYear()}-${mm}-${dd}`;
  }
}
