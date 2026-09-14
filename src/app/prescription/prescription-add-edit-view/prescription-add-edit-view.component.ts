import { ChangeDetectionStrategy, ChangeDetectorRef, Component, OnDestroy, OnInit} from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { Location } from "@angular/common";
import { FormGroup, FormBuilder, Validators } from '@angular/forms';
import { GeneralService } from 'app/shared/services/general.service';
import { ValidationService } from 'app/shared/Validation/validation.service';
import { Subject, takeUntil } from 'rxjs';
import { CanComponentDeactivate } from 'app/shared/Guard/can-deactivate.guard';
import { TitleService } from 'app/shared/services/title.service';

interface Prescription {
  patientPrescriptionId: number
  patientPrescriptionGuid: string
  facilityGuid: string
  patientId: number
  patientName: string
  patientTreatmentId: number
  patientTreamentGuid: string
  patientOrderId: number
  patientOrderGuid: string
  productId: number
  productName: number
  productType: string
  prescriptionInstruction: string
  prescriptionStatus: string
}

interface PreviousPrescription {
  prescriptionId: number
  prescriptionInstruction: string
  name: string
  pharmacyName: string
  writtenDate: string
  visitStatus: string
  productVarient: string
  drugName: string
  orderDate: string
  orderStatus: string
  createdBy: string
  lastEditedDate: string
}

@Component({
  selector: 'app-prescription-add-edit-view',
  templateUrl: './prescription-add-edit-view.component.html',
  styleUrl: './prescription-add-edit-view.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class PrescriptionAddEditViewComponent implements OnInit , CanComponentDeactivate , OnDestroy  {

   prescriptionId: number = 0;
   prescriptionForm!: FormGroup;
   hasError: boolean = false;
   isLoading: boolean = false;
   prescriptionData: Prescription | null = null;
   private destroy$ = new Subject<void>();
   private valueChangesDestroy$ = new Subject<void>();
   readonly selectedOrgId: number = Number(localStorage.getItem('OFL'));
   isDirty: boolean = false;
   LoadingPrevPrescription: boolean = false;
   prevPrescriptionData: PreviousPrescription[] | null = null;
   LoadingProducts: boolean = false;
   products: Array<{productId: number, productName: string}> | null = null;
   isDrawerOpen: boolean = false;

   canDeactivate(): boolean | Promise<boolean> {
     if (this.isDirty) {
       return false;
     }
     return true;
   }

   constructor(
     private route : Router,
     private fb: FormBuilder,
     private router: ActivatedRoute,
     private cdr: ChangeDetectorRef,
     private _location: Location,
     private generalService: GeneralService,
     private validationService: ValidationService,
     private titleService: TitleService
   ){
     this.prescriptionId = Number(this.router.snapshot.paramMap.get('id') || 0);
     if(!this.prescriptionId){
       this.titleService.updateTitle(
        'Add Prescription',
        [
          { label: 'Prescription', path: '/prescription/view' },
          { label: 'Prescription Detail', path: `/prescription/add` }
        ]
      );
     }
   }

   ngOnInit(): void {
     this.initForm();
     this.getPrescriptionDetails();
   }

   ngOnDestroy(): void{
     this.destroy$.next();
     this.destroy$.complete();
     this.valueChangesDestroy$.next();
     this.valueChangesDestroy$.complete();
   }

   initForm(): void {
     this.prescriptionForm = this.fb.group({
        patientPrescriptionId: [0, Validators.required],
        facilityGuid: ['', Validators.required],
        patientId: [0, Validators.required],
        patientTreatmentId: [0, Validators.required],
        patientOrderId: [0, Validators.required],
        productId: [0, Validators.required],
        prescriptionInstruction: ['', Validators.required],
        prescriptionStatus: ['', Validators.required]
     });
     this.validationService.applyGlobalValidators(this.prescriptionForm);
     this.cdr.detectChanges();
   }

   getPrescriptionDetails(): void {
     if(!this.prescriptionId)return;

     this.isLoading = true;
     this.hasError = false;
     this.generalService.commonGet(`PatientPrescriptions/getPatientPrescriptionById?Id=${this.prescriptionId}`).pipe(takeUntil(this.destroy$)).subscribe({
       next: (response) => {
          if (response?.status === 1 && response?.data) {
            this.prescriptionData = response.data;
            this.titleService.updateTitle(
              'Update Prescription',
              [
                { label: 'Prescription', path: '/prescription/view' },
                { label: 'Prescription Detail', path: `/prescription/update/${this.prescriptionId}` }
              ]
            );
            this.populateForm(this.prescriptionData);
            this.getPatientPreviousPrescription();
            this.getProduct();
            console.log('Fetched product data:', this.prescriptionData);

            this.prescriptionForm.valueChanges.pipe(takeUntil(this.valueChangesDestroy$)).subscribe(() => {
              this.isDirty = true;
              console.log('this.isDirty', this.isDirty)
            });

          } else {
            console.error(response?.message);
            this.hasError = true;
          }
         this.isLoading = false;
         this.cdr.detectChanges();
       },
       error: (err) => {
         console.error(err);
         this.isLoading = false;
         this.hasError = true;
         this.cdr.detectChanges();
       }
     });
   }

   getPatientPreviousPrescription(): void{

    if(!this.prescriptionData)return;
    if(!this.prescriptionData.patientId || !this.prescriptionData.productId)return;

    this.LoadingPrevPrescription = false
    this.generalService.commonGet(`PatientPrescriptions/getAllPatientPrescriptionsHistory?PatientPrescriptionId=${this.prescriptionId}&PatientId=${this.prescriptionData.patientId}&ProductId=${this.prescriptionData.productId}`).pipe(takeUntil(this.destroy$)).subscribe({
      next: (response) => {
        if (response?.status === 1 && response?.data) {
          this.prevPrescriptionData = response.data;
        } else {
          console.error(response?.message);
        }
        this.LoadingPrevPrescription = false;
        this.cdr.detectChanges();
      },
      error: (err) => {
        console.error(err);
        this.LoadingPrevPrescription = false;
        this.cdr.detectChanges();
      }
    });
   }

   getProduct(): void{
    this.LoadingProducts = false
    this.generalService.commonGet(`DropDowns/getAllProducts`).pipe(takeUntil(this.destroy$)).subscribe({
      next: (response) => {
        if (response?.status === 1 && response?.data) {
          this.products = response.data;
        } else {
          console.error(response?.message);
        }
        this.LoadingProducts = false;
        this.cdr.detectChanges();
      },
      error: (err) => {
        console.error(err);
        this.LoadingProducts = false;
        this.cdr.detectChanges();
      }
    });
  }

  savePrescription() {
    if (this.prescriptionForm.invalid) {
      this.generalService.showError('Please fill all required fields.');
      Object.keys(this.prescriptionForm.controls).forEach(field => {
        const control = this.prescriptionForm.get(field);
        if(control){
          control.markAsTouched({ onlySelf: true });
          control.updateValueAndValidity();
        }
      });
      return;
    }

    this.valueChangesDestroy$.next();
    this.valueChangesDestroy$.complete();

    const apiUrl = 'PatientPrescriptions/savePatientPrescription';
    const payload = this.createPayload();

    console.log('payload', payload)

    this.generalService.commonPost(apiUrl, payload).pipe(takeUntil(this.destroy$)).subscribe({
      next: (response) => {
        if(response?.status === 1 && response.data){
          this.generalService.showSuccess(response.message);
          this.isDirty = false;
          this.moveBack();
          return;
        }
        this.generalService.showError(response.message);
      },
      error: (err) => {
        this.generalService.showError(err.message);
      }
    });
  }

  disCardChanges(){
     const title = 'Discard changes?';
     const content = 'You will lose all unsaved changes.';
     this.generalService.commonConfirm(title, content).pipe(takeUntil(this.destroy$)).subscribe((result) => {
       if (result) {
         this.isDirty = false;
         this.moveBack();
       }
     });
  }

  populateForm(data: any): void {
    this.prescriptionForm.patchValue({
     patientPrescriptionId: data.patientPrescriptionId || 0,
     facilityGuid: data.facilityGuid || '',
     patientId: data.patientId || 0,
     patientTreatmentId: data.patientTreatmentId || 0,
     patientOrderId: data.patientOrderId || 0,
     prescriptionInstruction: data.prescriptionInstruction || '',
     prescriptionStatus: data.prescriptionStatus || '',
     productId: data.productId || 0,
    });
  }

  createPayload(): any {
    return {
     patientPrescriptionId: this.prescriptionData?.patientPrescriptionId || 0,
     facilityGuid: this.prescriptionForm.value.facilityGuid,
     patientId: this.prescriptionForm.value.patientId,
     patientTreatmentId: this.prescriptionForm.value.patientTreatmentId,
     patientOrderId: this.prescriptionForm.value.patientOrderId,
     prescriptionInstruction: this.prescriptionForm.value.prescriptionInstruction,
     productId: this.prescriptionForm.value.productId
    };
  }

  moveBack() {
    this._location.back();
  }

  navigate(route: string, key: keyof Prescription) {
    if (!this.prescriptionData) return;
    const ID: number = Number(this.prescriptionData[key]) || 0;
    if (!ID) {
      this.generalService.showError(`Unable to Continue - ${key} Not Found`);
      return;
    }
    this.route.navigate([route, ID]);
  }

}
