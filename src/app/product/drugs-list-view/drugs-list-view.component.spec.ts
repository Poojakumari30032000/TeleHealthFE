import { ComponentFixture, TestBed } from '@angular/core/testing';

import { DrugsListViewComponent } from './drugs-list-view.component';

describe('DrugsListViewComponent', () => {
  let component: DrugsListViewComponent;
  let fixture: ComponentFixture<DrugsListViewComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [DrugsListViewComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(DrugsListViewComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
