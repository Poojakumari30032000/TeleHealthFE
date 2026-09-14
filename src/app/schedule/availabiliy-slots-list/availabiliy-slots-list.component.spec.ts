import { ComponentFixture, TestBed } from '@angular/core/testing';

import { AvailabiliySlotsListComponent } from './availabiliy-slots-list.component';

describe('AvailabiliySlotsListComponent', () => {
  let component: AvailabiliySlotsListComponent;
  let fixture: ComponentFixture<AvailabiliySlotsListComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [AvailabiliySlotsListComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(AvailabiliySlotsListComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
