import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ProviderUserProfileComponentComponent } from './provider-user-profile.component.component';

describe('ProviderUserProfileComponentComponent', () => {
  let component: ProviderUserProfileComponentComponent;
  let fixture: ComponentFixture<ProviderUserProfileComponentComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ProviderUserProfileComponentComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(ProviderUserProfileComponentComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
