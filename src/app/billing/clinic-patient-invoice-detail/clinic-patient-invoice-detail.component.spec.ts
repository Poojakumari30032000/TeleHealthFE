import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ClinicPatientInvoiceDetailComponent } from './clinic-patient-invoice-detail.component';

describe('ClinicPatientInvoiceDetailComponent', () => {
  let component: ClinicPatientInvoiceDetailComponent;
  let fixture: ComponentFixture<ClinicPatientInvoiceDetailComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ClinicPatientInvoiceDetailComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(ClinicPatientInvoiceDetailComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
