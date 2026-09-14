import { ComponentFixture, TestBed } from '@angular/core/testing';

import { GaClinicInvoiceBillDetailsComponent } from './ga-clinic-invoice-bill-details.component';

describe('GaClinicInvoiceBillDetailsComponent', () => {
  let component: GaClinicInvoiceBillDetailsComponent;
  let fixture: ComponentFixture<GaClinicInvoiceBillDetailsComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [GaClinicInvoiceBillDetailsComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(GaClinicInvoiceBillDetailsComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
