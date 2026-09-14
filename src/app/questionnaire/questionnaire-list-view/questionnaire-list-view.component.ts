import { HttpErrorResponse } from '@angular/common/http';
import { ChangeDetectionStrategy, ChangeDetectorRef, Component, ViewChild } from '@angular/core';
import { Router } from '@angular/router';
import { AuthService } from 'app/shared/Auth/auth.service';
import { CommanFormModalComponent } from 'app/shared/comman-form-modal/comman-form-modal.component';
import { DynamicTableComponent } from 'app/shared/dynamic-table/dynamic-table.component';
import { GeneralService } from 'app/shared/services/general.service';
import { debounceTime, Subject, takeUntil } from 'rxjs';

interface Questionnaier {
  guid: string
  questionnaireId: number
  questionnaireName: string
  productCount: number
  language: string
  status: string
  review: string
  questionCount: number
  createdDate: string
}

interface Facility{
  facilityId: number
  titlelong: string
}

@Component({
  selector: 'app-questionnaire-list-view',
  templateUrl: './questionnaire-list-view.component.html',
  styleUrl: './questionnaire-list-view.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class QuestionnaireListViewComponent {

  @ViewChild(DynamicTableComponent) dynamicTable!: DynamicTableComponent;
   @ViewChild('commanModel', { static: false }) commanModel!: CommanFormModalComponent;
  modalApiUrl : { save?: string; get?: string } = {
    save: 'Questionnaires/saveQuestionnaire',
    get: 'Questionnaires/getQuestionnaireById?Id='
  };
  readonly orgId = Number(localStorage.getItem('OFL'));
  selectedFacility: number = Number(localStorage.getItem('FOS'));
  readonly userRole = this.auth.getUserRole() || '';
  private destroy$ = new Subject<void>();
  searchQuery: string = '';
  selectedStatus: string | null = null;
  searchTerms = new Subject<void>();
  showFilters: boolean = true;
  appliedFilters: any[] = [];
  selectedDateRange: Date[] | null = null;
  facilities: Facility[] = [];
  facilitiesLoading: boolean = false;
  questionnaireStatus = ['Completed','Draft', 'Pending'];
  columns: any[] = [
    { title: 'ID #', key: 'questionnaireId', width: 'auto' },
    { title: 'Name', key: 'questionnaireName', width: 'auto' },
      { title: 'Created Date', key: 'createdDate', width: 'auto', type: 'date' },
      { title: 'Questions', key: 'questionCount', width: 'auto' },

      {
        title: 'Status',
        key: 'status',
        width: 'auto',
        type: 'badge',
        badgeMapping: {
          Completed: {
            class: 'ui-status-badge--success',
            label: 'Completed',
          },
          InReview: {
            class: 'ui-status-badge--info',
            label: 'In-Review',
          },
          Draft: {
            class: 'ui-status-badge--created',
            label: 'Draft',
          },
          Pending: {
            class: 'ui-status-badge--pending',
            label: 'Pending',
          }
        },
      }
    ];

  constructor(
    private route: Router,
    private generalService: GeneralService,
    private auth: AuthService,
    private cdr: ChangeDetectorRef
  ) {
    this.searchTerms
      .pipe(debounceTime(1000), takeUntil(this.destroy$))
      .subscribe(() => {
        this.applyFilter();
      });
    this.applyFilter();
  }

  ngOnInit() {
    if (this.userRole === 'Global Admin') {
      this.getClinics();
    }
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
    this.searchTerms.next();
    this.searchTerms.complete();
  }

  searchTermChanged(): void {
    this.searchTerms.next();
  }

  formatDateLocal(date: Date): string {
    const year = date.getFullYear();
    const month = ('0' + (date.getMonth() + 1)).slice(-2);
    const day = ('0' + date.getDate()).slice(-2);
    return `${year}-${month}-${day}`;
  }

  applyFilter(): void {
    if(this.userRole === 'Global Admin'){
      this.appliedFilters = [
        { name: 'FacilityId', value: this.selectedFacility || null },
        { name: 'Title', value: this.searchQuery },
        { name: 'Status', value: this.selectedStatus }
      ];
    }
    else{
    this.appliedFilters = [
      { name: 'FacilityId', value: this.selectedFacility },
      { name: 'Title', value: this.searchQuery },
      { name: 'Status', value: this.selectedStatus }
    ];
    }
    if (this.selectedDateRange && this.selectedDateRange.length === 2) {
      const startDate = this.formatDateLocal(this.selectedDateRange[0]!);
      const endDate = this.formatDateLocal(this.selectedDateRange[1]!);
      this.appliedFilters.push({ name: 'StartDate', value: startDate });
      this.appliedFilters.push({ name: 'EndDate', value: endDate });
    }
    this.appliedFilters = this.appliedFilters.filter(filter => filter.value !== null && filter.value !== undefined && filter.value !== '');
  }

  get visibleFiltersCount(): number {
    return this.appliedFilters.filter(f => !this.shouldHideAppliedFilter(f.name)).length;
  }

  shouldHideAppliedFilter(filterName: string): boolean {
    return filterName === 'FacilityId' && this.userRole !== 'Global Admin';
  }

  getFilterDisplayName(filterName: string): string {
    switch (filterName) {
      case 'FacilityId': return 'Clinic';
      default: return filterName;
    }
  }

  getFilterDisplayValue(filter: any): string {
    switch (filter.name) {
      case 'FacilityId':
        const option = this.facilities.find(opt => opt.facilityId.toString() === filter.value?.toString());
        return option ? option.titlelong : filter.value;
      default:
        return filter.value;
    }
  }

  trackByFilterName(_index: number, filter: any): string {
    return filter.name;
  }

  clearFilters() {
    this.searchQuery = '';
    this.selectedStatus = null;
    this.selectedDateRange = null;
    if (this.userRole === 'Global Admin') {
      this.selectedFacility = 0;
    }
    this.applyFilter();
    this.showFilters = true;
  }

  removeFilter(filterName: string) {
    switch(filterName) {
      case 'FacilityId':
        this.selectedFacility = 0;
        break;
      case 'Title':
        this.searchQuery = '';
        break;
      case 'Status':
        this.selectedStatus = null;
        break;
      case 'StartDate':
        this.selectedDateRange = null;
        break;
      case 'EndDate':
        this.selectedDateRange = null;
        break;
    }
    this.applyFilter();
  }

  onFacilityFilterChange(value: number | null): void {
    this.selectedFacility = Number(value || 0);
    this.applyFilter();
  }

  getClinics(){
    this.facilitiesLoading = true;
    this.facilities = [];
    this.generalService.commonGet(`DropDowns/getAllFacilities?OrganizationId=${this.orgId}`).pipe(takeUntil(this.destroy$)).subscribe({
      next: (response) => {
        if (response?.status === 1 && response?.data) {
          this.facilities = response?.data || [];
          this.facilitiesLoading = false;
          this.cdr.detectChanges();
          return;
        }
        this.facilities = [];
        this.facilitiesLoading = false;
        this.cdr.detectChanges();
      },
      error: (err: HttpErrorResponse) => {
        console.error('Failed to fetch categories:', err);
        this.facilities = [];
        this.facilitiesLoading = false;
        this.cdr.detectChanges();
      }
    });
  }

  onRefresh() {
    this.dynamicTable.fetchData();
  }

  questionnaireDuplicate = (data: Questionnaier): void => {
    const apiUrl = 'Questionnaires/duplicateQuestionnaire';
    const title = 'Confirmation';
    const content = `Are you sure you want to duplicate this Questionnaire: ${data.questionnaireName}?`;
    const body = {
      questionnaireId: data.questionnaireId,
    };
    this.generalService.commonConfirm(title, content).pipe(takeUntil(this.destroy$)).subscribe((confirmed) => {
      if (confirmed) {
        this.generalService.commonPost(apiUrl, body).pipe(takeUntil(this.destroy$)).subscribe({
          next: (response) => {
            if (response?.status === 1 && response.data > 0) {
              this.generalService.showSuccess(response?.message);
              this.dynamicTable.fetchData();
            } else {
              this.generalService.showError(response?.message);
            }
          },
          error: (error) => {
            console.error('Error duplicate questionnaire', error);
            this.generalService.showError(`Failed to duplicate Questionnaire: ${data.questionnaireName}. Please try again later.`);
          }
        });
      }
    });
  }

  questionnaireView = (data: Questionnaier): void =>{
    this.route.navigate(['forms', data.questionnaireId])
  }

  AddEditQuestionnaire = (data?: Questionnaier) :void =>{
    let title : string = 'Add Questionnaire';
    const ID = data?.questionnaireId || 0
    const formPath = 'questionnaier/add-edit-questionnaier.json';
    if(data){
      title = 'Update Questionnaire';
    }
    this.commanModel.showModal(title, 'form', formPath, ID)
  }

  onDelete = (data: Questionnaier): void => {
    const apiUrl = 'Questionnaires/deleteQuestionnaire';
    const title = `Questionnaier: ${data.questionnaireName} `;
    const body = {
      id: data.questionnaireId,
    };
    this.generalService.commonDelete(apiUrl, title, body).pipe(takeUntil(this.destroy$)).subscribe({
      next: (data) => {
        console.log('Deleted data:', data);
        this.dynamicTable.fetchData();
      },
      error: (err) => {
        console.error('Delete failed:', err);
      },
    });
  };

}
