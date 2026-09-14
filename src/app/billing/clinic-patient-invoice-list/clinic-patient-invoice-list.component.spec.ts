import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ClinicPatientInvoiceListComponent } from './clinic-patient-invoice-list.component';

describe('ClinicPatientInvoiceListComponent', () => {
  let component: ClinicPatientInvoiceListComponent;
  let fixture: ComponentFixture<ClinicPatientInvoiceListComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ClinicPatientInvoiceListComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(ClinicPatientInvoiceListComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
