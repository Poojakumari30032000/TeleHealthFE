import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  ElementRef,
  EventEmitter,
  Input,
  OnChanges,
  OnDestroy,
  AfterViewInit,
  Output,
  SimpleChanges,
  ViewChild,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { NzButtonModule } from 'ng-zorro-antd/button';
import SignaturePad from 'signature_pad';
import { GeneralService } from 'app/shared/services/general.service';

@Component({
  selector: 'app-signature-pad',
  standalone: true,
  imports: [CommonModule, NzButtonModule],
  templateUrl: './signature-pad.component.html',
  styleUrl: './signature-pad.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SignaturePadComponent implements AfterViewInit, OnDestroy, OnChanges {

  @Input() existingUrl: string | null = null;

  @Input() hasError = false;

  @Output() urlChange = new EventEmitter<string | null>();

  @ViewChild('sigCanvas') canvasRef!: ElementRef<HTMLCanvasElement>;

  private signaturePad!: SignaturePad;
  uploading = false;
  savedUrl: string | null = null;
  reSigning = false;

  constructor(
    private generalService: GeneralService,
    private cdr: ChangeDetectorRef,
  ) {}

  ngAfterViewInit(): void {
    this.savedUrl = this.existingUrl;
    if (!this.savedUrl) {
      this.initPad();
    }
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['existingUrl'] && !changes['existingUrl'].firstChange) {
      this.savedUrl = this.existingUrl;
      this.cdr.markForCheck();
    }
  }

  private initPad(): void {
    const canvas = this.canvasRef?.nativeElement;
    if (!canvas) return;

    const ratio = window.devicePixelRatio || 1;
    canvas.width = canvas.offsetWidth * ratio;
    canvas.height = canvas.offsetHeight * ratio;
    const ctx = canvas.getContext('2d');
    if (ctx) ctx.scale(ratio, ratio);

    this.signaturePad = new SignaturePad(canvas, {
      backgroundColor: 'rgb(255,255,255)',
      penColor: 'rgb(15, 23, 42)',
    });
  }

  clear(): void {
    this.signaturePad?.clear();
  }

  saveSignature(): void {
    if (!this.signaturePad || this.signaturePad.isEmpty()) {
      this.generalService.showError('Please draw your signature first.');
      return;
    }

    const canvas = this.canvasRef.nativeElement;
    this.uploading = true;
    this.cdr.markForCheck();

    canvas.toBlob((blob) => {
      if (!blob) {
        this.uploading = false;
        this.cdr.markForCheck();
        return;
      }

      this.generalService.uploadSignature(blob, 'signature.png').subscribe({
        next: (res: any) => {
          const url: string | null = res?.data?.url ?? res?.url ?? null;
          if (url) {
            this.savedUrl = url;
            this.reSigning = false;
            this.urlChange.emit(url);
          } else {
            this.generalService.showError('Signature upload failed — no URL returned.');
          }
          this.uploading = false;
          this.cdr.markForCheck();
        },
        error: () => {
          this.generalService.showError('Failed to upload signature. Please try again.');
          this.uploading = false;
          this.cdr.markForCheck();
        },
      });
    }, 'image/png');
  }

  startResign(): void {
    this.reSigning = true;
    this.cdr.markForCheck();

    setTimeout(() => this.initPad(), 0);
  }

  cancelResign(): void {
    this.reSigning = false;
    this.cdr.markForCheck();
  }

  removeSignature(): void {
    this.savedUrl = null;
    this.reSigning = false;
    this.urlChange.emit(null);
    this.cdr.markForCheck();
    setTimeout(() => this.initPad(), 0);
  }

  ngOnDestroy(): void {
    this.signaturePad?.off();
  }
}
