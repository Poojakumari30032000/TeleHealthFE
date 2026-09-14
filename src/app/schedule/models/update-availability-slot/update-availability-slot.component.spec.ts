import { ComponentFixture, TestBed } from '@angular/core/testing';

import { UpdateAvailabilitySlotComponent } from './update-availability-slot.component';

describe('UpdateAvailabilitySlotComponent', () => {
  let component: UpdateAvailabilitySlotComponent;
  let fixture: ComponentFixture<UpdateAvailabilitySlotComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [UpdateAvailabilitySlotComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(UpdateAvailabilitySlotComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
