import { ComponentFixture, TestBed } from '@angular/core/testing';

import { PrescriptionAddEditViewComponent } from './prescription-add-edit-view.component';

describe('PrescriptionAddEditViewComponent', () => {
  let component: PrescriptionAddEditViewComponent;
  let fixture: ComponentFixture<PrescriptionAddEditViewComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [PrescriptionAddEditViewComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(PrescriptionAddEditViewComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
