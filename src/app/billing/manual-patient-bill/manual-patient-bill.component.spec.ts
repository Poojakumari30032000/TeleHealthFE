import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ManualPatientBillComponent } from './manual-patient-bill.component';

describe('ManualPatientBillComponent', () => {
  let component: ManualPatientBillComponent;
  let fixture: ComponentFixture<ManualPatientBillComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ManualPatientBillComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(ManualPatientBillComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
