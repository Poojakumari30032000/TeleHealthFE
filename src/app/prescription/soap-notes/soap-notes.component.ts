import {
  Component,
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Input,
  OnChanges,
  OnInit,
  SimpleChanges,
  ViewChild,
  ElementRef,
  HostListener,
} from '@angular/core';
import {ActivatedRoute, Router} from '@angular/router';
import { AbstractControl, FormArray, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { finalize } from 'rxjs/operators';
import { firstValueFrom } from 'rxjs';
import { GeneralService } from 'app/shared/services/general.service';
import { TitleService } from 'app/shared/services/title.service';
import { AuthService } from '../../shared/Auth/auth.service';

interface ApiResponse<T = any> {
  status: number;
  success?: boolean;
  message?: string;
  count?: number;
  data: T;
}

interface SoapNote {
  soapNoteId: number;
  patientTreatmentId?: number | null;
  subjective: string | null;
  objective: string | null;
  assessment: string | null;
  plan: string | null;
  allergiesJson: string | null;
  signaturePath: string | null;
  signature: string | null;
  signedBy: string | null;
  signedAt: string | null;
  status: string | null;
  createdDate: string | null;
  modifiedDate?: string | null;
  createdByName?: string | null;
}

type EmbeddedTabNavigationRequest = {
  type: 'order' | 'soapNote' | 'treatmentMain';
  id?: number;
  data?: any;
};

@Component({
  selector: 'app-soap-notes',
  templateUrl: './soap-notes.component.html',
  styleUrls: ['./soap-notes.component.css'],
  host: {
    '[class.sn-phone-view]': 'isPhoneView'
  },
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class SOAPNotesComponent implements OnInit, OnChanges {
  @Input() patientTreatmentIdInput: number | null = null;
  @Input() patientNameInput: string | null = null;
  @Input() soapNoteInput: SoapNote | null = null;
  @Input() embeddedInTabs = false;
  @Input() openInTreatmentTabs: ((request: EmbeddedTabNavigationRequest) => void) | null = null;

  isLoading = false;
  isSaving = false;
  hasError = false;

  patientTreatmentId = 0;
  soapNote: SoapNote | null = null;

  form!: FormGroup;

  @ViewChild('sigCanvas', { static: false }) sigCanvas!: ElementRef<HTMLCanvasElement>;
  private ctx!: CanvasRenderingContext2D | null;
  private drawing = false;
  private lastX = 0;
  private lastY = 0;
  private hasInk = false;

  signatureUploading = false;
  uploadedSignaturePath: string | null = null;
  uploadedSignatureUrl: string | null = null;
  reSigning = false;
  signatureUpdated = false;

  userRole: string | null = null;
  canEdit = false;
  isPhoneView = false;
  readonly maxLen = {
    soapSection: 4000,
    allergyLong: 1000,
    dosageWithUnits: 120,
    additionalFrequencyDetail: 150,
    frequency: 80
  };

  constructor(
    private route: ActivatedRoute,
    private fb: FormBuilder,
    private gs: GeneralService,
    private title: TitleService,
    private cdr: ChangeDetectorRef,
    private auth: AuthService,
    private router: Router,
  ) {}

  ngOnInit(): void {
    this.userRole = this.auth.getUserRole();
    this.canEdit = (this.userRole || '').toLowerCase() === 'provider';

    if (!this.embeddedInTabs) {
      this.title.updateTitle('SOAP Notes');
    }
    this.patientTreatmentId = this.resolvePatientTreatmentId();
    this.updateViewportFlags();

    this.initForm();

    if (!this.canEdit) this.form.disable({ emitEvent: false });

    this.fetchSN();
  }

  ngOnChanges(changes: SimpleChanges): void {
    const hasContextChange =
      changes['patientTreatmentIdInput'] ||
      changes['soapNoteInput'];
    if (!hasContextChange || !this.form) return;

    this.patientTreatmentId = this.resolvePatientTreatmentId();
    this.fetchSN();
  }

  private resolvePatientTreatmentId(): number {
    const inputId = Number(this.patientTreatmentIdInput || 0);
    if (inputId > 0) return inputId;

    return (
      Number(this.route.snapshot.paramMap.get('id')) ||
      Number(this.route.snapshot.paramMap.get('patientTreatmentId')) ||
      Number(this.route.snapshot.paramMap.get('treatmentId')) ||
      0
    );
  }

  @HostListener('window:resize')
  onResize() {
    this.updateViewportFlags();
    this.resizeCanvas();
  }

  private updateViewportFlags(): void {
    const widths: number[] = [];
    if (typeof window !== 'undefined') {
      if (Number.isFinite(window.innerWidth) && window.innerWidth > 0) widths.push(window.innerWidth);
      if (Number.isFinite(window.screen?.width) && (window.screen?.width || 0) > 0) widths.push(window.screen.width);
      const vvWidth = window.visualViewport?.width;
      if (Number.isFinite(vvWidth) && (vvWidth || 0) > 0) widths.push(vvWidth as number);
    }
    const effectiveWidth = widths.length ? Math.min(...widths) : 1024;
    this.isPhoneView = effectiveWidth <= 768;
  }

  private initForm(): void {
    this.form = this.fb.group({

      subjective: ['', [Validators.required, Validators.maxLength(this.maxLen.soapSection)]],
      objective: ['', [Validators.required, Validators.maxLength(this.maxLen.soapSection)]],
      assessment: ['', [Validators.required, Validators.maxLength(this.maxLen.soapSection)]],
      plan: ['', [Validators.required, Validators.maxLength(this.maxLen.soapSection)]],

      allergies: this.fb.array([]),
    });

    if (this.allergies.length === 0) this.addAllergy();
  }

  get allergies(): FormArray {
    return this.form.get('allergies') as FormArray;
  }

  private allergyGroup(seed?: any) {
    return this.fb.group({
      details: [seed?.details || '', [Validators.maxLength(this.maxLen.allergyLong)]],
      currentMedications: [seed?.currentMedications || '', [Validators.maxLength(this.maxLen.allergyLong)]],
      dosageWithUnits: [seed?.dosageWithUnits || '', [Validators.maxLength(this.maxLen.dosageWithUnits)]],
      additionalFrequencyDetail: [seed?.additionalFrequencyDetail || '', [Validators.maxLength(this.maxLen.additionalFrequencyDetail)]],
      frequency: [seed?.frequency || '', [Validators.maxLength(this.maxLen.frequency)]],
      reasons: [seed?.reasons || '', [Validators.maxLength(this.maxLen.allergyLong)]],
    });
  }

  addAllergy(): void {
    if (!this.canEdit) return;
    this.allergies.push(this.allergyGroup());
    this.cdr.markForCheck();
  }

  removeAllergy(idx: number): void {
    if (!this.canEdit) return;
    if (this.allergies.length > 1) {
      this.allergies.removeAt(idx);
      this.cdr.markForCheck();
    }
  }

  removeAllergyByControl(control: AbstractControl): void {
    if (!this.canEdit) return;
    if (this.allergies.length <= 1) return;
    const idx = this.allergies.controls.indexOf(control);
    if (idx < 0) return;
    this.allergies.removeAt(idx);
    this.cdr.markForCheck();
  }

  trackByAllergyControl(_index: number, control: AbstractControl) { return control; }
  trackByIndex(index: number) { return index; }

  get readonlyAllergies(): any[] {
    const values = this.form?.getRawValue?.()?.allergies;
    if (Array.isArray(values) && values.length > 0) return values;
    return [{ details: '', currentMedications: '', reasons: '', dosageWithUnits: '', additionalFrequencyDetail: '', frequency: '' }];
  }

  viewValue(value: unknown): string {
    const text = String(value ?? '').trim();
    return text.length ? text : '—';
  }

  isFieldInvalid(field: string): boolean {
    const control = this.form.get(field);

    return !!(control && control.invalid);
  }

  public fetchSN(): void {
    const soapNoteId = Number(this.soapNoteInput?.soapNoteId || 0);
    if (soapNoteId > 0) {
      this.loadTreatmentSoapNoteById(soapNoteId);
      return;
    }
    this.applyTreatmentSoapContext();
  }

  private applyTreatmentSoapContext(): void {
    this.isLoading = false;
    this.hasError = false;
    this.patientTreatmentId = Number(this.soapNoteInput?.patientTreatmentId || this.patientTreatmentId || 0);
    this.applySoapNoteState(this.soapNoteInput || null);
  }

  private applySoapNoteState(sn: SoapNote | null): void {
    this.soapNote = sn;

    this.form.patchValue({
      subjective: sn?.subjective || '',
      objective: sn?.objective || '',
      assessment: sn?.assessment || '',
      plan: sn?.plan || ''
    });

    this.allergies.clear();
    const parsed = this.safeParseAllergies(sn?.allergiesJson);
    if (parsed.length) parsed.forEach((a) => this.allergies.push(this.allergyGroup(a)));
    else this.allergies.push(this.allergyGroup());

    this.uploadedSignaturePath = sn?.signaturePath || null;
    this.uploadedSignatureUrl = sn?.signature || null;
    this.reSigning = false;
    this.signatureUpdated = false;

    if (!this.canEdit) this.form.disable({ emitEvent: false });
    else this.form.enable({ emitEvent: false });

    if (this.canEdit) setTimeout(() => this.setupCanvas(), 0);
    this.cdr.markForCheck();
  }

  private loadTreatmentSoapNoteById(soapNoteId: number): void {
    this.isLoading = true;
    this.hasError = false;
    this.cdr.markForCheck();

    this.gs
      .getTreatmentSoapNoteDetailsById(soapNoteId)
      .pipe(finalize(() => {
        this.isLoading = false;
        this.cdr.markForCheck();
      }))
      .subscribe({
        next: (response) => {
          const isSuccess = response?.status === 1 || response?.success === true;
          if (isSuccess && response?.data?.soapNote) {
            this.patientTreatmentId = Number(
              response?.data?.patientTreatmentId ||
              response?.data?.soapNote?.patientTreatmentId ||
              this.patientTreatmentId ||
              0
            );
            this.applySoapNoteState({
              ...(response.data.soapNote as SoapNote),
              patientTreatmentId: this.patientTreatmentId
            });
            return;
          }

          this.hasError = true;
          this.gs.showError(response?.message || 'Unable to load SOAP note details.');
          this.patientTreatmentId = Number(this.soapNoteInput?.patientTreatmentId || this.patientTreatmentId || 0);
          this.applySoapNoteState(this.soapNoteInput || null);
        },
        error: () => {
          this.hasError = true;
          this.gs.showError('Unable to load SOAP note details.');
          this.patientTreatmentId = Number(this.soapNoteInput?.patientTreatmentId || this.patientTreatmentId || 0);
          this.applySoapNoteState(this.soapNoteInput || null);
        }
      });
  }

  private safeParseAllergies(json?: string | null): any[] {
    if (!json) return [];
    try {
      const arr = JSON.parse(json);
      return Array.isArray(arr) ? arr : [];
    } catch {
      return [];
    }
  }

  private setupCanvas(): void {
    if (!this.canEdit || !this.sigCanvas) return;
    this.ctx = this.sigCanvas.nativeElement.getContext('2d', { willReadFrequently: true });
    this.resizeCanvas();
    if (!this.ctx) return;
    this.ctx.lineWidth = 2;
    this.ctx.lineCap = 'round';
    this.ctx.lineJoin = 'round';
    this.ctx.strokeStyle = '#111827';
    this.hasInk = false;
  }

  private resizeCanvas(): void {
    if (!this.canEdit || !this.sigCanvas) return;
    const canvas = this.sigCanvas.nativeElement;
    const parent = canvas.parentElement;
    if (!parent) return;

    const rect = parent.getBoundingClientRect();
    const ratio = window.devicePixelRatio || 1;
    const height = 180;
    canvas.width = Math.floor(rect.width * ratio);
    canvas.height = Math.floor(height * ratio);
    canvas.style.width = `${rect.width}px`;
    canvas.style.height = `${height}px`;

    if (this.ctx) {
      this.ctx.setTransform(1, 0, 0, 1, 0, 0);
      this.ctx.scale(ratio, ratio);

      this.ctx.fillStyle = '#ffffff';
      this.ctx.fillRect(0, 0, rect.width, height);
      this.ctx.fillStyle = '#000000';
    }
  }

  startSigDraw(evt: MouseEvent | TouchEvent): void {
    if (!this.canEdit || !this.ctx) return;
    this.drawing = true;
    const { x, y } = this.getCanvasPos(evt);
    this.lastX = x;
    this.lastY = y;
  }

  sigDraw(evt: MouseEvent | TouchEvent): void {
    if (!this.canEdit || !this.ctx || !this.drawing) return;
    evt.preventDefault();
    const { x, y } = this.getCanvasPos(evt);
    this.ctx.beginPath();
    this.ctx.moveTo(this.lastX, this.lastY);
    this.ctx.lineTo(x, y);
    this.ctx.stroke();
    this.lastX = x;
    this.lastY = y;
    this.hasInk = true;
  }

  endSigDraw(): void {
    if (!this.canEdit) return;
    this.drawing = false;
  }

  clearSignature(): void {
    if (!this.canEdit) return;
    this.setupCanvas();
    this.hasInk = false;
    this.cdr.markForCheck();
  }

  private getCanvasPos(evt: MouseEvent | TouchEvent): { x: number; y: number } {
    const canvas = this.sigCanvas?.nativeElement;
    if (!canvas) return { x: 0, y: 0 };

    const rect = canvas.getBoundingClientRect();

    if (evt instanceof MouseEvent) {
      return { x: evt.clientX - rect.left, y: evt.clientY - rect.top };
    }

    const te = evt as TouchEvent;
    const t =
      (te.touches && te.touches.length ? te.touches[0] : undefined) ??
      (te.changedTouches && te.changedTouches.length ? te.changedTouches[0] : undefined);

    const cx = (t?.clientX ?? 0) - rect.left;
    const cy = (t?.clientY ?? 0) - rect.top;
    return { x: cx, y: cy };
  }

  async saveSignature(): Promise<void> {
    if (!this.canEdit) return;
    const blob = this.getCanvasBlob();
    if (!blob) {
      this.gs.showError('Draw your signature first.');
      return;
    }

    this.signatureUploading = true;
    this.cdr.markForCheck();

    this.gs.uploadSignature(blob)
      .pipe(finalize(() => { this.signatureUploading = false; this.cdr.markForCheck(); }))
      .subscribe({
        next: (res: ApiResponse<{ fileName: string; relativePath: string; url: string }>) => {
          if (res?.data) {
            this.uploadedSignaturePath = res.data.relativePath;
            this.uploadedSignatureUrl = res.data.url;
            this.reSigning = false;
            this.signatureUpdated = true;
            this.gs.showSuccess('Signature saved.');
          } else {
            this.gs.showError(res?.message || 'Failed to save signature.');
          }
        },
        error: (err) => {
          this.gs.showError(err?.message || 'Network error while saving signature.');
        }
      });
  }

  private async maybeUploadSignatureBeforeSave(): Promise<void> {
    if (!this.canEdit || !this.reSigning || !this.hasInk) return;
    const blob = this.getCanvasBlob();
    if (!blob) return;

    this.signatureUploading = true;
    this.cdr.markForCheck();
    try {
      const res = await firstValueFrom(this.gs.uploadSignature(blob));
      if (res?.data) {
        this.uploadedSignaturePath = res.data.relativePath;
        this.uploadedSignatureUrl = res.data.url;
        this.reSigning = false;
        this.signatureUpdated = true;
      } else {
        this.gs.showError(res?.message || 'Failed to save signature.');
      }
    } catch (e: any) {
      this.gs.showError(e?.message || 'Network error while saving signature.');
    } finally {
      this.signatureUploading = false;
      this.cdr.markForCheck();
    }
  }

  private getCanvasBlob(): Blob | null {
    if (!this.sigCanvas) return null;
    const dataUrl = this.sigCanvas.nativeElement.toDataURL('image/png');
    return this.dataURLtoBlobSafe(dataUrl);
  }

  private dataURLtoBlobSafe(dataUrl: string): Blob | null {
    try {
      if (!dataUrl) return null;
      const parts = dataUrl.split(',');
      if (parts.length < 2) return null;

      const header = parts[0] ?? '';
      const base64 = parts[1] ?? '';
      const mimeMatch = header.match(/data:(.*?);base64/);
      const mime = mimeMatch?.[1] ?? 'image/png';

      const binary = atob(base64);
      const len = binary.length;
      const bytes = new Uint8Array(len);
      for (let i = 0; i < len; i++) bytes[i] = binary.charCodeAt(i);

      return new Blob([bytes], { type: mime });
    } catch {
      return null;
    }
  }

  startResign(): void {
    if (!this.canEdit) return;
    this.reSigning = true;
    this.hasInk = false;
    setTimeout(() => this.setupCanvas(), 0);
  }

  removeSignature(): void {
    if (!this.canEdit) return;
    this.uploadedSignaturePath = null;
    this.uploadedSignatureUrl = null;
    this.reSigning = true;
    this.hasInk = false;
    setTimeout(() => this.setupCanvas(), 0);
  }

  cancelResign(): void {
    if (!this.canEdit) return;
    this.reSigning = false;
  }

  get hasPrintableContent(): boolean {
    if (!this.form) return !!this.soapNote?.soapNoteId;
    const raw = this.form.getRawValue();
    const hasSoapText = ['subjective', 'objective', 'assessment', 'plan']
      .some((key) => String(raw?.[key] || '').trim().length > 0);
    const hasAllergyText = Array.isArray(raw?.allergies) &&
      raw.allergies.some((allergy: any) =>
        ['details', 'currentMedications', 'dosageWithUnits', 'frequency', 'additionalFrequencyDetail', 'reasons']
          .some((field) => String(allergy?.[field] || '').trim().length > 0)
      );
    return hasSoapText || hasAllergyText || !!this.uploadedSignatureUrl || !!this.soapNote?.soapNoteId;
  }

  printSoapNote(): void {
    if (!this.hasPrintableContent) {
      this.gs.showInfo('No SOAP note content available to print.');
      return;
    }
    const html = this.buildSoapPrintHtml();
    this.printHtmlInHiddenFrame(html);
  }

  private buildSoapPrintHtml(): string {
    const raw = this.form?.getRawValue?.() || {};
    const allergies = Array.isArray(raw?.allergies) ? raw.allergies : [];
    const printableAllergies = this.getPrintableAllergies(allergies);
    const patientName = this.resolvePatientNameForPrint();
    const signerName = this.soapNote?.signedBy || this.soapNote?.createdByName || this.auth.getUserName() || '--';
    const signedAtIso = this.soapNote?.signedAt || this.soapNote?.createdDate || null;
    const signedDate = this.formatDisplayDate(signedAtIso);
    const signedDateTime = this.formatDisplayDate(signedAtIso, true);
    const signatureUrl = this.uploadedSignatureUrl || this.soapNote?.signature || '';
    const soapNoteId = Number(this.soapNote?.soapNoteId || 0);
    const footerRef = soapNoteId > 0 ? `SOAP Note #${soapNoteId}` : `Treatment #${this.patientTreatmentId || '--'}`;

    const allergiesHtml = printableAllergies
      .map((allergy, index) => `
        <div class="allergy-entry">
          ${printableAllergies.length > 1 ? `<h3 class="allergy-entry-title">Allergy #${index + 1}</h3>` : ''}
          <div class="line-field">
            <div class="label">Details of allergies to medications, foods or other substances:</div>
            <div class="value">${this.formatMultilineForPrint(allergy.details)}</div>
          </div>
          <div class="line-field">
            <div class="label">Current medications:</div>
            <div class="value">${this.formatMultilineForPrint(allergy.currentMedications)}</div>
          </div>
          <div class="allergy-grid">
            <div class="line-field">
              <div class="label">Dosage with units:</div>
              <div class="value">${this.formatMultilineForPrint(allergy.dosageWithUnits)}</div>
            </div>
            <div class="line-field">
              <div class="label">Frequency:</div>
              <div class="value">${this.formatMultilineForPrint(allergy.frequency)}</div>
            </div>
            <div class="line-field">
              <div class="label">Additional frequency detail:</div>
              <div class="value">${this.formatMultilineForPrint(allergy.additionalFrequencyDetail)}</div>
            </div>
            <div class="line-field">
              <div class="label">Reason(s) for taking medication:</div>
              <div class="value">${this.formatMultilineForPrint(allergy.reasons)}</div>
            </div>
          </div>
        </div>
      `)
      .join('');

    const subjective = this.formatMultilineForPrint(raw?.subjective);
    const objective = this.formatMultilineForPrint(raw?.objective);
    const assessment = this.formatMultilineForPrint(raw?.assessment);
    const plan = this.formatMultilineForPrint(raw?.plan);
    const signatureHtml = signatureUrl
      ? `<img src="${this.escapeHtml(signatureUrl)}" alt="Signature" class="signature-image" />`
      : `<div class="signature-placeholder">No signature on file</div>`;

    return `
      <!doctype html>
      <html>
      <head>
        <meta charset="utf-8" />
        <title>SOAP Notes</title>
        <style>
          * { box-sizing: border-box; }
          html, body { margin: 0; padding: 0; }
          body {
            font-family: Arial, Helvetica, sans-serif;
            color: #1f2937;
            background: #ffffff;
            padding: 16px;
          }
          .sheet {
            max-width: 900px;
            margin: 0 auto;
          }
          .title {
            margin: 0;
            font-size: 28px;
            font-weight: 700;
            letter-spacing: 0.4px;
          }
          .meta-row {
            margin-top: 8px;
            display: flex;
            justify-content: space-between;
            align-items: center;
            font-size: 14px;
            color: #374151;
            border-bottom: 1px solid #e5e7eb;
            padding-bottom: 8px;
          }
          .section {
            margin-top: 12px;
            break-inside: auto;
            page-break-inside: auto;
          }
          .section-heading {
            font-size: 22px;
            font-weight: 700;
            margin: 0 0 8px;
          }
          .line-field {
            margin-top: 8px;
          }
          .line-field .label {
            font-size: 15px;
            color: #4b5563;
            margin-bottom: 3px;
            font-weight: 600;
          }
          .line-field .value {
            min-height: 24px;
            border-bottom: 1px solid #9ca3af;
            font-size: 14px;
            color: #111827;
            padding: 2px 0;
            white-space: pre-wrap;
            word-break: break-word;
          }
          .allergy-grid {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 0 20px;
          }
          .allergy-entry {
            break-inside: avoid-page;
            page-break-inside: avoid;
          }
          .allergy-entry + .allergy-entry {
            margin-top: 12px;
            padding-top: 10px;
            border-top: 1px dashed #9ca3af;
          }
          .allergy-entry-title {
            margin: 0 0 6px;
            font-size: 16px;
            font-weight: 700;
            color: #1f2937;
          }
          .soap-block .soap-line {
            margin-top: 10px;
          }
          .soap-label {
            font-size: 22px;
            font-weight: 700;
            margin: 0 0 4px;
          }
          .soap-value {
            min-height: 30px;
            font-size: 14px;
            line-height: 1.3;
            color: #111827;
            white-space: pre-wrap;
            word-break: break-word;
          }
          .signature-section,
          .signature-panel,
          .signature-panel-head,
          .signature-panel-body,
          .signed-note {
            break-inside: avoid-page;
            page-break-inside: avoid;
            -webkit-column-break-inside: avoid;
          }
          .signature-section {
            break-before: auto;
            page-break-before: auto;
          }
          .signature-panel {
            margin-top: 0;
            border: 1px solid #d1d5db;
            border-radius: 4px;
            overflow: hidden;
          }
          .signature-panel-head {
            display: flex;
            justify-content: space-between;
            align-items: center;
            background: #f9fafb;
            padding: 8px 12px;
            font-size: 15px;
            color: #6b7280;
          }
          .signature-panel-body {
            padding: 10px 12px;
          }
          .signature-image {
            max-height: 64px;
            max-width: 260px;
            display: block;
          }
          .signature-placeholder {
            font-size: 14px;
            color: #6b7280;
            font-style: italic;
          }
          .signed-note {
            margin-top: 8px;
            font-size: 13px;
            color: #4b5563;
          }
          .footer {
            margin-top: 12px;
            border-top: 1px solid #9ca3af;
            padding-top: 8px;
            font-size: 12px;
            color: #4b5563;
            display: flex;
            justify-content: space-between;
            align-items: center;
          }
          @media print {
            body {
              -webkit-print-color-adjust: exact;
              print-color-adjust: exact;
              padding: 0.4in;
            }
            .sheet {
              max-width: none;
            }
          }
        </style>
      </head>
      <body>
        <section class="sheet">
          <h1 class="title">SOAP NOTES</h1>
          <div class="meta-row">
            <div>${this.escapeHtml(patientName)}</div>
            <div>${this.escapeHtml(signedDate)}</div>
          </div>

          <section class="section">
            <h2 class="section-heading">2. Allergies:</h2>
            ${allergiesHtml}
          </section>

          <section class="section soap-block">
            <div class="soap-line">
              <h3 class="soap-label">3. Subjective:</h3>
              <div class="soap-value">${subjective}</div>
            </div>
            <div class="soap-line">
              <h3 class="soap-label">4. Objective:</h3>
              <div class="soap-value">${objective}</div>
            </div>
            <div class="soap-line">
              <h3 class="soap-label">5. Assessment:</h3>
              <div class="soap-value">${assessment}</div>
            </div>
            <div class="soap-line">
              <h3 class="soap-label">6. Plan:</h3>
              <div class="soap-value">${plan}</div>
            </div>
          </section>

          <section class="section signature-section">
            <div class="signature-panel">
              <div class="signature-panel-head">
                <span>e-signature</span>
                <span>${this.escapeHtml(signedDate)}</span>
              </div>
	              <div class="signature-panel-body">
	                ${signatureHtml}
	                <div class="signed-note">
	                  Signed by ${this.escapeHtml(signerName)} on ${this.escapeHtml(signedDateTime)}
	                </div>
	              </div>
	            </div>
	          </section>

          <div class="footer">
            <span>${this.escapeHtml(footerRef)}</span>
            <span>Page 1 of 1</span>
          </div>
        </section>
      </body>
      </html>
    `;
  }

  private getPrintableAllergies(allergies: any[]): Array<{
    details: string;
    currentMedications: string;
    dosageWithUnits: string;
    frequency: string;
    additionalFrequencyDetail: string;
    reasons: string;
  }> {
    const normalized = (Array.isArray(allergies) ? allergies : []).map((allergy) => ({
      details: String(allergy?.details || '').trim(),
      currentMedications: String(allergy?.currentMedications || '').trim(),
      dosageWithUnits: String(allergy?.dosageWithUnits || '').trim(),
      frequency: String(allergy?.frequency || '').trim(),
      additionalFrequencyDetail: String(allergy?.additionalFrequencyDetail || '').trim(),
      reasons: String(allergy?.reasons || '').trim()
    }));

    const withValues = normalized.filter((allergy) =>
      Object.values(allergy).some((value) => value.length > 0)
    );
    if (withValues.length) return withValues;

    const firstAllergy = normalized[0];
    if (firstAllergy) return [firstAllergy];

    return [{
      details: '',
      currentMedications: '',
      dosageWithUnits: '',
      frequency: '',
      additionalFrequencyDetail: '',
      reasons: ''
    }];
  }

  private formatMultilineForPrint(value: unknown): string {
    const text = String(value || '').trim();
    if (!text) return '&nbsp;';
    return this.escapeHtml(text).replace(/\r?\n/g, '<br />');
  }

  private formatDisplayDate(value: string | null | undefined, withTime = false): string {
    if (!value) return '--';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '--';
    const opts: Intl.DateTimeFormatOptions = withTime
      ? { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit', second: '2-digit' }
      : { month: 'short', day: 'numeric', year: 'numeric' };
    return new Intl.DateTimeFormat('en-US', opts).format(date);
  }

  private resolvePatientNameForPrint(): string {
    const inputName = String(this.patientNameInput || '').trim();
    if (inputName) return inputName;
    const fallbackName = String((this.soapNoteInput as any)?.patientName || '').trim();
    if (fallbackName) return fallbackName;
    return '--';
  }

  private escapeHtml(value: string): string {
    return value
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  private printHtmlInHiddenFrame(html: string): void {
    const iframe = document.createElement('iframe');
    iframe.style.position = 'fixed';
    iframe.style.right = '0';
    iframe.style.bottom = '0';
    iframe.style.width = '0';
    iframe.style.height = '0';
    iframe.style.border = '0';
    iframe.setAttribute('aria-hidden', 'true');
    iframe.setAttribute('tabindex', '-1');
    document.body.appendChild(iframe);

    const cleanup = () => {
      window.setTimeout(() => {
        if (iframe.parentNode) iframe.parentNode.removeChild(iframe);
      }, 0);
    };

    const frameWindow = iframe.contentWindow;
    const frameDocument = frameWindow?.document;
    if (!frameWindow || !frameDocument) {
      cleanup();
      this.gs.showError('Unable to initialize print preview.');
      return;
    }

    frameDocument.open();
    frameDocument.write(html);
    frameDocument.close();

    iframe.onload = () => {
      frameWindow.focus();
      frameWindow.print();
      frameWindow.onafterprint = cleanup;
      window.setTimeout(cleanup, 3000);
    };
  }

  async save(): Promise<void> {
    if (!this.canEdit) {
      this.gs.showInfo('View only — you do not have permission to edit.');
      return;
    }
    if (this.isSaving) return;

    await this.maybeUploadSignatureBeforeSave();

    const v = this.form.getRawValue();
    const payloadBase = {
      soapNoteId: this.soapNote?.soapNoteId || 0,
      subjective: v.subjective || '',
      objective: v.objective || '',
      assessment: v.assessment || '',
      plan: v.plan || '',
      allergiesJson: JSON.stringify(v.allergies || []),

      signaturePath: this.uploadedSignaturePath,
      signature: this.uploadedSignatureUrl,

      signedBy: this.soapNote?.signedBy || this.auth.getUserName() || null,
      signedAt: this.signatureUpdated ? new Date().toISOString() : (this.soapNote?.signedAt || new Date().toISOString()),
      status: this.soapNote?.status || 'Saved'
    };

    this.isSaving = true;
    this.cdr.markForCheck();

    const payload = {
      ...payloadBase,
      patientTreatmentId: this.patientTreatmentId
    };

    this.gs.saveTreatmentSoapNote(payload)
      .pipe(finalize(() => { this.isSaving = false; this.cdr.markForCheck(); }))
      .subscribe({
        next: (res) => {
          if (res?.status === 1 || res?.success) {
            const savedSoapNoteId = Number(res?.data || 0);
            this.soapNote = {
              ...(this.soapNote || {} as SoapNote),
              ...payload,
              soapNoteId: savedSoapNoteId
            };
            if (savedSoapNoteId > 0) {
              this.openSavedSoapNoteInParent(this.soapNote);
              this.refreshSavedSoapNoteDetails(savedSoapNoteId);
            }
            this.gs.showSuccess(res?.message || 'SOAP note saved.');
            this.refreshTreatmentDetailsInParent();
          } else {
            this.gs.showError(res?.message || 'Save failed.');
          }
        },
        error: (err) => {
          this.gs.showError(err?.message || 'Network error while saving.');
        }
      });
  }

  goBack(){
    if (this.embeddedInTabs) return;
    this.router.navigate(['/treatment/detail/', this.patientTreatmentId]);
  }

  private refreshTreatmentDetailsInParent(): void {
    if (!this.embeddedInTabs || !this.openInTreatmentTabs) return;
    this.openInTreatmentTabs({
      type: 'treatmentMain',
      data: {
        refreshTreatmentDetails: true,
        keepCurrentTab: true
      }
    });
  }

  private refreshSavedSoapNoteDetails(soapNoteId: number): void {
    if (!soapNoteId) return;
    this.gs.getTreatmentSoapNoteDetailsById(soapNoteId).subscribe({
      next: (response) => {
        const isSuccess = response?.status === 1 || response?.success === true;
        if (isSuccess && response?.data?.soapNote) {
          this.patientTreatmentId = Number(
            response?.data?.patientTreatmentId ||
            response?.data?.soapNote?.patientTreatmentId ||
            this.patientTreatmentId
          );
          const refreshedSoapNote = {
            ...(response.data.soapNote as SoapNote),
            patientTreatmentId: this.patientTreatmentId
          };
          this.applySoapNoteState(refreshedSoapNote);
          this.openSavedSoapNoteInParent(refreshedSoapNote);
        }
      },
      error: () => {

      }
    });
  }

  private openSavedSoapNoteInParent(soapNote: SoapNote | null): void {
    const soapNoteId = Number(soapNote?.soapNoteId || 0);
    if (!soapNoteId || !this.embeddedInTabs || !this.openInTreatmentTabs) return;
    this.openInTreatmentTabs({
      type: 'soapNote',
      id: soapNoteId,
      data: {
        ...(soapNote || {}),
        patientTreatmentId: Number(soapNote?.patientTreatmentId || this.patientTreatmentId || 0)
      }
    });
  }
}
