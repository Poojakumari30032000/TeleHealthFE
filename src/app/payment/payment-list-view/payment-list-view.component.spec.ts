import { ComponentFixture, TestBed } from '@angular/core/testing';

import { PaymentListViewComponent } from './payment-list-view.component';

describe('PaymentListViewComponent', () => {
  let component: PaymentListViewComponent;
  let fixture: ComponentFixture<PaymentListViewComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [PaymentListViewComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(PaymentListViewComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
