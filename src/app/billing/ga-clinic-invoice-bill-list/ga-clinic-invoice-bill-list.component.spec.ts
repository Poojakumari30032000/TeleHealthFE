import { ComponentFixture, TestBed } from '@angular/core/testing';

import { GaClinicInvoiceBillListComponent } from './ga-clinic-invoice-bill-list.component';

describe('GaClinicInvoiceBillListComponent', () => {
  let component: GaClinicInvoiceBillListComponent;
  let fixture: ComponentFixture<GaClinicInvoiceBillListComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [GaClinicInvoiceBillListComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(GaClinicInvoiceBillListComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
