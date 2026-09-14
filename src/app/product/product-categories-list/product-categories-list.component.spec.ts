import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ProductCategoriesListComponent } from './product-categories-list.component';

describe('ProductCategoriesListComponent', () => {
  let component: ProductCategoriesListComponent;
  let fixture: ComponentFixture<ProductCategoriesListComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ProductCategoriesListComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(ProductCategoriesListComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
