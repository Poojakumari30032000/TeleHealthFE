import { ComponentFixture, TestBed } from '@angular/core/testing';

import { FullscriptPlatformComponent } from './fullscript-platform.component';

describe('FullscriptPlatformComponent', () => {
  let component: FullscriptPlatformComponent;
  let fixture: ComponentFixture<FullscriptPlatformComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [FullscriptPlatformComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(FullscriptPlatformComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
