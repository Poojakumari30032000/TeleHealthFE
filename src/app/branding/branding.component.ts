import { Component, OnInit, OnDestroy, ChangeDetectionStrategy } from '@angular/core';
import { NzUploadFile, NzUploadModule } from 'ng-zorro-antd/upload';
import { NzMessageService } from 'ng-zorro-antd/message';
import { Observable, Observer, Subject, takeUntil } from 'rxjs';
import { Branding, BrandingService  } from './branding.service';
import { CommonModule } from '@angular/common';
import { NzInputModule } from 'ng-zorro-antd/input';
import { FormsModule } from '@angular/forms';
import { NzSelectModule } from 'ng-zorro-antd/select';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { TinyColor } from '@ctrl/tinycolor';
import { environment } from 'environments/environment';
import {AuthService} from "../shared/Auth/auth.service";

@Component({
  selector: 'app-branding',
  standalone: true,
  imports: [CommonModule, NzUploadModule, NzInputModule, FormsModule, NzSelectModule, NzButtonModule ],
  templateUrl: './branding.component.html',
  styleUrl: './branding.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class BrandingComponent implements OnInit , OnDestroy {
  branding: Branding | null = null;
  initialBranding: Branding | null = null;
  primaryColorVariants: string[] = [];
  logoPreview: string = '';
  readonly fontOptions = [
    { label: 'Mulish', value: 'Mulish, sans-serif' },
    { label: 'Roboto', value: 'Roboto, sans-serif' },
    { label: 'Open Sans', value: 'Open Sans, sans-serif' },
    { label: 'Lato', value: 'Lato, sans-serif' },
    { label: 'Montserrat', value: 'Montserrat, sans-serif' },
    { label: 'Poppins', value: 'Poppins, sans-serif' },
    { label: 'Source Sans Pro', value: 'Source Sans Pro, sans-serif' },
    { label: 'Nunito', value: 'Nunito, sans-serif' },
    { label: 'Inter', value: 'Inter, sans-serif' },
    { label: 'Work Sans', value: 'Work Sans, sans-serif' },
    { label: 'Fira Sans', value: 'Fira Sans, sans-serif' },
    { label: 'Noto Sans', value: 'Noto Sans, sans-serif' },
    { label: 'Raleway', value: 'Raleway, sans-serif' },
    { label: 'IBM Plex Sans', value: 'IBM Plex Sans, sans-serif' },
    { label: 'Quicksand', value: 'Quicksand, sans-serif' }
  ];
  private readonly lightColorThreshold = 180;
  private readonly darkColorThreshold = 50;
  uploadUrl: string = `${environment.IAMGE_PATH}/api/Commons/UploadFile`;
  private destroy$ = new Subject<void>();

  token = this.auth.getToken();

  constructor(
    private brandingService: BrandingService,
    private message: NzMessageService,
    private auth : AuthService
  ) {}

  ngOnInit(): void {
    this.brandingService.getBranding().pipe(takeUntil(this.destroy$)).subscribe((response) => {
      const branding = response.data || this.brandingService.defaultBranding;
      this.branding = {...branding};
      this.initialBranding = {...branding};
      this.initialBranding.primaryColorVariants = [...branding.primaryColorVariants];
      this.initialBranding.chartColors = [...branding.chartColors];
      this.primaryColorVariants = [...branding.primaryColorVariants];
      this.logoPreview = branding.logo; this.branding = branding;
    })
  }

  ngOnDestroy(): void {
    if(this.initialBranding !== this.branding){
      this.cancelChanges();
    }
    this.destroy$.next();
    this.destroy$.complete();
  }

  beforeUpload = (file: NzUploadFile, _fileList: NzUploadFile[]): Observable<boolean> =>
    new Observable((observer: Observer<boolean>) => {
      const isImage = file.type?.startsWith('image/');
      if (!isImage) {
        this.message.error('You can only upload image files!');
        observer.complete();
        return;
      }

      const isLt2M = file.size! / 1024 / 1024 < 2;
      if (!isLt2M) {
        this.message.error('Image must be smaller than 2MB!');
        observer.complete();
        return;
      }

      observer.next(isImage && isLt2M);
      observer.complete();
    });

  handleUpload(info: { file: NzUploadFile }): void {
    switch (info.file.status) {
      case 'done':
        const fileUrl = info.file.response?.fileDetails?.filePath;
        if(!fileUrl){
          this.message.error('Something went wrong while trying to upload file')
          return;
        }
        this.message.success(`${info.file.name} uploaded successfully`);
        if (!this.branding) return;
        this.logoPreview = fileUrl
        this.branding.logo = fileUrl;
        this.brandingService.updateBranding({ logo: fileUrl });
        break;
      case 'error':
        this.message.error('Network error');
        break;
    }
  }

  updateColorVariants(): void {
    if (!this.branding) return
    const adjustedColor = this.adjustColorIfNeeded(this.branding.primaryColor);
    this.primaryColorVariants = this.generateColorVariants(adjustedColor);
    this.brandingService.updateBranding({ primaryColor: adjustedColor, primaryColorVariants : this.primaryColorVariants });
  }

  private adjustColorIfNeeded(color: string): string {
    const tinyColor = new TinyColor(color);
    const brightness = tinyColor.getBrightness();
    if (brightness > this.lightColorThreshold) {
      return tinyColor.darken(15).toHexString();
    }
    if (brightness < this.darkColorThreshold) {
      return tinyColor.lighten(15).toHexString();
    }
    return color;
  }

  private generateColorVariants(color: string): string[] {
    const tinyColor = new TinyColor(color);
    return [
      tinyColor.lighten(45).toHexString(),
      tinyColor.lighten(40).toHexString(),
      tinyColor.lighten(30).toHexString(),
      tinyColor.lighten(20).toHexString(),
      tinyColor.lighten(10).toHexString(),
      color,
      tinyColor.darken(10).toHexString(),
      tinyColor.darken(20).toHexString(),
      tinyColor.darken(30).toHexString(),
      tinyColor.darken(40).toHexString(),
    ];
  }

  updateColors(): void {
    if (!this.branding) return
    this.brandingService.updateBranding({
      primaryColor: this.branding.primaryColor,
      secondaryColor: this.branding.secondaryColor,
    });
  }

  updateVarientColors(): void {
    this.brandingService.updateBranding({
      primaryColorVariants: this.primaryColorVariants,
    });
  }

  updateFontStyle(): void {
    if (!this.branding) return
    this.brandingService.updateBranding({ fontStyle: this.branding.fontStyle });
  }

  addChartColor(): void {
    if (!this.branding) return
    this.branding.chartColors = [...this.branding.chartColors, '#000000'];
    this.brandingService.updateBranding({ chartColors: this.branding.chartColors });
  }

  removeChartColor(index: number): void {
    if (!this.branding) return;
    if (this.branding.chartColors.length <= 1) {
      this.message.warning('At least one chart color is required');
      return;
    }
    this.branding.chartColors.splice(index, 1);
    this.brandingService.updateBranding({ chartColors: this.branding.chartColors });
}

  saveBranding(): void {
    if (!this.branding) return;
    this.branding.primaryColorVariants = this.primaryColorVariants;
    this.brandingService.saveBranding(this.branding).pipe(takeUntil(this.destroy$)).subscribe(() => {
      if(!this.branding)return
      this.initialBranding = {...this.branding};
      this.initialBranding.primaryColorVariants = [...this.primaryColorVariants];
      this.initialBranding.chartColors = [...this.branding.chartColors];
    });
  }

  cancelChanges(): void {
    if (!this.initialBranding) return;
    this.branding = {...this.initialBranding};
    this.primaryColorVariants = [...this.initialBranding.primaryColorVariants];
    this.logoPreview = this.initialBranding.logo;
    this.brandingService.updateBranding({
      ...this.initialBranding,
      primaryColorVariants: [...this.initialBranding.primaryColorVariants],
      chartColors: [...this.initialBranding.chartColors]
    });
  }

}
