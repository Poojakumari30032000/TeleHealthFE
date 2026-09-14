import { ChangeDetectionStrategy, ChangeDetectorRef, Component, ViewChild } from '@angular/core';
import { GeneralService } from 'app/shared/services/general.service';

import { Router } from '@angular/router';
import { DynamicTableComponent } from '../../shared/dynamic-table/dynamic-table.component';
import { Subject, takeUntil } from 'rxjs';

interface Plan {
  id: number;
  title: string;
  name: string;
  des:string;
  infoPoints: string[];
  active?: boolean;
  period?: string;
}

@Component({
  selector: 'app-billing-view',
  templateUrl: './billing-view.component.html',
  styleUrl: './billing-view.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class BillingViewComponent {

  @ViewChild(DynamicTableComponent) dynamicTable!: DynamicTableComponent;
  plans: Plan[] = [
    {
      id: 1,
      title: 'Startup Plan',
      name: '$19',
      des:'For small to medium size businesses looking to start offering treatment online.',
      period: 'month',
      infoPoints: [
        'Doctor Portal, E-Prescribing & EMR.',
        'Patient Portal & Experience Builder.',
        'Pharmacy & Compounding Fulfillment.',
        'Bask All-In-One Telehealth Management Engine.',
      ],
      active: false,
    },
    {
      id: 2,
      title: 'Enterprise',
      name: '$49',
      des:'For larger businesses looking to offer many treatment options and scale rapidly.',
      period: 'month',
      infoPoints: [
        'Everything in Start-up plus:',
        'Up to 10 products and drugs.',
        'Cheaper credit card processing.',
        'Synchronous visits & Scheduling.',
        'Patient Data Enrichment.',
        'Priority support.',
      ],
      active: true,
    },
    {
      id: 3,
      title: 'Custom',
      name: '$69',
      des:'Fully tailored solutions to meet your businesses needs.',
      period: 'month',
      infoPoints: [
        'Everything in Enterprise plus:',
        'Unlimited doctors, physicians assistants, and admins for your workspace.',
        'White Glove Setup.',
        'API access and Webhook Integration.'
      ],
      active: false,
    }
  ];
  selectedPlan: number = 1;
  billStatus = ['Paid', 'Pending', 'Failed', 'Overdue'];
  isChecked = false;
  columns: any[] = [
    { title: 'Invoice', key: 'invoice', width: 'auto' },
    { title: 'Amount', key: 'netPayment', width: 'auto' },
    { title: 'Type', key: 'invType', width: 'auto' },
    { title: 'Date', key: 'date', width: 'auto', type: 'date' },
    {
      title: 'Status',
      key: 'billstatus',
      width: 'auto',
      type: 'badge',
      badgeMapping: {
        paid: {
          class:
            'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300',
          label: 'Paid',
        },
        pending: {
          class:
            'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300',
          label: 'Pending',
        },
        failed: {
          class: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300',
          label: 'Failed',
        },
        overdue: {
          class:
            'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-300',
          label: 'Overdue',
        },
      },
    },
  ];
  columnVisibility: { [key: string]: boolean } = {
    invoice: true,
    netPayment: true,
    invType: true,
    date: true,
    billstatus: true,
  };
  filteredColumns: any[] = [];
  columnSearch: string = '';
  private destroy$ = new Subject<void>();

  constructor(
    private route: Router,
    private cdr: ChangeDetectorRef,
    private generalService: GeneralService
  ) {}

  onClick(plan: Plan) {
    const activeCardElement = document.getElementById(`plan-${plan.id}`);
    if (activeCardElement) {
      activeCardElement.scrollIntoView({ behavior: 'smooth', block: 'start' });
    } else {
      console.error(`Element with ID plan-${plan.id} not found.`);
    }

    const title = 'Confirmation';
    const content = 'Are you sure you want to change your plan?';
    this.generalService.commonConfirm(title, content).pipe(takeUntil(this.destroy$)).subscribe((result) => {
      if (result) {
        this.generalService.showSuccess('Plan Changed Successfully!');
        this.selectedPlan = plan.id;
        this.cdr.detectChanges();
      }
    });
  }

  toggleCheckbox() {
    this.isChecked = !this.isChecked;
  }

  activeScroll() {
    window.scrollTo;
  }
  onHover(plan: Plan) {
    const hoveredCardElement = document.getElementById(`plan-${plan.id}`);
    if (hoveredCardElement) {
      hoveredCardElement.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }

  ngOnInit() {
    this.getfilteredColumnsData();
  }

  ngOnDestroy(): void{
    this.destroy$.next();
    this.destroy$.complete();
  }

  onRefresh() {
    this.dynamicTable.fetchData();
  }

  getfilteredColumnsData() {
    this.filteredColumns = this.columns.filter(
      (column) => this.columnVisibility[column.key]
    );
    this.cdr.detectChanges();
  }

  invoiceDetail = (plan: Plan) => {
    const ID = plan.id;
    this.route.navigate(['billing/invoice/detail', ID]);
  };

}
