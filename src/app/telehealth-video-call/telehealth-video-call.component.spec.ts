import { ComponentFixture, TestBed } from '@angular/core/testing';

import { TelehealthVideoCallComponent } from './telehealth-video-call.component';

describe('TelehealthVideoCallComponent', () => {
  let component: TelehealthVideoCallComponent;
  let fixture: ComponentFixture<TelehealthVideoCallComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [TelehealthVideoCallComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(TelehealthVideoCallComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
