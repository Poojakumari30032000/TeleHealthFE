import { ComponentFixture, TestBed } from '@angular/core/testing';

import { GlobalAdminTicketsDetailedViewComponent } from './global-admin-tickets-detailed-view.component';

describe('GlobalAdminTicketsDetailedViewComponent', () => {
  let component: GlobalAdminTicketsDetailedViewComponent;
  let fixture: ComponentFixture<GlobalAdminTicketsDetailedViewComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [GlobalAdminTicketsDetailedViewComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(GlobalAdminTicketsDetailedViewComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
