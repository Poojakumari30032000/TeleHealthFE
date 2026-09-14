import { ComponentFixture, TestBed } from '@angular/core/testing';

import { CategoriesIframeComponent } from './categories-iframe.component';

describe('CategoriesIframeComponent', () => {
  let component: CategoriesIframeComponent;
  let fixture: ComponentFixture<CategoriesIframeComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [CategoriesIframeComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(CategoriesIframeComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
