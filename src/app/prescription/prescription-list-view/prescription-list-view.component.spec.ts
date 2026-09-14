import { ComponentFixture, TestBed } from '@angular/core/testing';

import { PrescriptionListViewComponent } from './prescription-list-view.component';

describe('PrescriptionListViewComponent', () => {
  let component: PrescriptionListViewComponent;
  let fixture: ComponentFixture<PrescriptionListViewComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [PrescriptionListViewComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(PrescriptionListViewComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
