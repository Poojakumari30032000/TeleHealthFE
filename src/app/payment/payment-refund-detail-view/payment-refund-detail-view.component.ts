import { ChangeDetectionStrategy, Component } from '@angular/core';
import { Location } from "@angular/common";

@Component({
  selector: 'app-payment-refund-detail-view',
  templateUrl: './payment-refund-detail-view.component.html',
  styleUrl: './payment-refund-detail-view.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class PaymentRefundDetailViewComponent {

  constructor(private _location: Location){}

  moveBack() {
    this._location.back();
  }

}
