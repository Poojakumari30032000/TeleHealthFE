import { ComponentFixture, TestBed } from '@angular/core/testing';

import { SubscriptionPlanDetailComponent } from './subscription-plan-detail.component';

describe('SubscriptionPlanDetailComponent', () => {
  let component: SubscriptionPlanDetailComponent;
  let fixture: ComponentFixture<SubscriptionPlanDetailComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [SubscriptionPlanDetailComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(SubscriptionPlanDetailComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
