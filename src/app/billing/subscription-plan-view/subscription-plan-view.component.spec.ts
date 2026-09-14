import { ComponentFixture, TestBed } from '@angular/core/testing';

import { SubscriptionPlanViewComponent } from './subscription-plan-view.component';

describe('SubscriptionPlanViewComponent', () => {
  let component: SubscriptionPlanViewComponent;
  let fixture: ComponentFixture<SubscriptionPlanViewComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [SubscriptionPlanViewComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(SubscriptionPlanViewComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
