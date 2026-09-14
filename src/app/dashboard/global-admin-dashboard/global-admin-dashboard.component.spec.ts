import { ComponentFixture, TestBed } from '@angular/core/testing';

import { GlobalAdminDashboardComponent } from './global-admin-dashboard.component';

describe('GlobalAdminDashboardComponent', () => {
  let component: GlobalAdminDashboardComponent;
  let fixture: ComponentFixture<GlobalAdminDashboardComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [GlobalAdminDashboardComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(GlobalAdminDashboardComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
