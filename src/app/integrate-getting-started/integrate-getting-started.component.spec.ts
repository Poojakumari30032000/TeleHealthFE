import { ComponentFixture, TestBed } from '@angular/core/testing';

import { IntegrateGettingStartedComponent } from './integrate-getting-started.component';

describe('IntegrateGettingStartedComponent', () => {
  let component: IntegrateGettingStartedComponent;
  let fixture: ComponentFixture<IntegrateGettingStartedComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [IntegrateGettingStartedComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(IntegrateGettingStartedComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
