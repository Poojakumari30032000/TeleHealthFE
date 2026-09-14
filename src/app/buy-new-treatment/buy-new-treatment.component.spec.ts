import { ComponentFixture, TestBed } from '@angular/core/testing';

import { BuyNewTreatmentComponent } from './buy-new-treatment.component';

describe('BuyNewTreatmentComponent', () => {
  let component: BuyNewTreatmentComponent;
  let fixture: ComponentFixture<BuyNewTreatmentComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [BuyNewTreatmentComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(BuyNewTreatmentComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
