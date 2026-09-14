import { ComponentFixture, TestBed } from '@angular/core/testing';

import { UserAddEditModalComponent } from './user-add-edit-modal.component';

describe('UserAddEditModalComponent', () => {
  let component: UserAddEditModalComponent;
  let fixture: ComponentFixture<UserAddEditModalComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [UserAddEditModalComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(UserAddEditModalComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
