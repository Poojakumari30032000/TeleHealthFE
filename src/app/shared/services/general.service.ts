import { Injectable } from '@angular/core';
import { NzNotificationService } from 'ng-zorro-antd/notification';
import { catchError, distinctUntilChanged, map, takeUntil } from 'rxjs/operators';
import { of, Observable, BehaviorSubject, Subject } from 'rxjs';
import { STATE_ABBREVIATIONS } from '../data/state-abbreviations';
import { NzModalRef, NzModalService } from 'ng-zorro-antd/modal';
import { HttpClient, HttpErrorResponse, HttpHeaders, HttpParams } from '@angular/common/http';
import { environment } from 'environments/environment';

interface ApiResponse {
  status: number;
  message: string;
  count: number;
  data: any;
  totalEntityCount: number;
  totalPages: number;
}

@Injectable({
  providedIn: 'root',
})
export class GeneralService {

  confirmModal?: NzModalRef;
  baseUrl: string = `${environment.PROTOCOL}://${environment.baseURL}/`;
    private destroy$ = new Subject<void>();

    get userDataString(): string | null {
      return localStorage.getItem('userData');
    }
    get userData(): any {
      const raw = this.userDataString;
      try { return raw ? JSON.parse(raw) : null; } catch { return null; }
    }
    get userID(): string {
      return this.userData?.userId ?? '';
    }
    get facilityID(): string {
      return this.userData?.facilityId ?? '';
    }
    get roleId(): string {
      return this.userData?.roleId ?? '';
    }

  constructor(
    private http: HttpClient,
    private notification: NzNotificationService,
    private modal: NzModalService,
  ) {}

  private getHeaders(): HttpHeaders {
    let headers = new HttpHeaders().set('Content-Type', 'application/json');
    if (typeof window !== 'undefined') {
      const authToken = localStorage.getItem('isolHealthToken');
      if (authToken) {
        headers = headers.set('Authorization', `Bearer ${authToken}`);

      }
    }
    return headers;
  }

  getAllCities(): Observable<any[]> {
    const cachedCities = JSON.parse(localStorage.getItem('cityList') || '[]');
    if (cachedCities.length > 0) {
      return of(cachedCities);
    }

    return this.http.get<ApiResponse>(`${this.baseUrl}Dropdowns/getAllUSCities`, { headers: this.getHeaders() }).pipe(
      catchError((error: HttpErrorResponse) => {
        console.error('Error loading cities:', error);
        this.notification.error('Failed to load cities. Please try again later.', '');
        return of({
          status: 0,
          message: error.message,
          count: 0,
          data: null,
          totalEntityCount: 0,
          totalPages: 0
        });
      }),
      map((response: ApiResponse) => {
        const cities = response?.data || [];
        localStorage.setItem('cityList', JSON.stringify(cities));
        return cities;
      })
    );
  }

  ngOnDestroy(): void{
    this.destroy$.next();
    this.destroy$.complete();
  }

  getStateByCityId(cityId: number): Observable<any> {
    const cachedStateData = JSON.parse(localStorage.getItem('stateList') || '{}');
    if (cachedStateData && cachedStateData.cityId === cityId) {
      return of(cachedStateData);
    }
    return this.http.get<ApiResponse>(`${this.baseUrl}Dropdowns/getUSStatesByCityId?Id=${cityId}`, { headers: this.getHeaders() }).pipe(
      catchError((error: HttpErrorResponse) => {
        console.error('Error loading state:', error);
        this.notification.error('Failed to load state. Please try again later.', '');
        return of({
          status: 0,
          message: error.message,
          count: 0,
          data: null,
          totalEntityCount: 0,
          totalPages: 0
        });
      }),
      map((response: ApiResponse) => {
        const stateData = response?.data || { id: 1, name: 'Alabama' };
        const abbreviation = STATE_ABBREVIATIONS[stateData.name] || 'N/A';
        const state = {
          ...stateData,
          cityId: cityId,
          shortName: abbreviation,
        };
        localStorage.setItem('stateList', JSON.stringify(state));
        return state;
      })
    );
  }

  getCitiesByStateId(stateId: number): Observable<any[]> {
    const cacheKey = `citiesByState_${stateId}`;
    const cachedCities = JSON.parse(localStorage.getItem(cacheKey) || '[]');
    if (cachedCities.length > 0) {
      return of(cachedCities);
    }

    return this.http.get<ApiResponse>(`${this.baseUrl}Dropdowns/GetCitiesByStateId?Id=${stateId}`, { headers: this.getHeaders() }).pipe(
      catchError((error: HttpErrorResponse) => {
        console.error('Error loading cities by state:', error);
        this.notification.error('Failed to load cities. Please try again later.', '');
        return of({
          status: 0,
          message: error.message,
          count: 0,
          data: [],
          totalEntityCount: 0,
          totalPages: 0
        });
      }),
      map((response: ApiResponse) => {
        const cities = response?.data || [];
        localStorage.setItem(cacheKey, JSON.stringify(cities));
        return cities;
      })
    );
  }

  getStateAbbreviations(key: string): string {
    return STATE_ABBREVIATIONS[key] || 'N/A';
  }

  getCityById(cityId: number): Observable<any | null> {
    const cachedCities = JSON.parse(localStorage.getItem('cityList') || '[]');
    const city = cachedCities.find((city: any) => city.id === cityId);
    if (city) {
      return of(city);
    }
    return this.getAllCities().pipe(
      map((cities: any[]) => {
        const fetchedCity = cities.find(city => city.id === cityId);
        return fetchedCity || null;
      })
    );
  }

  getStateById(stateId: number, cityId: number): Observable<any | null> {
    const cachedStates = JSON.parse(localStorage.getItem('stateList') || 'null');
    const state = cachedStates;
    if (state) {
      return of(state);
    }
    return this.getStateByCityId(cityId).pipe(
      map((fetchedState: any) => {
        if (fetchedState.id === stateId) {
          return fetchedState;
        }
        return null;
      })
    );
  }

  commonGet(apiUrl: string): Observable<ApiResponse | null | any> {
    return this.http.get<ApiResponse | any>(`${this.baseUrl}${apiUrl}`, { headers: this.getHeaders() }).pipe(
      catchError((error: HttpErrorResponse) => {
        console.error(`Error fetching data from ${apiUrl}:`, error);
        this.notification.error('Failed to fetch data. Please try again later.', '');
        return of({
          status: 0,
          message: error.message,
          count: 0,
          data: null,
          totalEntityCount: 0,
          totalPages: 0
        });
      }),
      map((response: ApiResponse | null) => {

        return response;
      })
    );
  }

  commonPost(apiUrl: string, body: any): Observable<ApiResponse | null | any> {
    return this.http.post<ApiResponse | any>(`${this.baseUrl}${apiUrl}`, body, { headers: this.getHeaders() }).pipe(
      catchError((error: HttpErrorResponse) => {
        console.error(`Error submitting to ${apiUrl}:`, error);
        this.notification.error(error.message || 'An error occurred', '');
        return of({
          status: 0,
          message: error.message,
          count: 0,
          data: null,
          totalEntityCount: 0,
          totalPages: 0
        });
      }),
      map((response: ApiResponse | null) => {
        if (response && response.data === null) {
          this.notification.error(response.message || 'Operation failed', '');
        }
        return response;
      })
    );
  }

  commonPut(apiUrl: string, body: any): Observable<ApiResponse | null | any> {
    return this.http.put<ApiResponse | any>(`${this.baseUrl}${apiUrl}`, body, { headers: this.getHeaders() }).pipe(
      catchError((error: HttpErrorResponse) => {
        console.error(`Error putting to ${apiUrl}:`, error);
        this.notification.error(error.message || 'An error occurred', '');
        return of({
          status: 0,
          message: error.message,
          count: 0,
          data: null,
          totalEntityCount: 0,
          totalPages: 0
        });
      }),
      map((response: ApiResponse | null) => response)
    );
  }

  commonHttpDelete(apiUrl: string): Observable<ApiResponse | null | any> {
    return this.http.delete<ApiResponse | any>(`${this.baseUrl}${apiUrl}`, { headers: this.getHeaders() }).pipe(
      catchError((error: HttpErrorResponse) => {
        console.error(`Error deleting ${apiUrl}:`, error);
        this.notification.error(error.message || 'An error occurred', '');
        return of({
          status: 0,
          message: error.message,
          count: 0,
          data: null,
          totalEntityCount: 0,
          totalPages: 0
        });
      }),
      map((response: ApiResponse | null) => response)
    );
  }

  commonDelete(apiUrl: string, title: string, body: any): Observable<any> {
    return new Observable((observer) => {
      this.confirmModal = this.modal.confirm({
        nzTitle: 'Confirmation',
        nzContent: `Are you sure you want to delete ${title}?`,
        nzCentered: true,
        nzOnOk: () => {
          this.http.post<ApiResponse | any>(`${this.baseUrl}${apiUrl}`, body, { headers: this.getHeaders() }).pipe(takeUntil(this.destroy$),
            catchError((error: HttpErrorResponse) => {
              console.error(`Error deleting ${title} from ${apiUrl}:`, error);
              this.notification.error('Failed to delete. Please try again later.', '');
              observer.error(error);
              return of({
                status: 0,
                message: error.message,
                count: 0,
                data: null,
                totalEntityCount: 0,
                totalPages: 0
              });
            })
          ).subscribe((response: ApiResponse | null) => {
            if (response?.status === 1 && response.data === true) {
              this.notification.success(`${title} deleted successfully.`, '');
              observer.next(response.data);
            } else {
              this.notification.error(`Failed to delete ${title}.`, '');
              observer.error('Deletion failed');
            }
            observer.complete();
          });
        },
        nzOnCancel: () => {
          this.notification.info(`Deletion of ${title} was cancelled.`, '');
          observer.complete();
        },
      });
    });
  }

  commonConfirm(title: string, content: string): Observable<boolean> {
    return new Observable<boolean>((observer) => {
      this.confirmModal = this.modal.confirm({
        nzTitle: title,
        nzContent: content,
        nzCentered: true,
        nzOnOk: () => {
          observer.next(true);
          observer.complete();
        },
        nzOnCancel: () => {
          observer.next(false);
          observer.complete();
        },
      });
    });
  }

  showSuccess(msg: string) {
    this.notification.success(msg, '');
  }

  showError(msg: string) {
    this.notification.error(msg, '');
  }

  showInfo(msg: string) {
    this.notification.info(msg, '');
  }

  private dataSubject = new BehaviorSubject<any>(null);

  sendData(data: any): void {
    this.dataSubject.next(data);
  }

  getData(): Observable<any> {
    return this.dataSubject.asObservable().pipe(
      distinctUntilChanged()
    );
  }

  saveCardInformation(payload:any): Observable<any>{
    return this.http.post<ApiResponse | any>(this.baseUrl + 'Payment/SaveCardPayment', payload, { headers: this.getHeaders() })
  }

getCardsByUserID(userId:any): Observable<any> {
  const params = new HttpParams().set('UserId', userId);

  return this.http.get<ApiResponse | any>(
    this.baseUrl + 'Payment/GetCardByUserId',
    {
      headers: this.getHeaders(),
      params: params
    }
  );
}

getCardsByPatientId(patietnId:any){
  const params = new HttpParams().set('PatientId',patietnId );
  return this.http.get<ApiResponse | any>(this.baseUrl + 'Payment/GetCardsByPatientId', { headers: this.getHeaders(), params: params });
}

setDefaultCard(cardId: number): Observable<any> {
  const params = new HttpParams()
    .set('userId', this.userID)
    .set('cardId', cardId);

  return this.http.post<ApiResponse | any>(
    this.baseUrl + 'Payment/SetDefaultCard',
    {},
    { headers: this.getHeaders(), params: params }
  );

}

deleteCard(cardId: number): Observable<any> {
  const params = new HttpParams()
    .set('CardId', cardId);
  return this.http.post<ApiResponse | any>(
    this.baseUrl + 'Payment/DeleteCard',
    {},
    { headers: this.getHeaders(), params: params }
  );
}

payInvoice(invoiceId: string): Observable<any> {
  const params = new HttpParams()
    .set('UserId', this.userID)
    .set('InvoiceId', invoiceId);

  return this.http.post<ApiResponse | any>(
    this.baseUrl + 'Invoices/PayInvoice',
    {},
    { headers: this.getHeaders(), params: params }
  );
}

  payManualInvoice(invoiceId: string): Observable<any> {
    const params = new HttpParams()
      .set('InvoiceId', invoiceId);

    return this.http.post<ApiResponse | any>(
      this.baseUrl + 'Invoices/PayManualInvoice',
      {},
      { headers: this.getHeaders(), params: params }
    );
  }

getCategoriesWithBundlesByFacilityId(facilityID:any){
  const params = new HttpParams().set('FacilityId', facilityID);
  return this.http.get<ApiResponse | any>(this.baseUrl + 'UnAuthorize/getCategoriesWithBundlesByFacilityId',{ params: params });
}

savePatient(payload:any){
  return this.http.post<ApiResponse | any>(this.baseUrl + 'UnAuthorize/savePatient', payload)
}

CreateCardAndPayInvoice(payload:any){
  return this.http.post<ApiResponse | any>(this.baseUrl + 'UnAuthorize/CreateCardAndPayInvoice', payload)
}

CreatePaymentAndAppointment(payload:any){
  return this.http.post<ApiResponse | any>(this.baseUrl + 'UnAuthorize/CreatePaymentAndAppointment', payload)
}

  CreatePaymentAndAppointmentWithSavedCard(payload:any){
    return this.http.post<ApiResponse | any>(this.baseUrl + 'Patients/CreatePaymentAndAppointmentWithSavedCard', payload)
  }

validateCoupon(payload:any){
  return this.http.post<ApiResponse | any>(this.baseUrl + 'Coupons/validateCoupon',payload)
}

signBaa(payload: { signerName: string; signerRole: string; signatureUrl: string }) {
  return this.http.post<ApiResponse | any>(
    this.baseUrl + 'Facilities/signBaa',
    payload,
    { headers: this.getHeaders() }
  );
}

getAllProviders(facilityIDext:any,categoryId:any){
    const params = new HttpParams().set('IsAssign', 'true')
      .set('FacilityId', facilityIDext)
      .set('CategoryId', categoryId)
  return this.http.get<ApiResponse | any>(this.baseUrl + 'UnAuthorize/getAllProviders', { params: params });
}

toLocalDateTimeNoOffset(d: Date): string {
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
  }

getProviderScheduledSlots(date: string, categoryID:number, facilityID:number,providerId:any): Observable<any> {
  const params = new HttpParams().set('CategoryId',categoryID)
    .set('Date', date)
    .set('FacilityId',facilityID)
    .set('ProviderId', providerId)
    .set('ClientCurrentTime', this.toLocalDateTimeNoOffset(new Date()))
    .set('ClientTimezoneOffsetMinutes', String(-new Date().getTimezoneOffset()));
  return this.http.get<ApiResponse | any>(this.baseUrl + 'UnAuthorize/getProviderScheduledSlots', { params: params });
}

savePatientAppointment(payload: any) {
  return this.http.post<ApiResponse | any>(this.baseUrl + 'UnAuthorize/SavePatientAppointment', payload);
}

confirmStripePaymentAndCreateAppointment(payload: {
  paymentIntentId?: string | null;
  setupIntentId?: string | null;
  facilityId: number;
  productId: number;
  providerScheduledSlotId: number;
  providerId?: number;
  patientId: number;
  userId?: number;
  couponCode?: string;
  price?: number;
  isRecurring?: boolean;
  currency?: string;
}) {
  return this.http.post<ApiResponse | any>(this.baseUrl + 'UnAuthorize/ConfirmStripePaymentAndCreateAppointment', payload);
}

  getBundlesByCategoryId(facilityID:any,categoryID:any){
    const params = new HttpParams().set('facilityId', facilityID).set('categoryId', categoryID);
    return this.http.get<ApiResponse | any>(this.baseUrl + 'UnAuthorize/getBundlesByCategoryId',{ params: params });
  }

getAllFacilitySquareCredentials(facilityIDext:any){
  const params = new HttpParams().set('FacilityId', facilityIDext);
  return this.http.get<ApiResponse | any>(this.baseUrl + 'UnAuthorize/GetAllFacilitySquareCredentialsWithoutToken', { params: params });
}

saveSquareCredentials(payload:any){
  return this.http.post<ApiResponse | any>(this.baseUrl + 'UnAuthorize/SaveFacilitySquareCredentials', payload);
}

getInvoiceById(invoiceId: number): Observable<any> {
  const params = new HttpParams().set('InvoiceId', invoiceId);
  return this.http.get<ApiResponse | any>(this.baseUrl + 'Invoices/GetInvoiceById', { headers: this.getHeaders(), params: params });
}

getAllPatientInvoicesByPatientId(){
  const params = new HttpParams().set('PatientId', this.userID);
  return this.http.get<ApiResponse | any>(this.baseUrl + 'Invoices/GetInvoicesByPatientId', { headers: this.getHeaders(), params: params });
}

getAllInvoicesByFacility(): Observable<any> {
  const params = new HttpParams().set('FaciliyId', this.facilityID);
  return this.http.get<ApiResponse | any>(this.baseUrl + 'Invoices/GetInvoicesByFacilityIds', { headers: this.getHeaders(), params: params });
}

getFacilityInvoicesForGlobalAdmin(body: {
  facilityId: number | null;
  startDate: string | null;
  endDate: string | null;
  clientTimezoneOffsetMinutes?: number | null;
  includePaid: boolean;
  includePending: boolean;
  pageNumber?: number;
  pageSize?: number;
}): Observable<ApiResponse | any> {
  return this.http.post<ApiResponse | any>(
    this.baseUrl + 'Invoices/GetFacilityInvoicesForGlobalAdmin',
    body,
    { headers: this.getHeaders() }
  );
}

  getDetailedFacilityInvoice(invoiceId: number): Observable<ApiResponse | any> {
  const params = new HttpParams().set('invoiceId', invoiceId);
  return this.http.get<ApiResponse | any>(this.baseUrl + 'Invoices/GetDetailedFacilityInvoice', { headers: this.getHeaders(), params: params });
}

getAllDrugs(catalogId?: number | null, searchTerm?: string){
    let params = new HttpParams().set('IsBundle', 'false');
    if (catalogId != null) {
      params = params.set('CatalogId', String(catalogId));
    }
    if ((searchTerm ?? '').trim()) {
      params = params.set('SearchTerm', (searchTerm ?? '').trim());
    }
    return this.http.get<ApiResponse | any>(this.baseUrl + 'DropDowns/GetAllDrugsWithData', { headers: this.getHeaders(), params });
}

getAllCustomDrugsWithData(){
    return this.http.get<ApiResponse | any>(this.baseUrl + 'DropDowns/GetAllCustomDrugsWithData?IsBundle=false', { headers: this.getHeaders()});
}

getAllDrugSupplies(catalogId?: number | null, searchTerm?: string){
    let params = new HttpParams();
    if (catalogId != null) {
      params = params.set('CatalogId', String(catalogId));
    }
    if ((searchTerm ?? '').trim()) {
      params = params.set('SearchTerm', (searchTerm ?? '').trim());
    }
    return this.http.get<ApiResponse | any>(this.baseUrl + 'DropDowns/GetAllDrugsSupplies', { headers: this.getHeaders(), params });
}

getAllCustomDrugsSupplies(){
    return this.http.get<ApiResponse | any>(this.baseUrl + 'DropDowns/GetAllCustomDrugsSupplies?IsBundle=false', { headers: this.getHeaders()});
}

uploadPrescriptionImage(payload:any){
  return this.http.put<ApiResponse | any>(this.baseUrl + 'PatientPayments/UpdatePrescriptionImage', payload, { headers: this.getHeaders() });
}

createNewPrescription(payload:any){
  return this.http.post<ApiResponse | any>(this.baseUrl + 'PatientPrescriptions/SavePatientPrescriptionByTreatment', payload, { headers: this.getHeaders() });
}

addDrugsToPrescription(payload:any){
  return this.http.post<ApiResponse | any>(this.baseUrl + 'PrescriptionMedicines/createMany', payload, { headers: this.getHeaders() });
}

getPrescriptionDrugsByID(prescriptionId: number){
  const params = new HttpParams().set('patientPrescriptionId', prescriptionId);
  return this.http.get<ApiResponse | any>(this.baseUrl + 'PrescriptionMedicines/getMedicinesByPrescriptionId', { headers: this.getHeaders(), params: params });
}

startOrderByPrescription(payload: any){

  return this.http.put<ApiResponse | any>(this.baseUrl + 'PatientOrders/startOrderByPrescription', payload, { headers: this.getHeaders() });
}

GetShippingTypes(){
  return this.http.get<ApiResponse | any>(this.baseUrl + 'empower/getShippingTypes', { headers: this.getHeaders()});
}

getPatientIntakeFormByPatientID(){
  const params = new HttpParams().set('patientId', this.userData?.patientId);
  return this.http.get<ApiResponse | any>(this.baseUrl + 'PatientTreatments/getTreatmentCategoriesByPatientId', { headers: this.getHeaders(), params: params });
}

savePatientIntakeFormByTreatmentID(payload:any){
  return this.http.post<ApiResponse | any>(this.baseUrl + 'PatientTreatments/saveTreatmentIntakeRange', payload, { headers: this.getHeaders() });
}

checkDuplicateEmail(email: string): Observable<any> {
  const params = new HttpParams().set('email', email);
  return this.http.get<ApiResponse | any>(this.baseUrl + 'Users/ActiveUserExists', { params: params });
}

editClinicSalePrice(payload:any){
  return this.http.post<ApiResponse | any>(this.baseUrl + 'Products/CreateClinicToPatient',payload,{ headers: this.getHeaders() })
}

deleteBundleById(bundleId: any, title: any): Observable<any> {
  return new Observable((observer) => {
    this.confirmModal = this.modal.confirm({
      nzTitle: 'Confirmation',
      nzContent: `Are you sure you want to delete ${title}?`,
      nzCentered: true,
      nzOnOk: () => {
        const params = new HttpParams().set('id', bundleId);

        this.http
          .delete<ApiResponse>(`${this.baseUrl}Products/DeleteBundle`, { params, headers: this.getHeaders() })
          .subscribe({
            next: (response) => {
              if (response?.status === 1) {
                this.notification.success(`${title} deleted successfully.`, '');
                observer.next(response);
                observer.complete();
              } else {
                this.notification.error(`Failed to delete ${title}.`, '');
                observer.error(new Error('Deletion failed'));
              }
            },
            error: (error) => {
              console.error(`Error deleting bundle ${bundleId}:`, error);
              this.notification.error('Failed to delete. Please try again later.', '');
              observer.error(error);
            },
          });
      },
      nzOnCancel: () => {
        this.notification.info(`Deletion of ${title} was cancelled.`, '');
        observer.complete();
      },
    });
  });
}

deleteDrugByID(id: any, title: any): Observable<any> {
  return new Observable((observer) => {
    this.confirmModal = this.modal.confirm({
      nzTitle: 'Confirmation',
      nzContent: `Are you sure you want to delete ${title}?`,
      nzCentered: true,
      nzOnOk: () => {
        const params = new HttpParams().set('id', id);

        this.http
          .delete<ApiResponse>(`${this.baseUrl}Products/DeleteDrug`, { params, headers: this.getHeaders() })
          .subscribe({
            next: (response) => {
              if (response?.status === 1) {
                this.notification.success(`${title} deleted successfully.`, '');
                observer.next(response);
                observer.complete();
              } else {
                this.notification.error(`Failed to delete ${title}.`, '');
                observer.error(new Error('Deletion failed'));
              }
            },
            error: (error) => {
              console.error(`Error deleting bundle ${id}:`, error);
              this.notification.error('Failed to delete. Please try again later.', '');
              observer.error(error);
            },
          });
      },
      nzOnCancel: () => {
        this.notification.info(`Deletion of ${title} was cancelled.`, '');
        observer.complete();
      },
    });
  });
}

GetAllBundlesNewForDropdown(facilityId : any){
  return this.http.get<ApiResponse | any>(this.baseUrl + 'DropDowns/GetAllBundlesNew?facilityId='+facilityId, { headers: this.getHeaders()});
}

createCoupon(payload:any){
  return this.http.post<ApiResponse | any>(this.baseUrl + 'Coupons/create',payload,{ headers: this.getHeaders() })
}

updateCoupon(payload:any){
  return this.http.put<ApiResponse | any>(this.baseUrl + 'Coupons/update',payload,{ headers: this.getHeaders() })
}

deleteCoupon(couponCodeId:any){
  return this.http.delete<ApiResponse | any>(this.baseUrl + 'Coupons/delete/'+couponCodeId,{ headers: this.getHeaders() })
}

cancelInvoice(invoiceId: number): Observable<any> {
  return this.http.delete<any>(`${this.baseUrl}Invoices/CancelInvoice?invoiceId=${invoiceId}`, { headers: this.getHeaders() });
}

getAllCouponByFacilityID(payload:any){
  return this.http.post<ApiResponse | any>(this.baseUrl + 'Coupons/getByFacility',payload,{ headers: this.getHeaders() })
}

toggleCouponStatus(couponCodeId:any){
  return this.http.patch<ApiResponse | any>(this.baseUrl + 'Coupons/toggle/'+couponCodeId,{ headers: this.getHeaders() })
}

createEditNewBundle(payload:any){
  return this.http.post<ApiResponse | any>(this.baseUrl + 'Products/saveBundle',payload,{ headers: this.getHeaders() })
}

editClinicBundlePrice(payload:any){
  return this.http.post<ApiResponse | any>(this.baseUrl + 'Products/editClinicBundlePrice',payload,{ headers: this.getHeaders() })
}

getAllCategoriesForIframe(){
  const params = new HttpParams().set('PageNumber', 1)
  .set('PageSize', 100);
  return this.http.get<ApiResponse | any>(this.baseUrl + 'ProductCategories/getAllCategories',{ headers: this.getHeaders(), params: params } );
}

getSquareAppIdByFacilityId(facilityId: number){
  const params = new HttpParams().set('facilityId', facilityId)
  return this.http.get<ApiResponse | any>(this.baseUrl + 'Payment/GetSquareAppIdbyFacilityID',{ headers: this.getHeaders(), params: params });
}

updateTreatmentStatus(payload:any){
  return this.http.patch<ApiResponse | any>(this.baseUrl + 'PatientTreatments/UpdateTreatmentStatus',payload,{ headers: this.getHeaders() })
}

getAllCategoriesDropdown(){
    return this.http.get<ApiResponse | any>(this.baseUrl + 'DropDowns/getAllCategories',{ headers: this.getHeaders() })
}

assignCategoriesToFacility(payload:any){
    return this.http.post<ApiResponse | any>(this.baseUrl + 'Facilities/assign',payload,{ headers: this.getHeaders() })
}

getAllAssignedCategoriesByFacilityID(facilityId:any){
    const params = new HttpParams().set('facilityId', facilityId)
  return this.http.get<ApiResponse | any>(this.baseUrl + 'Facilities/getassigned',{ params: params,headers: this.getHeaders() });
  }

  unAssignCategoriesToFacility(payload:any){
    return this.http.post<ApiResponse | any>(this.baseUrl + 'Facilities/unassign',payload,{ headers: this.getHeaders() })
  }

  getSoapNoteByPrescriptionId(patientPrescriptionId: number) {
    const params = new HttpParams().set('patientPrescriptionId', patientPrescriptionId);
    return this.http.get<ApiResponse | any>(
      this.baseUrl + 'PatientPrescriptions/getSNByPrescriptionId',
      { headers: this.getHeaders(), params }
    );
  }

  saveSoapNote(payload: any) {
    return this.http.post<ApiResponse | any>(
      this.baseUrl + 'PatientPrescriptions/saveSN',
      payload,
      { headers: this.getHeaders() }
    );
  }

  saveTreatmentSoapNote(payload: any) {
    return this.http.post<ApiResponse | any>(
      this.baseUrl + 'PatientTreatments/saveSN',
      payload,
      { headers: this.getHeaders() }
    );
  }

  getTreatmentSoapNoteDetailsById(id: number) {
    const params = new HttpParams().set('Id', id);
    return this.http.get<ApiResponse | any>(
      this.baseUrl + 'PatientTreatments/getSNDetailsBySNId',
      { headers: this.getHeaders(), params }
    );
  }

  uploadSignature(file: Blob, filename = 'signature.png') {
    const formData = new FormData();
    formData.append('file', file, filename);

    const headers = this.getHeaders().delete('Content-Type');

    return this.http.post<ApiResponse | any>(
      this.baseUrl + 'Commons/UploadSignature',
      formData,
      { headers }
    );
  }

  getAllSoapNoteByPrescriptionId(patientPrescriptionId: number) {
    const params = new HttpParams().set('patientPrescriptionId', patientPrescriptionId);
    return this.http.get<ApiResponse | any>(
      this.baseUrl + 'PatientPrescriptions/getAllSNForPrescription',
      { headers: this.getHeaders(), params }
    );
  }

  updateQuestionnaireByFacilityId(payload: any) {
    return this.http.post<ApiResponse | any>(
      this.baseUrl + 'Questionnaires/UpdateQuestionnaireJson',
      payload,
      { headers: this.getHeaders() }
    );
  }

  getFacilitySpecificQuestionnaire(id:any,facilityId:any){
    const params = new HttpParams().set('QuestionnaireId',id).set('facilityId', facilityId);
    return this.http.get<ApiResponse | any>(this.baseUrl + 'Questionnaires/getQuestionnaireJson',{ params: params, headers: this.getHeaders() });
  }

  getInvoicePaymentSummary(invoiceId: number) {
    const params = new HttpParams().set('invoiceId', invoiceId);
    return this.http.get<ApiResponse | any>(
      this.baseUrl + 'Invoices/GetInvoicePaymentSummary',
      { headers: this.getHeaders(), params: params }
    );
  }

  getInvoicesByFacilityIds(facilityId: number, pageNo: number, pageSize: number, status?: string | null, invoiceId?: number | null, patientName?: string | null) {
    let payload: any = {
      facilityId: facilityId,
      pageNumber: pageNo,
      pageSize: pageSize,
      status: status
    };
    if (invoiceId != null) payload.invoiceId = invoiceId;
    if (patientName) payload.patientName = patientName;
    return this.http.post<ApiResponse | any>(
      this.baseUrl + 'Invoices/GetInvoicesByFacilityIds', payload, { headers: this.getHeaders() }
    );
  }

  getInvoicesByPatientId(patientId: number, invoiceId?: number | null, status?: string | null) {
    let payload: any = {
      patientId: patientId
    };
    if (invoiceId != null) payload.invoiceId = invoiceId;
    if (status) payload.status = status;
    return this.http.post<ApiResponse | any>(
      this.baseUrl + 'Invoices/GetInvoicesByPatientId', payload,
      { headers: this.getHeaders() }
    );
  }

  getPatientInvoiceDetailById(invoiceId: number) {
    const params = new HttpParams().set('invoiceId', invoiceId);
    return this.http.get<ApiResponse>(
      this.baseUrl + 'Invoices/GetPatientInvoiceDetailById',
      { params }
    );
  }

  getPayments(body: any) {
    return this.http.post<ApiResponse | any>(this.baseUrl + 'Invoices/GetPayments', body);
  }

  getAdminPaymentDashboard(startDate?: string, endDate?: string ) {
    const httpParams = new HttpParams().set('startDate', startDate || '').set('endDate', endDate || '');
    return this.http.get<ApiResponse>(
      this.baseUrl + 'Invoices/GetAdminPaymentDashboard',
      { params: httpParams }
    );
  }

  updateAppointmentStatus(payload:any){
    return this.http.post<ApiResponse | any>(this.baseUrl + 'Invoices/UpdateAppointmentStatus',payload,{ headers: this.getHeaders() })
  }

  getDashboardTiles(facilityId: number, userId: number, roleId: number) {
    let params = new HttpParams()
      .set('FacilityId', String(facilityId))
      .set('UserId', String(userId))
      .set('RoleId', String(roleId));

    return this.http.get<any>(this.baseUrl + 'Dashboards/getDashBoardTiles', { params });
  }

  getEarnings(
    facilityId: number,
    userId: number,
    roleId: number,
    startDate?: string,
    endDate?: string
  ) {
    let params = new HttpParams()
      .set('FacilityId', String(facilityId))
      .set('UserId', String(userId))
      .set('RoleId', String(roleId));

    if (startDate) {
      params = params.set('StartDate', startDate);
    }
    if (endDate) {
      params = params.set('EndDate', endDate);
    }

    return this.http.get<any>(this.baseUrl + 'Dashboards/getEarnings', { params });
  }

  getPendingPresciptionsForFacilityDashboard(){
    let params = new HttpParams()
      .set('FacilityId',this.facilityID)
      .set('UserId',this.userID)
      .set('RoleId',this.roleId)
    return this.http.get<any>(this.baseUrl + 'Dashboards/getPendingPrescriptions',
      { headers: this.getHeaders(), params: params });
  }

  getAppointments(
    facilityId: number,
    userId: number,
    roleId: number,
    startDate?: string,
    endDate?: string
  ) {
    let params = new HttpParams()
      .set('FacilityId', String(facilityId))
      .set('UserId', String(userId))
      .set('RoleId', String(roleId));

    if (startDate) {
      params = params.set('StartDate', startDate);
    }
    if (endDate) {
      params = params.set('EndDate', endDate);
    }

    return this.http.get<any>(this.baseUrl + 'Dashboards/getAppointments', { params });
  }

  getInvoicePdfUrl(invoiceId: number) {
    const params = new HttpParams().set('invoiceId', invoiceId);
    return this.http.get<ApiResponse>(this.baseUrl + 'Invoices/GetInvoicePdfUrl', { params });
  }

  uploadUserProfilePicture(payload:any) {
    return this.http.post(this.baseUrl + 'Users/UpdateUserProfileUrl',payload,{ headers: this.getHeaders() })
  }

  updatePrescriptionWrittenDate(payload:any) {
    return this.http.post(this.baseUrl+ 'PatientPrescriptions/updatePrescriptionWrittenDate',payload,{ headers: this.getHeaders() })
  }

  toggleRecurringPayment(id: number) {
    const params = new HttpParams().set('patientTreatmentId', String(id));
    return this.http.patch(
      `${this.baseUrl}PatientTreatments/toggleIsRecurring`,
      null,
      { headers: this.getHeaders(), params }
    );
  }

  getAllFacilitiesDropdown(): Observable<any> {
    return this.http.get(this.baseUrl + 'DropDowns/getAllFacilities', {
      headers: this.getHeaders(),
    });
  }

  getDrugUnassignedFacilities(drugId: number): Observable<any> {
    const params = new HttpParams().set('drugId', String(drugId));
    return this.http.get(this.baseUrl + 'Products/GetDrugUnassignedFacilities', {
      headers: this.getHeaders(),
      params,
    });
  }

  unassignDrugFromFacilities(payload: { drugId: number; facilityIds: number[] }): Observable<any> {
    return this.http.post(this.baseUrl + 'Products/UnassignDrugFromFacilities', payload, {
      headers: this.getHeaders(),
    });
  }

  getFacilityById(facilityId: number): Observable<any> {
    const params = new HttpParams().set('Id', String(facilityId));
    return this.http.get(this.baseUrl + 'Facilities/getFacilityById', {
      headers: this.getHeaders(),
      params,
    });
  }

  getAllPatientsDropdown(facilityId: number): Observable<any> {
    const params = new HttpParams().set('FacilityId', String(facilityId));
    return this.http.get(this.baseUrl + 'DropDowns/getAllPatients', {
      headers: this.getHeaders(),
      params,
    });
  }

  getPatientById(patientId: number, facilityId: number): Observable<any> {
    const params = new HttpParams()
      .set('Id', String(patientId))
      .set('FacilityId', String(facilityId));

    return this.http.get(this.baseUrl + 'Patients/getPatientById', {
      headers: this.getHeaders(),
      params,
    });
  }

  movePatientToFacility(payload: {
    patientId: number;
    destinationFacilityId: number;
  }): Observable<any> {
    return this.http.post<ApiResponse | any>(
      this.baseUrl + 'Patients/movePatientToFacility',
      payload,
      { headers: this.getHeaders() }
    );
  }

getAllDrugsAndSupplies(facilityId: number) {
  const params = new HttpParams().set('FacilityId', String(facilityId));
  return this.http.get(
    this.baseUrl + 'DropDowns/GetAllDrugsAndSupplies',
    { headers: this.getHeaders(), params }
  );
}

getAllCustomDrugsAndSupplies(facilityId: number) {
  const params = new HttpParams().set('FacilityId', String(facilityId));
  return this.http.get(
    this.baseUrl + 'DropDowns/GetAllCustomDrugsAndSupplies',
    { headers: this.getHeaders(), params }
  );
}

createManualClinicToPatientInvoice(payload:any){
  return this.http.post<ApiResponse | any>(this.baseUrl + 'Invoices/createManualClinicToPatientInvoice',payload,{ headers: this.getHeaders() })
}

createManualGAToClinicInvoice(payload:any){
  return this.http.post<ApiResponse | any>(this.baseUrl + 'Invoices/createManualGAToClinicInvoice',payload,{ headers: this.getHeaders() })
}

  RequestRefill(patientTreatmentId:any){
    return this.http.patch<ApiResponse | any>(this.baseUrl + 'PatientTreatments/requestRefill/'+patientTreatmentId,{ headers: this.getHeaders() })
  }

  sendOrderToPharmacy(prescriptionId:any){
    let payload = prescriptionId
    return this.http.post<ApiResponse | any>(this.baseUrl + 'empower/create-orders-by-prescription/'+prescriptionId,payload,{ headers: this.getHeaders() })
  }

  fulfillOrderManually(payload: {
    patientOrderId: number;
    orderNumber?: string | null;
    orderStatus: string;
    trackingNumber?: string | null;
    trackingUrl?: string | null;
    shippingProvider?: string | null;
    dateShipped?: string | null;
    notes?: string | null;
  }): Observable<ApiResponse | any> {
    return this.http.post<ApiResponse | any>(
      this.baseUrl + 'PatientOrders/fulfillManually',
      payload,
      { headers: this.getHeaders() }
    );
  }

  getAllRoleTitles(): Observable<any> {
    return this.http.get<any>(this.baseUrl + 'DropDowns/getAllRoleTitles', { headers: this.getHeaders() });
  }

  saveRoleTitle(payload: { roleTitleId?: number; roleTitleName: string; isActive: boolean }): Observable<any> {
    return this.http.post<any>(this.baseUrl + 'DropDowns/saveRoleTitle', payload, { headers: this.getHeaders() });
  }

  getFullscriptSessionGrant(): Observable<any> {
    return this.http.get<ApiResponse>(this.baseUrl + 'fullscript/session-grant', { headers: this.getHeaders() }).pipe(
      map((response: ApiResponse) => response?.data || null),
      catchError((error: HttpErrorResponse) => {
        console.error('Fullscript session grant error:', error);
        return of(null);
      })
    );
  }

  getFullscriptConnectionStatus(): Observable<{ connected: boolean }> {
    return this.http.get<ApiResponse>(this.baseUrl + 'integrations/fullscript/status', { headers: this.getHeaders() }).pipe(
      map((response: ApiResponse) => {

        return response?.data || { connected: false };
      }),
      catchError((error: HttpErrorResponse) => {
        console.error('Fullscript status error:', error);
        return of({ connected: false });
      })
    );
  }

  disconnectFullscript(): Observable<any> {
    return this.http.post<ApiResponse>(this.baseUrl + 'integrations/fullscript/disconnect', null, { headers: this.getHeaders() }).pipe(
      map((response: ApiResponse) => response?.data || null),
      catchError((error: HttpErrorResponse) => {
        console.error('Fullscript disconnect error:', error);
        return of(null);
      })
    );
  }

  startFullscriptConnectRedirect(): void {

    this.http.get<ApiResponse>(this.baseUrl + 'integrations/fullscript/initiate', { headers: this.getHeaders() }).subscribe({
      next: (response: ApiResponse) => {
        if (response?.status === 1 && response?.data?.authUrl) {

          window.location.href = response.data.authUrl;
        } else {
          console.error('Failed to get OAuth URL:', response);
          this.notification.error('Failed to initiate Fullscript connection', response?.message || 'Unknown error');
        }
      },
      error: (error: HttpErrorResponse) => {
        console.error('Fullscript OAuth initiation error:', error);
        this.notification.error('Failed to connect Fullscript', error.error?.message || error.message || 'Unknown error');
      }
    });
  }

  getSquareConnectionStatus(facilityId: number | string): Observable<{ connected: boolean; sandbox?: boolean }> {
    const params = new HttpParams().set('facilityId', String(facilityId));
    return this.http.get<ApiResponse>(this.baseUrl + 'integrations/square/status', { headers: this.getHeaders(), params }).pipe(
      map((r: ApiResponse) => r?.data ?? { connected: false, sandbox: false }),
      catchError(() => of({ connected: false, sandbox: false }))
    );
  }

  startSquareConnectRedirect(facilityId: number | string): void {
    const params = new HttpParams().set('facilityId', String(facilityId));
    this.http.get<ApiResponse>(this.baseUrl + 'integrations/square/initiate', { headers: this.getHeaders(), params }).subscribe({
      next: (r: ApiResponse) => {
        const redirectUrl = r?.data?.authUrl;
        if (r?.status === 1 && redirectUrl) {
          window.location.href = redirectUrl;
        } else {
          this.notification.error('Error', r?.message || 'Failed to initiate Square connection');
        }
      },
      error: (e: HttpErrorResponse) => {
        this.notification.error('Error', e?.error?.message || e?.message || 'Failed to connect Square');
      }
    });
  }

  disconnectSquare(): Observable<unknown> {
    return this.http.post<ApiResponse>(this.baseUrl + 'integrations/square/disconnect', null, { headers: this.getHeaders() }).pipe(
      map((r) => r?.data),
      catchError(() => of(null))
    );
  }

  sendInvoiceReminder(invoiceId: number): Observable<any> {
    const params = new HttpParams().set('invoiceId', invoiceId);
    return this.http.post<ApiResponse | any>(
      this.baseUrl + 'ReminderEmails/invoice-pending',
      {},
      { headers: this.getHeaders(), params }
    );
  }

  sendTreatmentQuestionnaireReminder(patientTreatmentId: number): Observable<any> {
    const params = new HttpParams().set('patientTreatmentId', patientTreatmentId);
    return this.http.post<ApiResponse | any>(
      this.baseUrl + 'ReminderEmails/treatment-questionnaire',
      {},
      { headers: this.getHeaders(), params }
    );
  }

  downloadFacilityBulkImportTemplate(): Observable<Blob> {
    let headers = new HttpHeaders();
    const authToken = localStorage.getItem('isolHealthToken');
    if (authToken) {
      headers = headers.set('Authorization', `Bearer ${authToken}`);
    }
    return this.http.get(`${this.baseUrl}Facilities/bulkImportTemplate`, {
      headers,
      responseType: 'blob',
    });
  }

  bulkImportFacilitiesExcel(file: File): Observable<ApiResponse | null | any> {
    const formData = new FormData();
    formData.append('File', file, file.name);
    const headers = this.getHeaders().delete('Content-Type');
    return this.http
      .post<ApiResponse | any>(`${this.baseUrl}Facilities/bulkImportFacilitiesExcel`, formData, { headers })
      .pipe(
        catchError((error: HttpErrorResponse) => {
          console.error('bulkImportFacilitiesExcel:', error);
          return of({
            status: 0,
            message: error?.error?.message || error.message || 'Import request failed',
            count: 0,
            data: null,
            totalEntityCount: 0,
            totalPages: 0,
          });
        })
      );
  }

  downloadDrugBulkImportTemplate(catalogId: number): Observable<Blob> {
    let headers = new HttpHeaders();
    const authToken = localStorage.getItem('isolHealthToken');
    if (authToken) {
      headers = headers.set('Authorization', `Bearer ${authToken}`);
    }
    const params = new HttpParams().set('catalogId', String(catalogId));
    return this.http.get(`${this.baseUrl}Products/bulkImportDrugsTemplate`, {
      headers,
      params,
      responseType: 'blob',
    });
  }

  bulkImportDrugsExcel(file: File, catalogId: number): Observable<ApiResponse | null | any> {
    const formData = new FormData();
    formData.append('File', file, file.name);
    formData.append('CatalogId', String(catalogId));
    const headers = this.getHeaders().delete('Content-Type');
    return this.http
      .post<ApiResponse | any>(`${this.baseUrl}Products/bulkImportDrugsExcel`, formData, { headers })
      .pipe(
        catchError((error: HttpErrorResponse) => {
          console.error('bulkImportDrugsExcel:', error);
          return of({
            status: 0,
            message: error?.error?.message || error.message || 'Import request failed',
            count: 0,
            data: null,
            totalEntityCount: 0,
            totalPages: 0,
          });
        })
      );
  }

  downloadPatientBulkImportTemplate(): Observable<Blob> {
    let headers = new HttpHeaders();
    const authToken = localStorage.getItem('isolHealthToken');
    if (authToken) {
      headers = headers.set('Authorization', `Bearer ${authToken}`);
    }
    return this.http.get(`${this.baseUrl}Patients/bulkImportTemplate`, {
      headers,
      responseType: 'blob',
    });
  }

  checkActiveUsersExist(emails: string[]): Observable<ApiResponse | null | any> {
    return this.http
      .post<ApiResponse | any>(`${this.baseUrl}Users/activeUsersExist`, { emails }, { headers: this.getHeaders() })
      .pipe(
        catchError((error: HttpErrorResponse) => {

          console.error('checkActiveUsersExist failed:', error?.status, error?.message);
          return of({ status: 0, message: error?.error?.message || error.message || 'Check failed', data: [] });
        })
      );
  }

  bulkImportPatients(payload: {
    facilityId?: number;
    patients: Array<{ firstName: string; lastName: string; email: string; phone: string }>;
  }): Observable<ApiResponse | null | any> {
    return this.http
      .post<ApiResponse | any>(`${this.baseUrl}Patients/bulkImportPatients`, payload, { headers: this.getHeaders() })
      .pipe(
        catchError((error: HttpErrorResponse) => {

          console.error('bulkImportPatients failed:', error?.status, error?.message);
          return of({
            status: 0,
            message: error?.error?.message || error.message || 'Import request failed',
            count: 0,
            data: null,
            totalEntityCount: 0,
            totalPages: 0,
          });
        })
      );
  }
}
