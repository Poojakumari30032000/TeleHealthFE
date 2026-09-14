import { ComponentFixture, TestBed } from '@angular/core/testing';

import { PharmacyListViewComponent } from './pharmacy-list-view.component';

describe('PharmacyListViewComponent', () => {
  let component: PharmacyListViewComponent;
  let fixture: ComponentFixture<PharmacyListViewComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [PharmacyListViewComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(PharmacyListViewComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
