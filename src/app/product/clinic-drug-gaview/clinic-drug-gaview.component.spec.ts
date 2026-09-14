import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ClinicDrugGAViewComponent } from './clinic-drug-gaview.component';

describe('ClinicDrugGAViewComponent', () => {
  let component: ClinicDrugGAViewComponent;
  let fixture: ComponentFixture<ClinicDrugGAViewComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ClinicDrugGAViewComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(ClinicDrugGAViewComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
