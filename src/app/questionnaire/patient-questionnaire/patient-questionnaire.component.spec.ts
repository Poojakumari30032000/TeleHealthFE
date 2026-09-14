import { ComponentFixture, TestBed } from '@angular/core/testing';

import { PatientQuestionnaireComponent } from './patient-questionnaire.component';

describe('PatientQuestionnaireComponent', () => {
  let component: PatientQuestionnaireComponent;
  let fixture: ComponentFixture<PatientQuestionnaireComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [PatientQuestionnaireComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(PatientQuestionnaireComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
