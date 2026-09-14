import { ComponentFixture, TestBed } from '@angular/core/testing';

import { GetStartedFormComponent } from './get-started-form.component';

describe('GetStartedFormComponent', () => {
  let component: GetStartedFormComponent;
  let fixture: ComponentFixture<GetStartedFormComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [GetStartedFormComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(GetStartedFormComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
