import { ChangeDetectionStrategy, ChangeDetectorRef, Component, OnInit  } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { catchError, forkJoin, lastValueFrom, map, Observable, of, Subject, takeUntil,  throwError } from 'rxjs';
import { GeneralService } from 'app/shared/services/general.service';
import { ValidationService  } from 'app/shared/Validation/validation.service';
import { BrandingService } from 'app/branding/branding.service';
import { AuthService } from 'app/shared/Auth/auth.service';

interface drugList{
  productId: number
  productName: string
  productType: string
  categoryId: number
  categoryName: string
  drugType: string
  price: number
  quantity: number
  quantityUnit: string
  refills: number
  dose: string
  dosage: string
  strenght: string
  shippingFrequency: string
  billingFrequency: string
  regularImageURL: string
}

interface ScheduleSlot {
  providerScheduledSlotId: number;
  slotDate: string;
  startTime: Date;
  endTime: Date;
  duration: number;
  providerId: number;
  providerName: string;
}

interface Provider {
  provider_guid: string;
  first_name: string;
  last_name: string;
  user_avatar: string | null;
}

interface ScheduleSlot {
  start_datetime: Date;
  end_datetime: Date;
  start_datetime_OLA: string | Date;
  end_datetime_OLA: string | Date;
  provider_guid: string;
  provider_details: Provider;
}

@Component({
  selector: 'app-visit',
  templateUrl: './visit.component.html',
  styleUrls: ['./visit.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush
})

export class VisitComponent implements OnInit  {

  sider_steps: Array<{title:string,icon:string,description:string, component:string, isVisible:boolean}> = [];

  currentStep: number = 0;
  progressPercent: number = 0;

  selectedCategory: number = 0;

  basicInfoForm!: FormGroup;
  loginForm!: FormGroup;
  isLoginFormSubmitting: boolean = false;
  isModalVisible: boolean = false;
  isLoginModalVisible: boolean = false;

  intakeFormJson: any = '';
  intakeFormData: any = {
    userSelections: null,
    visitedFields: null
  };
  paymentData: any = null;
  providerApt: ScheduleSlot | null = null;
  selectedSub: drugList | null = null;

  stateList : any = null;
  cityList : any[] = [];
  facilityId!: string;
  productName!: string;
  patientId: Number = 0;
  isDarkMode: boolean = false;
  private destroy$ = new Subject<void>();
  isSubmitting: boolean = false;
  loadingBranding: boolean = true;

  constructor(
    private route: ActivatedRoute,
    private fb: FormBuilder,
    private router: Router,
    private validationService: ValidationService,
    private generalService: GeneralService,
    private brandService: BrandingService,
    private auth: AuthService,
    private cdr: ChangeDetectorRef
  ) {

    this.route.params.pipe(takeUntil(this.destroy$)).subscribe((params) => {
      this.facilityId = params['facilityId'];
      this.productName = params['productName'];
    });

    this.brandService.getBranding(true, this.facilityId)
    .pipe(takeUntil(this.destroy$))
    .subscribe({
      next: () => {
        this.loadingBranding = false;
        console.log('Branding initialized successfully');
        this.cdr.markForCheck();
      },
      error: (err) => {
        this.loadingBranding = false;
        console.error('Failed to initialize branding', err);
        this.cdr.markForCheck();
      }
    });

    this.basicInfoForm = this.fb.group({
      firstName: ['', Validators.required],
      lastName: ['', Validators.required],
      email: ['', Validators.required],
      gender: ['', Validators.required],
      dob: ['', Validators.required],
      phone: ['', Validators.required],
      address: ['', Validators.required],
      street: [''],
      cityId: ['', Validators.required],
      stateId: ['', Validators.required],
      zipcode: ['', Validators.required],
      termCondition: [false, Validators.required]
    });

    this.loginForm = this.fb.group({
      email: ['', Validators.required],
      password: ['', Validators.required],
    })
  }

  disableFutureDates = (current: Date): boolean => {
    return current > new Date();
  };

  ngOnInit(): void {

    if(this.productName){
      this.loadProductData();
    }else{
      this.loadDemoData();
    }

    if(this.facilityId){
      this.loadCities();
    }

    this.validationService.applyGlobalValidators(this.basicInfoForm);
  }

  loadProductData(): void {
    this.generalService.commonGet(`UnAuthorize/getProductInfoByName?ProductName=${this.productName}&FacilityGuid=${this.facilityId}`).pipe(takeUntil(this.destroy$)).subscribe({
      next: (response) => {
        if (response?.data) {
          this.selectedSub = response?.data;
          this.selectedCategory = response?.data.categoryId;
          this.loadIntakeFormData();
          this.loadDemoData('subscription');
        } else {
          this.selectedSub = null;
          this.loadDemoData();
        }
      },
      error: (error) => {
        console.error('Error in subscription:', error);
      }
    });
  }

  loadDemoData(title: string = ''): void {
    this.sider_steps = [
      { title: 'Subscription', icon: 'credit-card', description: 'Select Your Plan', component: "subscription", isVisible: true },
      { title: 'Basic Info', icon: 'user', description: 'Enter Basic Details', component: "basicForm", isVisible: true },
      { title: 'Provider', icon: 'team', description: 'Healthcare Provider Info', component: "provider", isVisible: true },
      { title: 'Questionnaire', icon: 'file-text', description: 'Provide Initial Information' ,component: "intakeForm", isVisible: true },
      { title: 'Payment', icon: 'wallet', description: '', component: "payment", isVisible: true }
    ];

    if(title === 'subscription'){
      const isSyncSubscription = this.selectedSub?.drugType === 'Sync';
      if(isSyncSubscription){
        this.sider_steps = this.sider_steps.filter(item => item.component !== 'provider')
      }else{
        const hasProvider = this.sider_steps.some(item => item.component === 'provider');
        if (!hasProvider) {
          this.sider_steps.push({ title: "Provider",icon:"",description: "Healthcare Provider Info", component: "provider", isVisible: true });
        }
      }
      this.currentStep = 1;
      this.updateProgress();
    }
  }

  onIndexChange(index: number): void {
    this.currentStep = index;
    console.log('Step changed to:', this.sider_steps[index]?.component);
  }

  getPatientData() : void{
    this.generalService.commonGet(`Patients/getPatientById?Id=${this.patientId}`).pipe(takeUntil(this.destroy$)).subscribe({
      next: (response) => {
        if (!response?.data) return;
        this.paymentData = {
          addressLine1: response?.data.address,
          street: response?.data.street,
          city: response?.data.cityId,
          state: response?.data.stateId,
          zipCode: response?.data.zipcode
        }
      },
      error: (error) => {
        console.error('Error in subscription:', error);
      }
    });
  }

  onSubmit(): void {
    if (this.basicInfoForm.valid) {
      this.paymentData = {
        addressLine1: this.basicInfoForm.value.address,
        street: this.basicInfoForm.value.street,
        city: this.basicInfoForm.value.cityId,
        state: this.basicInfoForm.value.stateId,
        zipCode: this.basicInfoForm.value.zipcode
      }
      const formData = {
        ...this.basicInfoForm.value,
        facilityGuid: this.facilityId,
        patientId: this.patientId || 0
      };
      this.generalService.commonPost(`UnAuthorize/savePatient`, formData).pipe(takeUntil(this.destroy$)).subscribe({
        next: (response) => {
          if(response.status === 1 && response?.data > 0){
            this.patientId = response.data
            this.generalService.showSuccess(response.message);
            this.goToNextStep();
            return;
          }
          this.generalService.showError(response.message);
        },
        error: (err) => {
          this.generalService.showError(err.message);
        }
      });
    } else {
      Object.keys(this.basicInfoForm.controls).forEach(field => {
        const control = this.basicInfoForm.get(field);
        if(control){
          control.markAsTouched({ onlySelf: true });
          control.updateValueAndValidity();
        }
      });
      this.generalService.showError(`Fill all the required fields`);
    }
  }

  loadIntakeFormData(): void {
    if (!this.selectedSub) return;
    this.generalService.commonGet(`UnAuthorize/getQuestionnaireJsonById?ProductId=${this.selectedSub.productId}`).pipe(takeUntil(this.destroy$)).subscribe({
      next: (response) => {
        if (!response?.data.questionnaireJson) {
          this.intakeFormJson = null;
          this.generalService.showError('No Questionainer found on this drug');
          return;
        }
        this.intakeFormJson = JSON.parse(response.data.questionnaireJson);
      },
      error: (error) => {
        console.error('Error in subscription:', error);
      }
    });
  }

  updateProgress() {
    const visibleSteps = this.sider_steps.filter(step => step.isVisible).length;
    this.progressPercent = (this.currentStep / visibleSteps) * 1;
    this.cdr.markForCheck();
  }

  getCurrentStepComponent(): string {
    return this.sider_steps[this.currentStep]?.component || '';
  }

  goToNextStep(data?: any, type?: string): void {
    if (type === 'intakeForm') {
      this.intakeFormData = {
        userSelections: data.userSelections,
        visitedFields: data.visitedFields
      };
    } else if (type === 'subscription') {

      this.selectedSub = data.selectedPlan;
      this.selectedCategory = data.selectedPlan.categoryId
      this.loadIntakeFormData();
      const isSyncSubscription = this.selectedSub?.drugType === 'Sync';

      if(isSyncSubscription){
        this.sider_steps = this.sider_steps.filter(item => item.component !== 'provider')
      }else{
        const hasProvider = this.sider_steps.some(item => item.component === 'provider');
        if (!hasProvider) {
          this.sider_steps.push({ title: "Provider",icon:"",description: "Healthcare Provider Info", component: "provider", isVisible: true });
        }
      }

    } else if (type === 'payment') {
      this.paymentData = data.paymentForm;
    } else if (type === 'provider') {
      console.log('data')
      this.providerApt = data.providerApt;
    }

    if (this.currentStep < this.sider_steps.length - 1) {
      this.currentStep++;
      this.updateProgress();
    } else {
      this.finalSubmission();
      return;
    }
  }

  goToPreviousStep(data?:any, type?:string): void {

    if(type === 'intakeForm'){
      this.intakeFormData = {
        userSelections: data.userSelections,
        visitedFields: data.visitedFields
      };
    }else if(type === 'subscription'){
      this.selectedSub = data.selectedPlan;
    }else if(type=== 'payment'){
      this.paymentData = data.paymentForm;
    }else if(type=== 'provider'){
      this.providerApt = data.providerApt;
    }

    if (this.currentStep > 0) {
      this.currentStep--;
      this.updateProgress();
    }
  }

  formatIntakeData(): Observable<{
    intakeFormData: { question_text: string; answer: string; other_text?: string; type: string }[];
    fileDetailsMap: { [key: string]: any[] };
  }> {
    const parsedData = this.intakeFormJson;
    return of(parsedData).pipe(
      map((data: any) => {
        const intakeFormData: { question_text: string; answer: string; other_text?: string; type: string }[] = [];
        const fileDetailsMap: { [key: string]: any[] } = {};
        const allFields = data.fields;

        const getQuestionByKey = (key: string, returnType: 'label' | 'type'): string => {
          const question = allFields?.find((q: any) => q.id === key);
          return question ? (returnType === 'label' ? question.label : question.type) : 'text';
        };

        const getOptionLabelByKey = (key: string, value: any): string | null => {
          const question = allFields?.find((q: any) => q.id === key);
          return question?.options?.find((opt: any) => opt.value === value)?.label || null;
        };

        const otherTextMap: { [key: string]: string } = {};
        for (const [key, value] of Object.entries(this.intakeFormData.userSelections || {})) {
          if (key.endsWith('_other_text')) {
            const originalKey = key.replace('_other_text', '');
            otherTextMap[originalKey] = String(value);
          }
        }
        for (const [key, value] of Object.entries(this.intakeFormData.userSelections || {})) {
          if (!key.endsWith('_other_text')) {
            const type = getQuestionByKey(key, 'type');
            const question_text = getQuestionByKey(key, 'label');
            let answer: string = '';
            let other_text: string | undefined;
            if (type === 'file') {
              if (Array.isArray(value) && value.length > 0 && value.every(file => file?.name && file?.type)) {
                fileDetailsMap[question_text] = value;
                answer = value.map((file: any) => file.name).join(', ');
              } else {
                answer = 'No files uploaded';
              }
            }
            else {
              if (Array.isArray(value)) {
                answer = value.map(v => getOptionLabelByKey(key, v) || String(v)).join(', ');
              } else if (typeof value === 'string') {
                answer = getOptionLabelByKey(key, value) || value;
              } else if (typeof value === 'object' && value !== null) {
                const trueValues = Object.entries(value)
                  .filter(([_, subValue]) => subValue === true)
                  .map(([subKey]) => subKey);
                answer = trueValues.length > 0
                  ? trueValues.map(subKey => getQuestionByKey(subKey, 'label')).join(', ')
                  : 'None';
              } else {
                answer = String(value);
              }
            }

            if (otherTextMap[key]) other_text = otherTextMap[key];

            if (question_text) {
              intakeFormData.push({
                question_text,
                answer,
                ...(other_text && { other_text }),
                type
              });
            }
          }
        }

        return { intakeFormData, fileDetailsMap };
      })
    );
  }

  async finalSubmission() {
    try {
      this.isSubmitting = true;
      const { intakeFormData, fileDetailsMap } = await lastValueFrom(
        this.formatIntakeData().pipe(
          catchError(error => {
            throw new Error(`Failed to format intake data: ${error.message}`);
          })
        )
      );

      const uploadRequests = this.createUploadRequests(fileDetailsMap);
      const uploadResponses = await this.handleFileUploads(uploadRequests);
      this.updateIntakeDataWithUrls(intakeFormData, uploadResponses);

      const treatmentPayload = this.createTreatmentPayload(intakeFormData);
      const treatmentResponse = await this.submitTreatmentData(treatmentPayload);

      console.log('treatmentPayload', treatmentPayload)

      const paymentPayload = this.createPaymentPayload(treatmentResponse.data);
      await this.submitPaymentData(paymentPayload);

      this.generalService.showSuccess('Submission completed successfully!');
      this.router.navigate(['/thankyou']);
    } catch (error) {
      this.handleSubmissionError(error);
    } finally {
      this.isSubmitting = false;
    }
  }

  private createUploadRequests(fileDetailsMap: any): Observable<any>[] {
    return Object.entries(fileDetailsMap).reduce((requests, [questionText, files]) => {
      if (Array.isArray(files)) {
        files.forEach((file: any) => {
          if (file.originFileObj) {
            const formData = new FormData();
            formData.append('file', file.originFileObj);

            requests.push(
              this.generalService.commonPost(`Commons/UploadFile`, formData).pipe(
                map((response: any) => ({
                  questionText,
                  fileName: response.fileName,
                  fileUrl: response.fileUrl
                })),
                catchError(error => throwError(() =>
                  new Error(`File upload failed for ${file.name}: ${error.message}`)
                ))
              )
            );
          }
        });
      }
      return requests;
    }, [] as Observable<any>[]);
  }

  private async handleFileUploads(uploadRequests: Observable<any>[]): Promise<any[]> {
    if (uploadRequests.length === 0) return [];

    try {
      return await lastValueFrom(forkJoin(uploadRequests));
    } catch (error) {
      throw new Error(`File uploads failed: ${this.getErrorMessage(error)}`);
    }
  }

  private updateIntakeDataWithUrls(intakeFormData: any[], uploadResponses: any[]): void {
    const groupedUrls = uploadResponses.reduce((acc, { questionText, fileUrl }) => {
      acc[questionText] = [...(acc[questionText] || []), fileUrl];
      return acc;
    }, {});

    Object.entries(groupedUrls).forEach(([questionText, urls]) => {
      const entry = intakeFormData.find(item =>
        item.question_text === questionText && item.type === 'file'
      );

      const urlString = (urls as string[]).join(', ');
      entry ? (entry.answer = urlString) : intakeFormData.push({
        question_text: questionText,
        answer: urlString,
        type: 'file',
        other_text: ''
      });
    });
  }

  private createTreatmentPayload(intakeFormData: any[]): any {
    if (!this.facilityId || !this.patientId) {
      throw new Error('Missing required facility or patient information');
    }

    return {
      patientTreatmentId: 0,
      facilityGuid: this.facilityId,
      patientId: this.patientId,
      productId: this.selectedSub?.productId || 0,
      inTakeForm: intakeFormData.map(item => ({
        question: item.question_text,
        answer: item.answer,
        otherText: item.other_text || '',
        type: item.type
      })),
      providerScheduledSlotId: this.providerApt?.providerScheduledSlotId || 0
    };
  }

  private async submitTreatmentData(payload: any): Promise<any> {
    try {
      const response = await lastValueFrom(
        this.generalService.commonPost('UnAuthorize/savePatientTreatment', payload)
      );

      if (!response?.data) {
        throw new Error('Invalid treatment response format');
      }

      return response;
    } catch (error) {
      throw new Error(`Treatment submission failed: ${this.getErrorMessage(error)}`);
    }
  }

  private createPaymentPayload(patientTreatmentId: number): any {
    if (!this.paymentData) {
      throw new Error('Missing payment information');
    }

    return {
      patientPaymentId: 0,
      facilityGuid: this.facilityId,
      patientId: this.patientId,
      productId: this.selectedSub?.productId || 0,
      patientTreatmentId: patientTreatmentId,
      totalPrice: this.selectedSub?.price || 0,
      couponCode: this.paymentData.couponCode,
      discountPrice: 0,
      shipmentAddress: this.paymentData.addressLine1,
      shipmentStreet: this.paymentData.street,
      shipmentCityId: this.paymentData.city,
      shipmentStateId: this.paymentData.state,
      shipmentZipCode: this.paymentData.zipCode,
      cardNumber: this.paymentData.cardNumber,
      cvc: this.paymentData.cvc,
      expirationDate: this.formatExpirationDate(this.paymentData.expiryDate)
    };
  }

  private async submitPaymentData(payload: any): Promise<void> {
    try {
      await lastValueFrom(
        this.generalService.commonPost('UnAuthorize/savePatientPayment', payload)
      );
    } catch (error) {
      throw new Error(`Payment submission failed: ${this.getErrorMessage(error)}`);
    }
  }

  private formatExpirationDate(dateString: string): string {
    if (!dateString) return '';
    const date = new Date(dateString);
    return isNaN(date.getTime()) ? '' : date.toISOString();
  }

  private getErrorMessage(error: any): string {
    return error?.error?.message || error?.message || 'Unknown error occurred';
  }

  private handleSubmissionError(error: unknown): void {
    const errorMessage = error instanceof Error
      ? error.message
      : 'An unexpected error occurred during submission';

    console.error('Submission error:', error);
    this.generalService.showError(`Submission failed: ${errorMessage}`)
  }

  handleLoginOk(): void {
    this.isLoginFormSubmitting = true;
    if(this.loginForm.invalid){
      this.loginForm.markAllAsTouched();
      this.generalService.showError( `Fill all the required fields`);
    this.isLoginFormSubmitting = false;
      return;
    }
    const { email, password } = this.loginForm.value;
    this.auth.login(email, password)
    .pipe(takeUntil(this.destroy$))
    .subscribe({
      next: (res) => {
        if(res.status !== 1){
          this.generalService.showError(res.message);
          this.isLoginFormSubmitting = false;
          this.isLoginModalVisible = false;
          return;
        }
        this.generalService.showSuccess(res.message);
        this.basicInfoForm.patchValue({
          ...res.data,
          zipcode: res.data.zipCode,
          termCondition: true
        });
        this.patientId = res.data.userId;
        this.paymentData = {
          addressLine1: res.data.address,
          street: res.data?.street || '',
          city: res.data.cityId,
          state: res.data.stateId,
          zipCode: res.data.zipCode
        }
        this.isLoginFormSubmitting = false;
        this.isLoginModalVisible = false;
        this.loginForm.reset();
        if(this.currentStep === 1)this.goToNextStep();
      },
      error: (err) => {
        this.isLoginFormSubmitting = false;
        const errorMessage = err?.message || 'Login failed. Please try again.';
        this.generalService.showError(errorMessage);
      }
    });
  }

  loadCities(): void {
    this.generalService.getAllCities().pipe(takeUntil(this.destroy$)).subscribe((cities) => {
      this.cityList = cities;
    });
  }

  loadStateById(cityId: number): void {
    this.generalService.getStateByCityId(cityId).pipe(takeUntil(this.destroy$)).subscribe((state) => {
      this.basicInfoForm.get('stateId')?.setValue(null);
      this.stateList = state;
    });
  }

  toggleDarkMode() {
    this.isDarkMode = !this.isDarkMode;
    if (this.isDarkMode) {
      document.documentElement.classList.add('dark');
      localStorage.setItem('theme', 'dark');
    } else {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('theme', 'light');
    }
  }

   ngOnDestroy(): void{
    this.destroy$.next();
    this.destroy$.complete();
  }

}
