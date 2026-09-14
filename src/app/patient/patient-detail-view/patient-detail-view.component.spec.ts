import { ComponentFixture, TestBed } from '@angular/core/testing';

import { PatientDetailViewComponent } from './patient-detail-view.component';

describe('PatientDetailViewComponent', () => {
  let component: PatientDetailViewComponent;
  let fixture: ComponentFixture<PatientDetailViewComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [PatientDetailViewComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(PatientDetailViewComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
