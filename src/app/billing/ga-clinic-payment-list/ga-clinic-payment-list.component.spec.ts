import { ComponentFixture, TestBed } from '@angular/core/testing';

import { GaClinicPaymentListComponent } from './ga-clinic-payment-list.component';

describe('GaClinicPaymentListComponent', () => {
  let component: GaClinicPaymentListComponent;
  let fixture: ComponentFixture<GaClinicPaymentListComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [GaClinicPaymentListComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(GaClinicPaymentListComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
