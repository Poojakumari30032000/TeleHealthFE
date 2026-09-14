import { ComponentFixture, TestBed } from '@angular/core/testing';

import { CommanFormModalComponent } from './comman-form-modal.component';

describe('CommanFormModalComponent', () => {
  let component: CommanFormModalComponent;
  let fixture: ComponentFixture<CommanFormModalComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [CommanFormModalComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(CommanFormModalComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
