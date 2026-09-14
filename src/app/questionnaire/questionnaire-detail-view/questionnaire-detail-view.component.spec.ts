import { ComponentFixture, TestBed } from '@angular/core/testing';

import { QuestionnaireDetailViewComponent } from './questionnaire-detail-view.component';

describe('QuestionnaireDetailViewComponent', () => {
  let component: QuestionnaireDetailViewComponent;
  let fixture: ComponentFixture<QuestionnaireDetailViewComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [QuestionnaireDetailViewComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(QuestionnaireDetailViewComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
