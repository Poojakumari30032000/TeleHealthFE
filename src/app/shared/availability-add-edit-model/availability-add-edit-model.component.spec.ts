import { ComponentFixture, TestBed } from '@angular/core/testing';

import { AvailabilityAddEditModelComponent } from './availability-add-edit-model.component';

describe('AvailabilityAddEditModelComponent', () => {
  let component: AvailabilityAddEditModelComponent;
  let fixture: ComponentFixture<AvailabilityAddEditModelComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [AvailabilityAddEditModelComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(AvailabilityAddEditModelComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
