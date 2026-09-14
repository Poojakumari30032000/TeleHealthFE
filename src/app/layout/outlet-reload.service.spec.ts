import { TestBed } from '@angular/core/testing';

import { OutletReloadService } from './outlet-reload.service';

describe('OutletReloadService', () => {
  let service: OutletReloadService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(OutletReloadService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
