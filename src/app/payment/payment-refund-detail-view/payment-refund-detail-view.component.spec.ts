import { ComponentFixture, TestBed } from '@angular/core/testing';

import { PaymentRefundDetailViewComponent } from './payment-refund-detail-view.component';

describe('PaymentRefundDetailViewComponent', () => {
  let component: PaymentRefundDetailViewComponent;
  let fixture: ComponentFixture<PaymentRefundDetailViewComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [PaymentRefundDetailViewComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(PaymentRefundDetailViewComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
