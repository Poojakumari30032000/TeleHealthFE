import { ComponentFixture, TestBed } from '@angular/core/testing';

import { VisitProviderComponent } from './visit-provider.component';

describe('VisitProviderComponent', () => {
  let component: VisitProviderComponent;
  let fixture: ComponentFixture<VisitProviderComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [VisitProviderComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(VisitProviderComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
