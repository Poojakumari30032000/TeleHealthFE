import { ChangeDetectionStrategy, ChangeDetectorRef, Component, EventEmitter, Input, OnInit, Output } from '@angular/core';
import { GeneralService } from 'app/shared/services/general.service';
import { finalize, Subject, takeUntil } from 'rxjs';

interface drugList {
  productId: number;
  productName: string;
  productType: string;
  categoryId: number;
  categoryName: string;
  drugType: string;
  price: number;
  quantity: number;
  quantityUnit: string;
  refills: number;
  dose: string;
  dosage: string;
  strenght: string;
  shippingFrequency: string;
  billingFrequency: string;
  regularImageURL: string;
}

@Component({
  selector: 'app-visit-subscription',
  templateUrl: './visit-subscription.component.html',
  styleUrl: './visit-subscription.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class VisitSubscriptionComponent implements OnInit {
  @Input() selectedSub: drugList | null = null;
  @Input() currentStep: number = 0;
  @Output() onContinue = new EventEmitter<any>();
  @Output() onPrevious = new EventEmitter<any>();

  drugData: drugList[] = [];
  filteredDrugData: drugList[] = [];
  selectedPlan: drugList | null = null;
  isPlanSelected: boolean = false;
  isLoading: boolean = false;
  showREror: boolean = false;
  selectedFilters: { label: string; value: string }[] = [];
  showFilters: boolean = false;
  appliedFilters: any[] = [];
  categoryList: any[] = [];
  selectedCategory: number | null = null;

  filters = {
    name: '',
  };

  private destroy$ = new Subject<void>();

  constructor(private generalService: GeneralService, private cdr: ChangeDetectorRef) {}

  ngOnInit() {
    this.loadCategories();
    this.selectedPlan = this.selectedSub;
    this.isPlanSelected = this.selectedPlan ? true : false;
    this.cdr.markForCheck();
  }

  savePlan() {
    if (this.selectedPlan) {
      this.isPlanSelected = true;
    }
  }

  modifyPlan() {
    this.isPlanSelected = false;
    this.selectedPlan = null;
    this.cdr.markForCheck();
  }

  loadDrugs() {
    this.isLoading = true;
    this.generalService
      .commonGet(
        `UnAuthorize/getAllInTakeFormProducts?CategoryId=${this.selectedCategory}`
      )
      .pipe(
        takeUntil(this.destroy$),
        finalize(() => (this.isLoading = false))
      )
      .subscribe({
        next: (response) => {
          if (response?.data) {
            this.drugData = response.data;
            this.filteredDrugData = this.drugData;
          } else {
            this.drugData = [];
            this.filteredDrugData = this.drugData;
          }
          this.cdr.markForCheck();
        },
        error: (error) => {
          console.error('Error in subscription:', error);
          this.cdr.markForCheck();
        },
      });
  }

  loadCategories(): void {
    this.generalService
      .commonGet(`UnAuthorize/getAllCategories`)
      .pipe(takeUntil(this.destroy$),finalize(() => {}))
      .subscribe({
        next: (response) => {
          if (response?.data) {
            this.categoryList = response.data;
            if (this.categoryList.length > 0) {
              this.selectedCategory = this.categoryList[0].categoryId;
              this.loadDrugs();
              this.cdr.markForCheck();
            }
          } else {
            this.categoryList = [];
            this.loadDrugs();
            this.cdr.markForCheck();
          }
        },
        error: (error) => {
          console.error('Error loading categories:', error);
          this.loadDrugs();
          this.cdr.markForCheck();
        },
      });
  }

  applyFilters() {
    this.filteredDrugData = this.drugData.filter((plan) => {
      const matchesName =
        !this.filters.name ||
        plan.productName
          .toLowerCase()
          .includes(this.filters.name.toLowerCase());
      return matchesName;
    });
    this.updateSelectedFilters();
  }

  updateSelectedFilters() {
    this.selectedFilters = [];
    if (this.filters.name) {
      this.selectedFilters.push({ label: 'Name', value: this.filters.name });
    }
    this.cdr.markForCheck();
  }

  goToPrevious() {
    if (!this.isPlanSelected) {
      const data = { stage: 'previous', selectedPlan: this.selectedPlan };
      this.onPrevious.emit(data);
    } else {
      this.isPlanSelected = false;
    }
  }

  continue() {
    const data = { stage: 'continue', selectedPlan: this.selectedPlan };
    this.onContinue.emit(data);
  }

   ngOnDestroy(): void{
    this.destroy$.next();
    this.destroy$.complete();
  }
}
