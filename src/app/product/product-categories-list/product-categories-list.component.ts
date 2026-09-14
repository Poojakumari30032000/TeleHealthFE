import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  OnDestroy,
  OnInit,
  ViewChild,
} from '@angular/core';
import { GeneralService } from 'app/shared/services/general.service';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import { CommanFormModalComponent } from 'app/shared/comman-form-modal/comman-form-modal.component';
import { AuthService } from 'app/shared/Auth/auth.service';
import { NzTableQueryParams } from 'ng-zorro-antd/table';
import { PermissionsService } from 'app/shared/permission/permissions.service';

export interface ProductCategory {
  categoryId: number;
  categoryName: string;
  categoryDescription: string;
  imageURL: string;
}

@Component({
  selector: 'app-product-categories-list',
  templateUrl: './product-categories-list.component.html',
  styleUrl: './product-categories-list.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ProductCategoriesListComponent implements OnInit, OnDestroy {
  @ViewChild('commanModel', { static: false }) commanModel!: CommanFormModalComponent;

  modalApiUrl: { save?: string; get?: string } = {
    save: 'ProductCategories/saveCategory',
    get: 'ProductCategories/getCategoryById?Id=',
  };

  appliedFilters: Array<{ name: string; value: any }> = [];

  userRole: string | null = null;
  facilityId: any = null;
  canEditCategory = false;

  loading = false;
  categories: ProductCategory[] = [];
  total = 0;
  pageIndex = 1;
  pageSize = 100;

  private destroy$ = new Subject<void>();

  constructor(
    private generalService: GeneralService,
    private auth: AuthService,
    private cdr: ChangeDetectorRef,
    private permissions: PermissionsService
  ) {}

  ngOnInit(): void {
    this.userRole = this.auth.getUserRole();
    this.canEditCategory = this.permissions.hasAnyPermission(['product_category_edit']);

    if (this.userRole === 'Clinic Admin') {
      this.facilityId = this.auth.getUserFacilityId();
    }

    this.applyFilter(true);
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  applyFilter(resetPage = true): void {
    if (resetPage) {
      this.pageIndex = 1;
    }

    this.appliedFilters = [
      ...(this.userRole === 'Clinic Admin' && this.facilityId ? [{ name: 'FacilityId', value: this.facilityId }] : []),
    ].filter((f) => f.value !== null && f.value !== undefined && f.value !== '');

    this.fetchCategories();
  }

  onQueryParamsChange(params: NzTableQueryParams): void {
    const { pageIndex, pageSize } = params;
    const pageChanged = pageIndex !== this.pageIndex;
    const sizeChanged = pageSize !== this.pageSize;

    this.pageIndex = pageIndex;
    this.pageSize = pageSize;

    if (pageChanged || sizeChanged) {
      this.fetchCategories();
    }
  }

  private buildQueryString(): string {
    const parts: string[] = [];
    parts.push(`PageNumber=${encodeURIComponent(String(this.pageIndex))}`);
    parts.push(`PageSize=${encodeURIComponent(String(this.pageSize))}`);

    for (const filter of this.appliedFilters) {
      parts.push(`${encodeURIComponent(filter.name)}=${encodeURIComponent(String(filter.value))}`);
    }

    return parts.join('&');
  }

  private fetchCategories(): void {
    this.loading = true;
    this.cdr.markForCheck();

    const query = this.buildQueryString();
    this.generalService
      .commonGet(`ProductCategories/getAllCategories?${query}`)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (response: any) => {
          if (response?.status === 1) {
            this.categories = Array.isArray(response?.data) ? response.data : [];
            this.total = Number(response?.totalEntityCount ?? 0);
          } else {
            this.categories = [];
            this.total = 0;
          }
          this.loading = false;
          this.cdr.markForCheck();
        },
        error: (err) => {
          console.error('Failed to load categories:', err);
          this.categories = [];
          this.total = 0;
          this.loading = false;
          this.cdr.markForCheck();
        },
      });
  }

  trackByCategoryId(_index: number, data: ProductCategory): number {
    return data.categoryId;
  }

  AddEditCategory = (data?: ProductCategory): void => {
    let title: string = 'Add Category';
    const ID = data?.categoryId || 0;
    const formPath = 'product/add-edit-product-category.json';
    if (data) {
      title = 'Update Category';
    }
    this.commanModel.showModal(title, 'form', formPath, ID);
  };

  onRowActivate(data: ProductCategory): void {
    if (!this.canEditCategory) {
      return;
    }
    this.AddEditCategory(data);
  }

  refreshAfterModal(): void {
    this.fetchCategories();
  }

}
