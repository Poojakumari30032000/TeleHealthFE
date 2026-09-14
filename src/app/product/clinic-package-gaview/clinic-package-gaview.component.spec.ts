import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ClinicPackageGAViewComponent } from './clinic-package-gaview.component';

describe('ClinicPackageGAViewComponent', () => {
  let component: ClinicPackageGAViewComponent;
  let fixture: ComponentFixture<ClinicPackageGAViewComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ClinicPackageGAViewComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(ClinicPackageGAViewComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
