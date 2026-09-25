import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  OnDestroy,
  OnInit,
} from '@angular/core';
import { Subject, forkJoin, of, catchError, takeUntil } from 'rxjs';
import { GeneralService } from 'app/shared/services/general.service';
import { QuestionnaireAnswerView } from '../questionnaire-answers/questionnaire-answers.component';

/** A questionnaire assigned to the patient (TEL-57). */
interface AssignedQuestionnaire {
  patientQuestionnaireId: number;
  questionnaireId: number;
  questionnaireName: string | null;
  status: 'Assigned' | 'InProgress' | 'Submitted' | 'Cancelled' | 'Expired';
  assignedDate: string;
  assignedByName: string | null;
  dueDate: string | null;
  startedDate: string | null;
  submittedDate: string | null;
  draftSavedDate: string | null;
  answerCount: number;
}

/** One intake form completed as part of buying a treatment, before assignments existed. */
interface IntakeHistoryItem {
  patientTreatmentId: number;
  productId: number | null;
  productName: string | null;
  questionnaireName: string | null;
  submittedDate: string | null;
  answerCount: number;
}

/** A row of the Completed list, from either source. */
interface CompletedItem {
  key: string;
  title: string;
  subtitle: string | null;
  submittedDate: string | null;
  answerCount: number;
  source: 'assignment' | 'intake';
  id: number;
}

@Component({
  selector: 'app-my-questionnaires',
  templateUrl: './my-questionnaires.component.html',
  styleUrls: ['./my-questionnaires.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MyQuestionnairesComponent implements OnInit, OnDestroy {

  pending: AssignedQuestionnaire[] = [];
  completed: CompletedItem[] = [];
  loadingList = false;
  listError: string | null = null;

  /** The assignment open in the fill-in modal. */
  filling: AssignedQuestionnaire | null = null;
  isFillVisible = false;

  isAnswersVisible = false;
  selected: CompletedItem | null = null;
  answers: QuestionnaireAnswerView[] = [];
  loadingAnswers = false;
  answersError: string | null = null;

  private destroy$ = new Subject<void>();

  constructor(
    private generalService: GeneralService,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    this.loadQuestionnaires();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  trackByAssignment = (_: number, item: AssignedQuestionnaire): number => item.patientQuestionnaireId;
  trackByCompleted = (_: number, item: CompletedItem): string => item.key;

  loadQuestionnaires(): void {
    this.loadingList = true;
    this.listError = null;
    this.cdr.markForCheck();

    // Either source failing should not hide the other.
    forkJoin({
      assigned: this.generalService.getMyAssignedQuestionnaires().pipe(catchError(() => of(null))),
      intake: this.generalService.getMyQuestionnaires().pipe(catchError(() => of(null))),
    })
      .pipe(takeUntil(this.destroy$))
      .subscribe(({ assigned, intake }) => {
        const assignedOk = assigned?.status === 1;
        const intakeOk = intake?.status === 1;

        const assignments: AssignedQuestionnaire[] = assignedOk ? (assigned.data ?? []) : [];
        const history: IntakeHistoryItem[] = intakeOk ? (intake.data ?? []) : [];

        this.pending = assignments
          .filter(a => a.status === 'Assigned' || a.status === 'InProgress')
          .sort((a, b) => this.dueSortKey(a) - this.dueSortKey(b));

        this.completed = [
          ...assignments
            .filter(a => a.status === 'Submitted')
            .map<CompletedItem>(a => ({
              key: `a-${a.patientQuestionnaireId}`,
              title: a.questionnaireName || 'Questionnaire',
              subtitle: null,
              submittedDate: a.submittedDate,
              answerCount: a.answerCount,
              source: 'assignment',
              id: a.patientQuestionnaireId,
            })),
          ...history.map<CompletedItem>(h => ({
            key: `t-${h.patientTreatmentId}`,
            title: h.questionnaireName || h.productName || 'Questionnaire',
            subtitle: h.productName && h.questionnaireName ? h.productName : null,
            submittedDate: h.submittedDate,
            answerCount: h.answerCount,
            source: 'intake',
            id: h.patientTreatmentId,
          })),
        ].sort((a, b) => this.time(b.submittedDate) - this.time(a.submittedDate));

        if (!assignedOk && !intakeOk) {
          this.listError = assigned?.message || intake?.message || 'Your questionnaires could not be loaded.';
        }

        this.loadingList = false;
        this.cdr.markForCheck();
      });
  }

  // ------------------------------------------------------------ fill in

  openForm(item: AssignedQuestionnaire): void {
    this.filling = item;
    this.isFillVisible = true;
    this.cdr.markForCheck();
  }

  /**
   * Closing destroys the form component, which flushes any unsaved progress.
   * The list is reloaded either way so status and "last saved" are current.
   */
  closeForm(): void {
    this.isFillVisible = false;
    this.filling = null;
    this.cdr.markForCheck();
    this.loadQuestionnaires();
  }

  // ------------------------------------------------------------ answers

  openAnswers(item: CompletedItem): void {
    this.selected = item;
    this.answers = [];
    this.answersError = null;
    this.isAnswersVisible = true;
    this.loadingAnswers = true;
    this.cdr.markForCheck();

    const request$ = item.source === 'assignment'
      ? this.generalService.getPatientQuestionnaireSubmission(item.id)
      : this.generalService.getMyQuestionnaireResponses(item.id);

    request$
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (response) => {
          if (response?.status === 1) {
            this.answers = item.source === 'assignment'
              ? (response.data?.answers ?? [])
              : (response.data ?? []);
          } else {
            this.answersError = response?.message || 'These answers could not be loaded.';
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
    this.selected = null;
    this.answers = [];
    this.answersError = null;
    this.cdr.markForCheck();
  }

  // ------------------------------------------------------------ helpers

  isOverdue(item: AssignedQuestionnaire): boolean {
    if (!item.dueDate) return false;
    const due = new Date(item.dueDate);
    due.setHours(23, 59, 59, 999);
    return due.getTime() < Date.now();
  }

  private dueSortKey(item: AssignedQuestionnaire): number {
    return item.dueDate ? this.time(item.dueDate) : Number.MAX_SAFE_INTEGER;
  }

  private time(value: string | null): number {
    if (!value) return 0;
    const t = new Date(value).getTime();
    return isNaN(t) ? 0 : t;
  }
}
