import { ComponentFixture, TestBed } from '@angular/core/testing';

import { SupportListViewComponent } from './support-list-view.component';

describe('SupportListViewComponent', () => {
  let component: SupportListViewComponent;
  let fixture: ComponentFixture<SupportListViewComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [SupportListViewComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(SupportListViewComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
