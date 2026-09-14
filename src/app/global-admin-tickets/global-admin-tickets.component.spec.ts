import { ComponentFixture, TestBed } from '@angular/core/testing';

import { GlobalAdminTicketsComponent } from './global-admin-tickets.component';

describe('GlobalAdminTicketsComponent', () => {
  let component: GlobalAdminTicketsComponent;
  let fixture: ComponentFixture<GlobalAdminTicketsComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [GlobalAdminTicketsComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(GlobalAdminTicketsComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
