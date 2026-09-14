import { ComponentFixture, TestBed } from '@angular/core/testing';

import { PackagesByCategoriesComponent } from './packages-by-categories.component';

describe('PackagesByCategoriesComponent', () => {
  let component: PackagesByCategoriesComponent;
  let fixture: ComponentFixture<PackagesByCategoriesComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [PackagesByCategoriesComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(PackagesByCategoriesComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
