import { ComponentFixture, TestBed } from '@angular/core/testing';

import { PatientQuestionnaireViewComponent } from './patient-questionnaire-view.component';

describe('PatientQuestionnaireViewComponent', () => {
  let component: PatientQuestionnaireViewComponent;
  let fixture: ComponentFixture<PatientQuestionnaireViewComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [PatientQuestionnaireViewComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(PatientQuestionnaireViewComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
