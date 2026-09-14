import { ComponentFixture, TestBed } from '@angular/core/testing';

import { FacilityInfoViewComponent } from './facility-info-view.component';

describe('FacilityInfoViewComponent', () => {
  let component: FacilityInfoViewComponent;
  let fixture: ComponentFixture<FacilityInfoViewComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [FacilityInfoViewComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(FacilityInfoViewComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
