import { ComponentFixture, TestBed } from '@angular/core/testing';
import { NO_ERRORS_SCHEMA } from '@angular/core';
import { of } from 'rxjs';

import { ManualClinicBillComponent } from './manual-clinic-bill.component';
import { GeneralService } from 'app/shared/services/general.service';
import { TitleService } from 'app/shared/services/title.service';
import { NzNotificationService } from 'ng-zorro-antd/notification';
import { NzModalService } from 'ng-zorro-antd/modal';
import { Router } from '@angular/router';

describe('ManualClinicBillComponent', () => {
  let component: ManualClinicBillComponent;
  let fixture: ComponentFixture<ManualClinicBillComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ManualClinicBillComponent],
      providers: [
        {
          provide: GeneralService,
          useValue: {
            getAllFacilitiesDropdown: () => of({ data: [] }),
            getFacilityById: () => of({ data: {} }),
            createManualGAToClinicInvoice: () => of({ data: { invoiceId: 1 }, message: 'Success' }),
          },
        },
        {
          provide: TitleService,
          useValue: {
            updateTitle: () => undefined,
          },
        },
        {
          provide: NzNotificationService,
          useValue: {
            success: () => undefined,
            error: () => undefined,
            warning: () => undefined,
          },
        },
        {
          provide: NzModalService,
          useValue: {
            confirm: () => undefined,
          },
        },
        {
          provide: Router,
          useValue: {
            navigate: () => Promise.resolve(true),
          },
        },
      ],
      schemas: [NO_ERRORS_SCHEMA],
    })
    .compileComponents();

    fixture = TestBed.createComponent(ManualClinicBillComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
