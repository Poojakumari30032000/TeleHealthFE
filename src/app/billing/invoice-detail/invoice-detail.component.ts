import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  ViewChild,
} from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { Location } from '@angular/common';
import { TitleService } from 'app/shared/services/title.service';
import { CommanFormModalComponent } from 'app/shared/comman-form-modal/comman-form-modal.component';
import { GeneralService } from 'app/shared/services/general.service';
import { InvoiceData } from '../invoiceDataModel';

@Component({
  selector: 'app-invoice-detail',
  templateUrl: './invoice-detail.component.html',
  styleUrl: './invoice-detail.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class InvoiceDetailComponent {

  @ViewChild('commanModel', { static: false }) commanModel!: CommanFormModalComponent;
  formTitle: string = '';
  formPath: string = '';

  modalApiUrl: { save?: string; get?: string } = {
    save: '',
    get: '',
  };

  orderDetail: any[] = [
    {
      item: 'Subscription Startup Plan',
      ammount: 299,
    },
  ];

  invoiceID: number = 0;
invoiceData: InvoiceData = {
  invoiceId: 0,
  invoiceNumber: '',
  customerName: null,
  amount: '0',
  status: '',
  invoiceType: '',
  isActive: false,
  createdBy: 0,
  createdDate: '',
  subscriptionId: null,
  expirationYear: '',
  expirationMonth: '',
  last4: '',
  cardBrand: '',
  cardHolderName: '',
  currency: '',
  cardId: 0,
  email: ''
};

  constructor(
    private route: Router,
    private cdr: ChangeDetectorRef,
    private _location: Location,
    private titleService: TitleService,
    private activatedRoute: ActivatedRoute,
    private generalService: GeneralService,

  ) {}

  ngOnInit(){

    this.activatedRoute.params.subscribe(params => {

      this.invoiceID = Number(params['id']);

    });

    this.generalService.getInvoiceById(this.invoiceID).subscribe((res)=>{
      console.log(res)
      this.invoiceData = res.data;

       console.log(this.invoiceData)

      this.cdr.markForCheck();
    })

    this.titleService.updateTitle(
      'Invoice Detail',
      [
        { label: 'Invoices', path: '/billing/invoices' },
        { label: 'Invoice Detail', path: `/billing/invoice/detail/1` }
      ]
    );
  }

  moveBack() {
    this._location.back();
  }

  navigate(route: string) {
    this.route.navigate([route]);
  }

  addEditNote = (data?: any): void => {
    const ID = data?.id;
    const formTitle = data ? 'Edit Note' : 'Add Note';
    const formPath = 'invoice/invoice-note.json';
    this.commanModel.showModal(formTitle, 'form', formPath, ID )
    this.cdr.detectChanges();
  };
}
