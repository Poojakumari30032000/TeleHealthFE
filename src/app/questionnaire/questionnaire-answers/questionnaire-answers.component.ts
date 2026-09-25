import { ChangeDetectionStrategy, Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';

/** The fields of a stored answer this view reads. Both answer tables fit it. */
export interface QuestionnaireAnswerView {
  question: string | null;
  answer: string | null;
  otherText: string | null;
}

/**
 * Read-only list of a submission's answers. Shared by the patient's
 * My Questionnaires page and the provider's patient view (TEL-57).
 */
@Component({
  selector: 'app-questionnaire-answers',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './questionnaire-answers.component.html',
  styleUrls: ['./questionnaire-answers.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class QuestionnaireAnswersComponent {
  @Input() answers: QuestionnaireAnswerView[] = [];

  /** A checkbox-style answer arrives as a delimited string; show it as a list. */
  answerLines(answer: QuestionnaireAnswerView): string[] {
    const raw = (answer.answer ?? '').trim();
    if (!raw) return [];
    return raw
      .split(/\r?\n|\|/)
      .map(part => part.trim())
      .filter(part => part.length > 0);
  }
}
