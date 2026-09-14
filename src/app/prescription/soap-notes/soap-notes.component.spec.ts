import { ComponentFixture, TestBed } from '@angular/core/testing';

import { SOAPNotesComponent } from './soap-notes.component';

describe('SOAPNotesComponent', () => {
  let component: SOAPNotesComponent;
  let fixture: ComponentFixture<SOAPNotesComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [SOAPNotesComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(SOAPNotesComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
