import { ComponentFixture, TestBed } from '@angular/core/testing';

import { SupportDetailViewComponent } from './support-detail-view.component';

describe('SupportDetailViewComponent', () => {
  let component: SupportDetailViewComponent;
  let fixture: ComponentFixture<SupportDetailViewComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [SupportDetailViewComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(SupportDetailViewComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
