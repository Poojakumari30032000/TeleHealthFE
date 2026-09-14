import { TestBed } from '@angular/core/testing';

import { SquarePaymentService } from './square-payment.service';

describe('SquarePaymentService', () => {
  let service: SquarePaymentService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(SquarePaymentService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
