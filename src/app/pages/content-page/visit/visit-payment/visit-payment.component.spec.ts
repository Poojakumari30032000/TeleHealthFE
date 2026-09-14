import { ComponentFixture, TestBed } from '@angular/core/testing';

import { VisitPaymentComponent } from './visit-payment.component';

describe('VisitPaymentComponent', () => {
  let component: VisitPaymentComponent;
  let fixture: ComponentFixture<VisitPaymentComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [VisitPaymentComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(VisitPaymentComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
