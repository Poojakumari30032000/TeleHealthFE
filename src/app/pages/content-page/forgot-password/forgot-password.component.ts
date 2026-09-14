import {ChangeDetectionStrategy, ChangeDetectorRef, Component, OnDestroy} from '@angular/core';
import { NgForm } from '@angular/forms';
import { Router } from '@angular/router';
import { GeneralService } from 'app/shared/services/general.service';
import { Subject, takeUntil } from 'rxjs';

interface ApiResponse {
  status: number;
  message: string;
  data?: any;
}

@Component({
  selector: 'app-forgot-password',
  templateUrl: './forgot-password.component.html',
  styleUrls: ['./forgot-password.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ForgotPasswordComponent implements OnDestroy {
  emailAddress: string = '';
  isLoading: boolean = false;
  errorMessage: string = '';
  private destroy$ = new Subject<void>();

  constructor(
    private router: Router,
    private generalService: GeneralService,
    private cdr: ChangeDetectorRef,
    ) {}

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  onLogin() {
    this.router.navigate(['login']);
  }

  onSubmit(form: NgForm) {
    if (form.invalid) {
      return;
    }
    this.isLoading = true;
    this.errorMessage = '';
    this.generalService.commonPost(`Accounts/forgotPassword`, { email: this.emailAddress })
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (response: ApiResponse) => {
          this.isLoading = false;
          if (response.status === 1) {
            this.isLoading = false;
            this.cdr.markForCheck();
            this.router.navigate(['login']);
            this.generalService.showSuccess(
              'Email sent successfully! Click on the link in your email to set a new password.'
            );
          } else {
            this.errorMessage = response.message || 'Failed to send reset link. Please try again.';
            this.isLoading = false;
            this.cdr.markForCheck();
          }
        },
        error: (err) => {
          this.isLoading = false;
          this.cdr.markForCheck();
          this.errorMessage = 'An error occurred. Please try again later.';
          console.error('Error sending reset link:', err);
        }
      });
  }
}
