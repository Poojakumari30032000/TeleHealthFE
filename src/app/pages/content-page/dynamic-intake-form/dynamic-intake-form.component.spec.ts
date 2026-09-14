import { ComponentFixture, TestBed } from '@angular/core/testing';

import { DynamicIntakeFormComponent } from './dynamic-intake-form.component';

describe('DynamicIntakeFormComponent', () => {
  let component: DynamicIntakeFormComponent;
  let fixture: ComponentFixture<DynamicIntakeFormComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [DynamicIntakeFormComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(DynamicIntakeFormComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
