import { ChangeDetectionStrategy, ChangeDetectorRef, Component, ViewChild } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { Location } from "@angular/common";
import { GeneralService } from 'app/shared/services/general.service';
import { NzUploadFile } from 'ng-zorro-antd/upload';
import { Observable, Observer, Subject, takeUntil } from 'rxjs';
import { CommanFormModalComponent } from 'app/shared/comman-form-modal/comman-form-modal.component';
import { FormGroup, FormBuilder, Validators } from '@angular/forms';
import { environment } from 'environments/environment';
import { PermissionsService } from 'app/shared/permission/permissions.service';
import { TitleService } from 'app/shared/services/title.service';
import { AuthService } from 'app/shared/Auth/auth.service';
import { HttpErrorResponse } from '@angular/common/http';

interface Category {
  categoryId: number;
  categoryName: string;
}

interface Bundle {
  bundleId: number
  name: string
  categoryId: number;
  description: string
  drugId: number
  drugVarientsInBundle: DrugVarientsInBundle[]
  price: number
  comparePrice: number
  regularImageURL: string
  status: string
  createdByName: string
  visits: number
}

interface ApiResponse {
  status: number;
  message: string;
  count: number;
  data: any;
  totalEntityCount: number;
  totalPages: number;
}

interface DrugVarientsInBundle {
  drugId: number
  drugVarientBundleId: number
  name: string
  price: number
  orderCount: number
}

interface ParentDrug{
  drugId: number;
  drugName: string;
}

@Component({
  selector: 'app-product-bundle-detail-view',
  templateUrl: './product-bundle-detail-view.component.html',
  styleUrl: './product-bundle-detail-view.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ProductBundleDetailViewComponent {

  @ViewChild('commanModel', { static: false }) commanModel!: CommanFormModalComponent;
  activeTab: string = 'Products';
  modalApiUrl : { save?: string; get?: string } = {
    save : 'Products/saveDrugInBundle'
  };
  uploadloading = false;
  avatarUrl?: string;
  hasError: boolean = false;
  isLoading: boolean = false;
  bundleData: Bundle | null = null;
  bundleForm!: FormGroup;
  productId: number = 0
  parentDrugData: ParentDrug[] = [];
  uploadUrl: string = `${environment.IAMGE_PATH}/api/Commons/UploadFile`;
  private destroy$ = new Subject<void>();
  isDisabled: boolean = false;
  categories: Category[] = [];
  userRole: string = '';
  facilities: Array<{ facilityId: number; titlelong: string; titleshort: string }> = [];
  facilitiesLoading = false;

  constructor(
    private fb: FormBuilder,
    private route : Router,
    private router: ActivatedRoute,
    private cdr: ChangeDetectorRef,
    private _location: Location,
    private generalService: GeneralService,
    private permissionService: PermissionsService,
    private titleService: TitleService,
    private auth: AuthService
  ){
    this.productId = Number(this.router.snapshot.paramMap.get('id'));
  }

  ngOnInit() {
    this.isDisabled = !this.permissionService.hasAnyPermission(['product_edit']);
    this.userRole = this.auth.getUserRole() || '';
    this.fetchCategories();
    this.initForm();
    this.getBundleDetails();
    if (this.userRole === 'Global Admin') {
      this.bundleForm.get('categoryId')?.valueChanges.pipe(takeUntil(this.destroy$)).subscribe((categoryId) => {
        this.bundleForm.get('facilityIds')?.setValue(null, { emitEvent: false });
        this.fetchFacilitiesByCategoryId(categoryId ? Number(categoryId) : 0);
      });
    }
  }

  ngOnDestroy(): void{
    this.destroy$.next();
    this.destroy$.complete();
  }

  private initForm() {
    this.bundleForm = this.fb.group({
      bundleId: [0],
      name: ['', Validators.required],
      description: [''],
      categoryId: [null, Validators.required],
      drugId: [null],
      price: [0, [Validators.required, Validators.min(0)]],
      comparePrice: [0, [Validators.min(0)]],
      regularImageURL: [''],
      visits: [{ value: null, disabled: true }],
      facilityIds: [null as number[] | null],
    });

    if(this.isDisabled)this.bundleForm.disable();
  }

  fetchFacilitiesByCategoryId(categoryId: number): void {
    if (!categoryId || categoryId <= 0) {
      this.facilities = [];
      return;
    }
    this.facilitiesLoading = true;
    this.generalService.commonGet(`DropDowns/getActiveFacilitiesByCategoryId?categoryId=${categoryId}`).pipe(takeUntil(this.destroy$)).subscribe({
      next: (res: ApiResponse) => {
        const list = Array.isArray(res?.data) ? res.data : (res?.data?.items ?? res?.data?.list ?? []);
        this.facilities = (list as any[]).map((x: any) => ({
          facilityId: Number(x?.facilityId ?? 0),
          titlelong: String(x?.titlelong ?? ''),
          titleshort: String(x?.titleshort ?? ''),
        })).filter(f => f.facilityId > 0);
        this.facilitiesLoading = false;
        this.cdr.detectChanges();
      },
      error: () => {
        this.facilities = [];
        this.facilitiesLoading = false;
        this.cdr.detectChanges();
      },
    });
  }

    fetchCategories(): void {
      this.generalService.commonGet(`DropDowns/getAllCategories`).pipe(takeUntil(this.destroy$)).subscribe({
        next: (response: ApiResponse) => {
          if (response?.status === 1 && response?.data) {
            this.categories = response?.data || [];
            this.cdr.detectChanges();
          } else {
            this.categories = [];
            this.cdr.detectChanges();
          }
        },
        error: (err: HttpErrorResponse) => {
          console.error('Failed to fetch categories:', err);
          this.categories = [];
          this.cdr.detectChanges();
        }
      });
    }

    trackByCategoryId(_index: number, category: Category): number {
    return category.categoryId;
  }

  getBundleDetails(): void {
    if(!this.productId) return;
    this.isLoading = true;
    const apiUrl = `Products/GetBundleByIdNew?id=${this.productId}`;
    this.generalService.commonGet(apiUrl).pipe(takeUntil(this.destroy$)).subscribe({
      next: (response) => {
        if (response.status === 1 && response.data) {
          this.bundleData = response.data;

          this.bundleForm.patchValue({
            bundleId: response.data.bundleId,
            name: response.data.name,
            description: response.data.description,
            drugId: response.data.drugId,
            categoryId: response.data.categoryId || null,
            price: response.data.price,
            comparePrice: response.data.comparePrice,
            regularImageURL: response.data.regularImageURL,
            visits: response.data.visits,
            facilityIds: Array.isArray(response.data.facilityIds) ? response.data.facilityIds : null,
          });
          this.avatarUrl = response.data.regularImageURL;
          if (this.userRole === 'Global Admin' && response.data.categoryId) {
            this.fetchFacilitiesByCategoryId(Number(response.data.categoryId));
          }

          this.titleService.updateTitle(
            this.bundleData?.name || 'Bundle',
            [
              { label: 'Packages', path: '/product/view/Bundles' },
              { label: 'Package Details', path: `/product/bundle/${this.productId}` }
            ]
          );
          this.isLoading = false;
          this.cdr.detectChanges();
          return;
        }
        this.isLoading = false;
        this.hasError = true;
        this.generalService.showError(response.message);
        this.titleService.updateTitle(
          'Error'
        );
        this.cdr.detectChanges();
      },
      error: (error) => {
        this.hasError = true;
        this.isLoading = false;
        this.generalService.showError(error.message);
        this.titleService.updateTitle(
          'Error'
        );
        this.cdr.detectChanges();
      }
    });
  }

  saveBundle(): void {
    if (this.bundleForm.invalid) {
      this.generalService.showError('Fill all the required fields');
      this.markFormControlsAsTouched();
      return;
    }

    const apiUrl = 'Products/saveBundle';
    const raw = this.bundleForm.getRawValue();
    const facilityIds = Array.isArray(raw.facilityIds) && raw.facilityIds.length
      ? raw.facilityIds.map((id: any) => Number(id)).filter((id: number) => id > 0)
      : null;
    const formData: any = {
      ...raw,
      drugVarientsInBundle: this.bundleData?.drugVarientsInBundle || [],
    };
    if (facilityIds && facilityIds.length > 0) {
      formData.facilityIds = facilityIds;
      formData.facilityId = null;
    } else {
      formData.facilityIds = null;
      formData.facilityId = this.userRole === 'Clinic Admin'
        ? Number(this.auth.getUserFacilityId() || 0)
        : Number(localStorage.getItem('FOS') || 0);
    }

    this.generalService.commonPost(apiUrl, formData).pipe(takeUntil(this.destroy$)).subscribe({
      next: (response) => {
        if(response.status === 1 && response.data){
          this.generalService.showSuccess(response.message);
          this.getBundleDetails();
          return;
        }
        this.generalService.showError(response.message);
      },
      error: (error) => {
        this.generalService.showError(error.message);
      }
    });
  }

  private markFormControlsAsTouched() {
    Object.values(this.bundleForm.controls).forEach(control => {
      if (control.invalid) {
        control.markAsDirty();
        control.updateValueAndValidity({ onlySelf: true });
      }
    });
  }

  getParentDrugs(){
    if(!this.bundleData) return;
    this.generalService.commonGet(`Products/getAllDrugsInBundles?Id=${this.bundleData.bundleId}`).pipe(takeUntil(this.destroy$)).subscribe({
      next: (response) => {
        if (response.status === 1 && response.data) {
          this.parentDrugData = response.data;

          this.isLoading = false;
          this.cdr.detectChanges();
          return;
        }
        this.isLoading = false;
        this.generalService.showError(response.message);
        this.cdr.detectChanges();
      },
      error: (error) => {
        this.hasError = true;
        this.isLoading = false;
        this.generalService.showError(error.message);
        this.cdr.detectChanges();
      }
    });
  }

  refreshData(title: string){
    this.getBundleDetails();
    if(title === 'Connect new product'){

    }
  }

  moveBack() {
    this._location.back();
  }

  disCardChanges(){
    const title = 'Discard changes?';
    const content = 'You will lose all unsaved changes.';
    this.generalService.commonConfirm(title, content).pipe(takeUntil(this.destroy$)).subscribe((result) => {
      if (result) {
        this.route.navigate(['product/view'])
      }
    });
  }

  connectProduct(){
    let title : string = 'Connect new product';
    const ID =  this.bundleData?.bundleId || 0
    const formPath = 'product/connect-new-product-form.json';
    this.commanModel.showModal(title, 'form', formPath, ID)
  }

  beforeUpload = (file: NzUploadFile, _fileList: NzUploadFile[]): Observable<boolean> =>
    new Observable((observer: Observer<boolean>) => {
      const isImage = file.type?.startsWith('image/');
      if (!isImage) {
        this.generalService.showError('You can only upload image files!');
        observer.complete();
        return;
      }

      const isLt2M = file.size! / 1024 / 1024 < 2;
      if (!isLt2M) {
        this.generalService.showError('Image must be smaller than 2MB!');
        observer.complete();
        return;
      }

      observer.next(isImage && isLt2M);
      observer.complete();
    });

  handleChange(info: { file: NzUploadFile }): void {
    switch (info.file.status) {
      case 'uploading':
        this.uploadloading = true;
        this.cdr.detectChanges();
        break;
      case 'done':
        const fileUrl = info.file.response?.fileDetails?.filePath;
        if(!fileUrl){
          this.generalService.showError('Something went wrong while trying to upload file')
          return;
        }
        this.bundleForm.value.regularImageURL = fileUrl;
        this.uploadloading = false;
        this.cdr.detectChanges();
        break;
      case 'error':
        this.generalService.showError('Network error');
        this.uploadloading = false;
        this.cdr.detectChanges();
        break;
    }
  }

  editVariant = (data: DrugVarientsInBundle): void => {
    console.log('data DrugVarientsInBundle', data);
    let title : string = 'Edit Variant';
    const ID =  data.drugVarientBundleId || 0
    const formPath = 'product/edit-variant-bundle-form.json';
    const editData = {
      price: data.price,
      orderCount: data.orderCount,
      drugVarientBundleId : ID
    }
    this.commanModel.showModal(title, 'form', formPath, ID, 0, 0, editData)
  }

  onDelete = (data: DrugVarientsInBundle): void => {
    const apiUrl = 'Products/deleteDrugVarientFromBundle';
    const title = 'Connected Product';
    const body = {
      id : data.drugId
    }
    this.generalService.commonDelete(apiUrl, title ,body).pipe(takeUntil(this.destroy$)).subscribe({
      next: (data) => {
        console.log('Deleted data:', data);
        this.getBundleDetails();

      },
      error: (err) => {
        console.error('Delete failed:', err);
      }
    });
  }

}
