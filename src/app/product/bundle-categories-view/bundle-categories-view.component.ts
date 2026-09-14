import { ChangeDetectionStrategy, ChangeDetectorRef, Component } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { Location } from '@angular/common';
import { Subject, takeUntil } from 'rxjs';
import { GeneralService } from 'app/shared/services/general.service';
import { TitleService } from 'app/shared/services/title.service';

@Component({
  selector: 'app-bundle-categories-view',
  templateUrl: './bundle-categories-view.component.html',
  styleUrl: './bundle-categories-view.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class BundleCategoriesViewComponent {
  private destroy$ = new Subject<void>();
  bundleId: number = 0;
  bundleName: string = '';
  isLoading = true;
  hasError = false;

  categories: Array<{ categoryId: number; categoryName: string }> = [];

  constructor(
    private route: Router,
    private router: ActivatedRoute,
    private _location: Location,
    private generalService: GeneralService,
    private titleService: TitleService,
    private cdr: ChangeDetectorRef
  ) {
    const id = this.router.snapshot.paramMap.get('id');
    this.bundleId = id ? Number(id) : 0;
  }

  ngOnInit(): void {
    if (!this.bundleId) {
      this.hasError = true;
      this.isLoading = false;
      this.cdr.detectChanges();
      return;
    }
    this.loadBundleCategories();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  loadBundleCategories(): void {
    this.isLoading = true;
    this.hasError = false;
    this.generalService
      .commonGet(`Products/GetBundleByIdNew?id=${this.bundleId}`)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (res: any) => {
          this.isLoading = false;
          if (res?.status === 1 && res?.data) {
            const d = res.data;
            this.bundleName = d.name ?? 'Package';
            this.titleService.updateTitle('Categories assigned to package', [
              { label: 'Packages', path: '/product/view/Bundles' },
              { label: this.bundleName, path: `/product/bundle/${this.bundleId}` },
              { label: 'Categories', path: `/product/bundle/${this.bundleId}/categories` }
            ]);
            if (d.categoryId != null && d.categoryName) {
              this.categories = [{ categoryId: d.categoryId, categoryName: d.categoryName }];
            } else {
              this.categories = [];
            }
          } else {
            this.hasError = true;
            this.categories = [];
          }
          this.cdr.detectChanges();
        },
        error: () => {
          this.isLoading = false;
          this.hasError = true;
          this.categories = [];
          this.cdr.detectChanges();
        }
      });
  }

  goBack(): void {
    this._location.back();
  }

  goToPackage(): void {
    this.route.navigate(['product', 'bundle', this.bundleId]);
  }
}
