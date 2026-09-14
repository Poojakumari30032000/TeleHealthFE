import { ComponentFixture, TestBed } from '@angular/core/testing';

import { FacilityAdminDashboardComponent } from './facility-admin-dashboard.component';

describe('FacilityAdminDashboardComponent', () => {
  let component: FacilityAdminDashboardComponent;
  let fixture: ComponentFixture<FacilityAdminDashboardComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [FacilityAdminDashboardComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(FacilityAdminDashboardComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
