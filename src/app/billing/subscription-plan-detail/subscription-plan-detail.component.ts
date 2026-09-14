import { Component, OnInit, ChangeDetectorRef, ViewChild } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { TitleService } from 'app/shared/services/title.service';
import { GeneralService } from 'app/shared/services/general.service';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import { CommanFormModalComponent } from 'app/shared/comman-form-modal/comman-form-modal.component';

interface SubscriptionData {
  subscriptionId: number;
  planName: string;
  monthlyPrice: number;
  annualPrice: number;
  setupFee: number;
  maxUsers: number;
  maxProviders: number;
  maxPatients: number;
  storage: number;
  status: string;
  billingCycle: string;
  contractTeam: number;
  supportLevel: string;
  trainingHours: number;
}

@Component({
  selector: 'app-subscription-plan-detail',
  templateUrl: './subscription-plan-detail.component.html',
  styleUrl: './subscription-plan-detail.component.css'
})
export class SubscriptionPlanDetailComponent implements OnInit {
  @ViewChild('commanModel', { static: false }) commanModel!: CommanFormModalComponent;

  subscriptionId: string | null = null;
  subscriptionData: SubscriptionData | null = null;

  modalApiUrl: { save?: string; get?: string } = {
    save: 'Subscriptions/saveSubscription',
    get: 'Subscriptions/getSubscriptionById?Id=',
  };

  isLoading = false;
  hasError = false;
  private destroy$ = new Subject<void>();

  constructor(
    private route: ActivatedRoute,
    private generalService: GeneralService,
    private titleService: TitleService,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    this.subscriptionId = this.route.snapshot.paramMap.get('id');
    this.getSubscriptionDetails();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  getSubscriptionDetails(): void {
    if (!this.subscriptionId) return;
    this.isLoading = true;
    this.hasError = false;

    this.generalService.commonGet(`Subscriptions/getSubscriptionById?id=${this.subscriptionId}`)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (response) => {
          if (response?.status === 1 && response?.data) {
            this.subscriptionData = response.data;
            this.titleService.updateTitle(
              response.data.planName,
              [
                { label: 'Subscription Plans', path: '/billing/subscription-plan' },
                { label: 'Plan Detail', path: `/billing/subscription/detail/${this.subscriptionId}` },
              ]
            );
          } else {
            console.error(response?.message);
            this.hasError = true;
          }
          this.isLoading = false;
          this.cdr.detectChanges();
        },
        error: (err: any) => {
          console.error(err);
          this.isLoading = false;
          this.hasError = true;
          this.cdr.detectChanges();
        }
      });
  }

  refreshDataAfterModal(): void {
    this.getSubscriptionDetails();
  }

  AddEditSubscription = () => {
    const title = this.subscriptionData ? 'Update Subscription' : 'Add Subscription';
    const ID = this.subscriptionData?.subscriptionId || 0;
    const formPath = 'subscription/add-edit-subscription.json';

    this.commanModel.showModal(title, 'form', formPath, ID);
  };
}
