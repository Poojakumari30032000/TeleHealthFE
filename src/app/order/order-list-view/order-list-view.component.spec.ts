import { ComponentFixture, TestBed } from '@angular/core/testing';

import { OrderListViewComponent } from './order-list-view.component';

describe('OrderListViewComponent', () => {
  let component: OrderListViewComponent;
  let fixture: ComponentFixture<OrderListViewComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [OrderListViewComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(OrderListViewComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
