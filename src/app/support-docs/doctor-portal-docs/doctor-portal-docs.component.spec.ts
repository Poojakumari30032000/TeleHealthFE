import { ComponentFixture, TestBed } from '@angular/core/testing';

import { DoctorPortalDocsComponent } from './doctor-portal-docs.component';

describe('DoctorPortalDocsComponent', () => {
  let component: DoctorPortalDocsComponent;
  let fixture: ComponentFixture<DoctorPortalDocsComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [DoctorPortalDocsComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(DoctorPortalDocsComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
