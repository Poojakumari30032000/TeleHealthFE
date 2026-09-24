import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  OnDestroy,
  OnInit,
} from '@angular/core';
import { Subject, takeUntil } from 'rxjs';
import { GeneralService } from 'app/shared/services/general.service';

/** One completed questionnaire in the patient's history. */
interface MyQuestionnaire {
  patientTreatmentId: number;
  productId: number | null;
  productName: string | null;
  questionnaireName: string | null;
  submittedDate: string | null;
  answerCount: number;
}

/** One answered question within a submission. */
interface MyQuestionnaireAnswer {
  patientTreatmentInTakeFormId: number;
  question: string | null;
  answer: string | null;
  otherText: string | null;
  type: string | null;
  consentHtml: string | null;
  createdDate: string | null;
}

@Component({
  selector: 'app-my-questionnaires',
  templateUrl: './my-questionnaires.component.html',
  styleUrls: ['./my-questionnaires.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MyQuestionnairesComponent implements OnInit, OnDestroy {

  questionnaires: MyQuestionnaire[] = [];
  loadingList = false;
  listError: string | null = null;

  isAnswersVisible = false;
  selected: MyQuestionnaire | null = null;
  answers: MyQuestionnaireAnswer[] = [];
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

  trackByTreatmentId = (_: number, item: MyQuestionnaire): number => item.patientTreatmentId;
  trackByAnswerId = (_: number, item: MyQuestionnaireAnswer): number => item.patientTreatmentInTakeFormId;

  loadQuestionnaires(): void {
    this.loadingList = true;
    this.listError = null;
    this.cdr.markForCheck();

    this.generalService
      .getMyQuestionnaires()
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (response) => {
          if (response?.status === 1) {
            this.questionnaires = response.data ?? [];
          } else {
            this.questionnaires = [];
            this.listError = response?.message || 'Your questionnaires could not be loaded.';
          }
          this.loadingList = false;
          this.cdr.markForCheck();
        },
        error: () => {
          this.questionnaires = [];
          this.listError = 'Your questionnaires could not be loaded.';
          this.loadingList = false;
          this.cdr.markForCheck();
        },
      });
  }

  openAnswers(item: MyQuestionnaire): void {
    this.selected = item;
    this.answers = [];
    this.answersError = null;
    this.isAnswersVisible = true;
    this.loadingAnswers = true;
    this.cdr.markForCheck();

    this.generalService
      .getMyQuestionnaireResponses(item.patientTreatmentId)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (response) => {
          if (response?.status === 1) {
            this.answers = response.data ?? [];
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

  /** Title for a row: the questionnaire name, else the product it belonged to. */
  displayTitle(item: MyQuestionnaire): string {
    return item.questionnaireName || item.productName || 'Questionnaire';
  }

  /** A checkbox-style answer arrives as a delimited string; show it as a list. */
  answerLines(answer: MyQuestionnaireAnswer): string[] {
    const raw = (answer.answer ?? '').trim();
    if (!raw) return [];
    return raw
      .split(/\r?\n|\|/)
      .map(part => part.trim())
      .filter(part => part.length > 0);
  }
}
