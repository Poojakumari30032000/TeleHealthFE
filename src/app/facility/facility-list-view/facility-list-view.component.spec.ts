import { ComponentFixture, TestBed } from '@angular/core/testing';

import { FacilityListViewComponent } from './facility-list-view.component';

describe('FacilityListViewComponent', () => {
  let component: FacilityListViewComponent;
  let fixture: ComponentFixture<FacilityListViewComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [FacilityListViewComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(FacilityListViewComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
