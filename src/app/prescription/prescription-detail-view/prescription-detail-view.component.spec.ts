import { ComponentFixture, TestBed } from '@angular/core/testing';

import { PrescriptionDetailViewComponent } from './prescription-detail-view.component';

describe('PrescriptionDetailViewComponent', () => {
  let component: PrescriptionDetailViewComponent;
  let fixture: ComponentFixture<PrescriptionDetailViewComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [PrescriptionDetailViewComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(PrescriptionDetailViewComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
