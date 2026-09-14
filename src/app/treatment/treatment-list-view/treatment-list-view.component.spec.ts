import { ComponentFixture, TestBed } from '@angular/core/testing';

import { TreatmentListViewComponent } from './treatment-list-view.component';

describe('TreatmentListViewComponent', () => {
  let component: TreatmentListViewComponent;
  let fixture: ComponentFixture<TreatmentListViewComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [TreatmentListViewComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(TreatmentListViewComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
