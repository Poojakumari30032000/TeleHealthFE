import { ComponentFixture, TestBed } from '@angular/core/testing';

import { PharmacyDetailViewComponent } from './pharmacy-detail-view.component';

describe('PharmacyDetailViewComponent', () => {
  let component: PharmacyDetailViewComponent;
  let fixture: ComponentFixture<PharmacyDetailViewComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [PharmacyDetailViewComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(PharmacyDetailViewComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
