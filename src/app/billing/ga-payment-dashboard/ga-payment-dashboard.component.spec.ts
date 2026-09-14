import { ComponentFixture, TestBed } from '@angular/core/testing';

import { GaPaymentDashboardComponent } from './ga-payment-dashboard.component';

describe('GaPaymentDashboardComponent', () => {
  let component: GaPaymentDashboardComponent;
  let fixture: ComponentFixture<GaPaymentDashboardComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [GaPaymentDashboardComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(GaPaymentDashboardComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
