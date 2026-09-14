import { ComponentFixture, TestBed } from '@angular/core/testing';

import { VisitSubscriptionComponent } from './visit-subscription.component';

describe('VisitSubscriptionComponent', () => {
  let component: VisitSubscriptionComponent;
  let fixture: ComponentFixture<VisitSubscriptionComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [VisitSubscriptionComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(VisitSubscriptionComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
