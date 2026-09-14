import { ComponentFixture, TestBed } from '@angular/core/testing';
import { NO_ERRORS_SCHEMA } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { of } from 'rxjs';

import { ClinicManualInvoiceViewComponent } from './clinic-manual-invoice-view.component';
import { AuthService } from 'app/shared/Auth/auth.service';
import { GeneralService } from 'app/shared/services/general.service';
import { TitleService } from 'app/shared/services/title.service';
import { NzModalService } from 'ng-zorro-antd/modal';
import { NzNotificationService } from 'ng-zorro-antd/notification';

describe('ClinicManualInvoiceViewComponent', () => {
  let component: ClinicManualInvoiceViewComponent;
  let fixture: ComponentFixture<ClinicManualInvoiceViewComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ClinicManualInvoiceViewComponent],
      providers: [
        {
          provide: ActivatedRoute,
          useValue: {
            snapshot: {
              paramMap: {
                get: () => null,
              },
            },
          },
        },
        {
          provide: AuthService,
          useValue: {
            getUserRole: () => 'Global Admin',
          },
        },
        {
          provide: GeneralService,
          useValue: {
            getInvoiceById: () => of({ data: { lineItems: [], amount: 0 } }),
            payInvoice: () => of({ status: 200, message: 'Success' }),
          },
        },
        {
          provide: TitleService,
          useValue: {
            updateTitle: () => undefined,
          },
        },
        {
          provide: NzModalService,
          useValue: {
            confirm: () => undefined,
          },
        },
        {
          provide: NzNotificationService,
          useValue: {
            success: () => undefined,
            error: () => undefined,
          },
        },
      ],
      schemas: [NO_ERRORS_SCHEMA],
    }).compileComponents();

    fixture = TestBed.createComponent(ClinicManualInvoiceViewComponent);
    component = fixture.componentInstance;
    component.invoiceIdInput = 1;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
