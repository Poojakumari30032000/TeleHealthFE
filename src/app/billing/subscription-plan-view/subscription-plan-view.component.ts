import { ChangeDetectionStrategy, Component, ViewChild } from '@angular/core';
import { DynamicTableComponent } from 'app/shared/dynamic-table/dynamic-table.component';
import { GeneralService } from 'app/shared/services/general.service';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import { CommanFormModalComponent } from 'app/shared/comman-form-modal/comman-form-modal.component';
import { Router } from '@angular/router';

export interface Subscription {
  subscriptionId: number
  planName: string
}

@Component({
  selector: 'app-subscription-plan-view',
  templateUrl: './subscription-plan-view.component.html',
  styleUrl: './subscription-plan-view.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class SubscriptionPlanViewComponent {

  @ViewChild(DynamicTableComponent) dynamicTable!: DynamicTableComponent;
  @ViewChild('commanModel', { static: false }) commanModel!: CommanFormModalComponent;

  modalApiUrl: { save?: string; get?: string } = {
    save: 'Subscriptions/saveSubscription',
    get: 'Subscriptions/getSubscriptionById?Id=',
  };
  appliedFilters: any[] = [];
  CategoryTitle: string = '';
  private destroy$ = new Subject<void>();

  constructor(
    private generalService: GeneralService,
    private route : Router
  ) { }

  ngOnInit(): void {}

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  refreshTable() {
    this.dynamicTable.fetchData();
  }

  AddEditSubscription = (data?: Subscription) => {
    let title: string = 'Add Subscription';
    const ID= data?.subscriptionId || 0;
    const formPath= 'subscription/add-edit-subscription.json';
    if (data) {
      title = 'Update Subscription';
    }
    this.commanModel.showModal(title, 'form', formPath, ID);
  };

  onDelete = (data: Subscription): void => {
    const apiUrl = 'Subscriptions/deleteSubscription';
    const title = `Subscription : ${data.planName}`;
    const body = {
      id: data.subscriptionId,
    };
    this.generalService
      .commonDelete(apiUrl, title, body)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (data) => {
          console.log('Deleted data:', data);
          this.dynamicTable.fetchData();
        },
        error: (err) => {
          console.error('Delete failed:', err);
        },
      });
  };

  navigateToViewSubscription = (data: Subscription) =>{
    const ID = data.subscriptionId;
    this.route.navigate(['billing/subscription/detail', ID]);
  }

}
