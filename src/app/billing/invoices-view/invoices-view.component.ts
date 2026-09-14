import {  ChangeDetectionStrategy, ChangeDetectorRef, Component } from '@angular/core';
import { Router } from '@angular/router';
import { AuthService } from 'app/shared/Auth/auth.service';

import { GeneralService } from 'app/shared/services/general.service';
import { NzNotificationService } from 'ng-zorro-antd/notification';

@Component({
  selector: 'app-invoices-view',
  templateUrl: './invoices-view.component.html',
  styleUrl: './invoices-view.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush
})

export class InvoicesViewComponent {

  invoiceData: any[] = [];

  userRole = this.auth.getUserRole()

  constructor(

    private cdr: ChangeDetectorRef,
    private generalService: GeneralService,
    private notification: NzNotificationService,
    private route: Router,
    private auth : AuthService,

  ) {}

  ngOnInit() {

    if(this.userRole != 'Patient'){
      this.getAllInvoices();
    }
    else{
      this.getAllPatientInvoicesByPatientId();
    }
  }

  getAllInvoices(){
    this.generalService.getAllInvoicesByFacility().subscribe({
      next: (data) => {
        this.invoiceData = data;
        this.cdr.markForCheck();
      },
      error: (err) => {
        console.error('Error fetching invoices:', err);
      },
    });
  }

  getAllPatientInvoicesByPatientId(){
        this.generalService.getAllPatientInvoicesByPatientId().subscribe({
      next: (data) => {
        this.invoiceData = data;
        this.cdr.markForCheck();
      },
      error: (err) => {
        console.error('Error fetching invoices:', err);
      },
    });

  }

testfunc(data: any): void {
  console.log('Action clicked for:', data);
}

getStatusColor(status: string): string {
    switch (status.toLowerCase()) {
      case 'pending':
        return 'orange';
      case 'paid':
        return 'green';
      case 'overdue':
        return 'darkorange';
      case 'failed':
        return 'red';
      default:
        return 'black';
    }
  }
  payInvoice(invoice: any) {

    let invoiceId = invoice.invoiceId;

    this.generalService.payInvoice(invoiceId).subscribe({
      next: (data) => {
        console.log('Invoice paid successfully:', data);
        this.notification.success('Success', 'Invoice paid successfully');
        this.getAllInvoices();
      },
      error: (err) => {
        console.error('Error paying invoice:', err);
        const msg = err?.error?.message ?? err?.message ?? 'Failed to pay invoice';
        this.notification.error('Error', msg);
      },
    });
  }

  viewInvoice(invoice: any) {
    console.log('Viewing invoice:', invoice);
    this.route.navigate(['/billing/invoice/detail', invoice.invoiceId]);

  }
}
