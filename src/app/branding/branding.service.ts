import { Injectable } from '@angular/core';
import { AuthService } from 'app/shared/Auth/auth.service';
import { GeneralService } from 'app/shared/services/general.service';
import { NzConfigService } from 'ng-zorro-antd/core/config';
import { BehaviorSubject, Observable, of, Subject, throwError } from 'rxjs';
import {
  catchError,
  tap,
  debounceTime,
  distinctUntilChanged,
  takeUntil,
} from 'rxjs/operators';
import { environment } from 'environments/environment';
import * as echarts from 'echarts';

export interface Branding {
  brandId: number;
  facilityId: number;
  logo: string;
  primaryColor: string;
  primaryColorVariants: string[];
  secondaryColor: string;
  chartColors: string[];
  fontStyle: string;
}

export interface ApiResponse {
  data: Branding;
}

@Injectable({
  providedIn: 'root',
})
export class BrandingService {
  private brandingSubject = new BehaviorSubject<Branding | null>(null);
  branding$ = this.brandingSubject.asObservable();
  private updateSubject = new BehaviorSubject<Partial<Branding>>({});

  defaultBranding: Branding = {
    brandId: 0,
    facilityId: 0,
    logo: `${environment.FE_PATH}/assets/img/impact-health-logo-dark.png`,
    primaryColor: '#2d71fa',
    primaryColorVariants: [
      '#e6edff',
      '#c8d7ff',
      '#a1bfff',
      '#7aa6ff',
      '#5c90ff',
      '#2d71fa',
      '#285ee0',
      '#224cc0',
      '#1c3a9b',
      '#152b75',
    ],
    secondaryColor: '#0284c7',
    chartColors: [
      '#5470c6',
      '#91cc75',
      '#fac858',
      '#ee6666',
      '#73c0de',
      '#3ba272',
      '#fc8452',
      '#9a60b4',
      '#ea7ccc',
    ],
    fontStyle: 'Mulish, sans-serif',
  };

  private destroy$ = new Subject<void>();

  constructor(
    private generalService: GeneralService,
    private auth: AuthService,
    private nzConfigService: NzConfigService
  ) {
    this.updateSubject
      .pipe(
        debounceTime(100),
        takeUntil(this.destroy$),
        distinctUntilChanged(
          (prev, curr) => JSON.stringify(prev) === JSON.stringify(curr)
        )
      )
      .subscribe((updates) => this.applyUpdates(updates));
  }

  getUserRole(): string {
    return this.auth.getUserRole() || '';
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  resetBranding() {
    this.brandingSubject.next(this.defaultBranding);
    this.applyBranding(this.defaultBranding);
  }

  getBranding(
    firstLoad = false,
    clinicGuid: string = ''
  ): Observable<ApiResponse> {
    if (!firstLoad && this.brandingSubject.value) {
      return of({ data: this.brandingSubject.value! });
    }

    const userRole = this.auth.getUserRole() || '';
    if (userRole === 'Global Admin' || userRole === 'Provider') {
      const branding = this.defaultBranding;
      this.brandingSubject.next(branding);
      this.applyBranding(branding);
      return of({
        data: branding,
      });
    }

    const guid = clinicGuid !== '' ? clinicGuid : localStorage.getItem('FOSG');
    return this.generalService
      .commonGet(`Brands/getBrandById?FacilityGuid=${guid}`)
      .pipe(
        tap((response) => {
          if (response?.data) {
            const branding = { ...this.defaultBranding, ...response.data };
            this.brandingSubject.next(branding);
            this.applyBranding(branding);
          } else {
            this.brandingSubject.next(this.defaultBranding);
            this.applyBranding(this.defaultBranding);
          }
        }),
        catchError(() => {
          this.generalService.showError('Failed to fetch branding data');
          this.brandingSubject.next(this.defaultBranding);
          this.applyBranding(this.defaultBranding);
          return of({ data: this.defaultBranding });
        }),
        takeUntil(this.destroy$)
      );
  }

  saveBranding(branding: Branding): Observable<Branding> {
    const facilityId = Number(localStorage.getItem('FOS'));
    branding.facilityId = facilityId;
    return this.generalService.commonPost('Brands/saveBrand', branding).pipe(
      tap((response) => {
        if (response?.data) {
          this.brandingSubject.next(response.data);
          this.generalService.showSuccess('Branding saved successfully!');
        } else {
          this.generalService.showError('Failed to save branding');
        }
      }),
      catchError(() => {
        this.generalService.showError('Failed to save branding');
        return throwError(() => new Error('Failed to save branding'));
      }),
      takeUntil(this.destroy$)
    );
  }

  updateBranding(updates: Partial<Branding>): void {
    const current = this.brandingSubject.value || this.defaultBranding;
    const newBranding = { ...current, ...updates };
    this.brandingSubject.next(newBranding);
    this.updateSubject.next(updates);
  }

  private applyBranding(branding: Branding): void {
    this.setColors(
      branding.primaryColor,
      branding.secondaryColor,
      branding.primaryColorVariants
    );
    this.setFontStyle(branding.fontStyle);
    this.setLogo(branding.logo);
    this.registerEChartsTheme(branding.chartColors, branding.fontStyle);
  }

  private applyUpdates(updates: Partial<Branding>): void {
    if (
      updates.primaryColor ||
      updates.secondaryColor ||
      updates.primaryColorVariants
    ) {
      this.setColors(
        updates.primaryColor ??
          this.brandingSubject.value?.primaryColor ??
          this.defaultBranding.primaryColor,
        updates.secondaryColor ??
          this.brandingSubject.value?.secondaryColor ??
          this.defaultBranding.secondaryColor,
        updates.primaryColorVariants ??
          this.brandingSubject.value?.primaryColorVariants ??
          this.defaultBranding.primaryColorVariants
      );
    }
    if (updates.fontStyle) {
      this.setFontStyle(updates.fontStyle);
    }
    if (updates.logo) {
      this.setLogo(updates.logo);
    }
    if (updates.chartColors) {
      this.registerEChartsTheme(
        updates.chartColors ??
          this.brandingSubject.value?.chartColors ??
          this.defaultBranding.chartColors,
        updates.fontStyle ??
          this.brandingSubject.value?.fontStyle ??
          this.defaultBranding.fontStyle
      );
    }
  }

  private setColors(
    primaryColor: string,
    secondaryColor: string,
    primaryColorVariants: string[]
  ): void {
    const root = document.documentElement;
    root.style.setProperty('--primary-color', primaryColor);
    root.style.setProperty('--secondP-color', secondaryColor);
    primaryColorVariants.forEach((color, index) => {
      const level = index === 0 ? 50 : index * 100;
      root.style.setProperty(`--primary-${level}`, color);
    });
    this.nzConfigService.set('theme', { primaryColor: secondaryColor });
  }

  private setFontStyle(fontStyle: string): void {
    const root = document.documentElement;
    root.style.setProperty('--font-family', fontStyle);
  }

  private setLogo(logo: string): void {
    const root = document.documentElement;
    root.style.setProperty('--logo', `url(${logo})`);
  }

  private registerEChartsTheme(colors: string[], font: string): void {
    const theme = {
      color: [...colors],
      textStyle: {
        fontFamily: font || 'Mulish, sans-serif',
      },
    };
    echarts.registerTheme('customTheme', theme);
  }
}
