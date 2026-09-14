import { ComponentFixture, TestBed } from '@angular/core/testing';

import { TreatmentDetailViewComponent } from './treatment-detail-view.component';

describe('TreatmentDetailViewComponent', () => {
  let component: TreatmentDetailViewComponent;
  let fixture: ComponentFixture<TreatmentDetailViewComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [TreatmentDetailViewComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(TreatmentDetailViewComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
