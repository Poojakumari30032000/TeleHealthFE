import { ComponentFixture, TestBed } from '@angular/core/testing';

import { QuestionnaireListViewComponent } from './questionnaire-list-view.component';

describe('QuestionnaireListViewComponent', () => {
  let component: QuestionnaireListViewComponent;
  let fixture: ComponentFixture<QuestionnaireListViewComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [QuestionnaireListViewComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(QuestionnaireListViewComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
