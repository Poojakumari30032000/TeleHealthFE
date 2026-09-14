import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ProductBundleDetailViewComponent } from './product-bundle-detail-view.component';

describe('ProductBundleDetailViewComponent', () => {
  let component: ProductBundleDetailViewComponent;
  let fixture: ComponentFixture<ProductBundleDetailViewComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ProductBundleDetailViewComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(ProductBundleDetailViewComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
