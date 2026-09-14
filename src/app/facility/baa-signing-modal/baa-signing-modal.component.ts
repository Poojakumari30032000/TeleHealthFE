import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  EventEmitter,
  Output,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { NzModalModule } from 'ng-zorro-antd/modal';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzInputModule } from 'ng-zorro-antd/input';
import { GeneralService } from 'app/shared/services/general.service';
import { AuthService } from 'app/shared/Auth/auth.service';
import { SignaturePadComponent } from 'app/shared/signature-pad/signature-pad.component';

@Component({
  selector: 'app-baa-signing-modal',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    NzModalModule,
    NzButtonModule,
    NzInputModule,
    SignaturePadComponent,
  ],
  templateUrl: './baa-signing-modal.component.html',
  styleUrl: './baa-signing-modal.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class BaaSigningModalComponent {

  @Output() signed = new EventEmitter<void>();

  signerName = '';
  signerRole = '';
  signatureUrl: string | null = null;
  submitting = false;
  showSignatureError = false;

  readonly todayLabel: string;

  readonly coveredEntityName = 'HEALTH ENTERPRISE LLC';
  readonly coveredEntitySigner = 'Joshua Thompson';
  readonly coveredEntityRole = 'CEO';
  readonly coveredEntityEsignId = '64dab069db0cc2660932d77a';
  readonly businessAssociateName = 'TelehealthUS';

  constructor(
    private generalService: GeneralService,
    private auth: AuthService,
    private router: Router,
    private cdr: ChangeDetectorRef,
  ) {
    this.todayLabel = new Date().toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  }

  onSignatureChange(url: string | null): void {
    this.signatureUrl = url;
    if (url) {
      this.showSignatureError = false;
    }
    this.cdr.markForCheck();
  }

  get canSubmit(): boolean {
    return (
      !!this.signerName.trim() &&
      !!this.signerRole.trim() &&
      !!this.signatureUrl &&
      !this.submitting
    );
  }

  submit(): void {
    if (this.submitting) return;

    if (!this.signerName.trim() || !this.signerRole.trim()) {
      this.generalService.showError('Please enter your name and role.');
      return;
    }
    if (!this.signatureUrl) {
      this.showSignatureError = true;
      this.generalService.showError('Please draw and save your signature before continuing.');
      this.cdr.markForCheck();
      return;
    }

    this.submitting = true;
    this.cdr.markForCheck();

    this.generalService
      .signBaa({
        signerName: this.signerName.trim(),
        signerRole: this.signerRole.trim(),
        signatureUrl: this.signatureUrl,
      })
      .subscribe({
        next: (res: any) => {

          if (res?.data?.isBaaSigned === true) {
            this.generalService.showSuccess('Business Associate Agreement signed.');
            this.submitting = false;
            this.signed.emit();
          } else {
            this.generalService.showError(res?.message || 'Could not sign the agreement. Please try again.');
            this.submitting = false;
          }
          this.cdr.markForCheck();
        },
        error: (err: any) => {
          this.generalService.showError(err?.error?.message || 'Could not sign the agreement. Please try again.');
          this.submitting = false;
          this.cdr.markForCheck();
        },
      });
  }

  logout(): void {
    this.auth.logout();
    this.router.navigate(['login']);
  }
}
