import { ComponentFixture, TestBed } from '@angular/core/testing';

import { CouponListViewComponent } from './coupon-list-view.component';

describe('CouponListViewComponent', () => {
  let component: CouponListViewComponent;
  let fixture: ComponentFixture<CouponListViewComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [CouponListViewComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(CouponListViewComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
