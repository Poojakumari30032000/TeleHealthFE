import { ChangeDetectionStrategy, Component, OnDestroy, OnInit } from '@angular/core';
import { NgForm } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { GeneralService } from 'app/shared/services/general.service';
import { Subject, takeUntil } from 'rxjs';

interface ApiResponse {
  status: number;
  message: string;
  data?: any;
}

@Component({
  selector: 'app-reset-password',
  templateUrl: './reset-password.component.html',
  styleUrl: './reset-password.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ResetPasswordComponent implements OnInit, OnDestroy {
  newPasswordVisible: boolean = false;
  confirmPasswordVisible: boolean = false;
  newPassword: string = '';
  confirmPassword: string = '';
  resetCode: string | null = null;
  isLoading: boolean = false;
  errorMessage: string = '';
  private destroy$ = new Subject<void>();

  constructor(private router: Router, private route: ActivatedRoute, private generalService: GeneralService) {}

  ngOnInit(): void{
    this.route.queryParamMap.pipe(takeUntil(this.destroy$)).subscribe(params =>{
      this.resetCode = params.get('code');
      if (!this.resetCode){
        this.generalService.showError('Reset code is missing in the URL');
        this.router.navigate(['login']);
      }
    })
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  onLogin() {
    this.router.navigate(['login']);
  }

  toggleNewPasswordVisibility(): void {
    this.newPasswordVisible = !this.newPasswordVisible;
  }
  toggleConfirmPasswordVisibility(): void {
    this.confirmPasswordVisible = !this.confirmPasswordVisible;
  }

  onSubmit(form: NgForm) {
    if (this.newPassword !== this.confirmPassword) {
    this.errorMessage = 'Passwords do not match';
    return;
  }
    if (form.invalid) {
      return;
    }
    this.isLoading = true;
    this.errorMessage = '';
    this.generalService.commonPost(`Accounts/changePassword`,
      {
        newPassword: this.newPassword,
        confirmNewPassword: this.confirmPassword,
        code: this.resetCode
      })
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (response: ApiResponse) => {
          this.isLoading = false;
          if (response.status === 1) {
            this.router.navigate(['login']);
            this.generalService.showSuccess(
              'Password Changed.'
            );
          } else {
            this.errorMessage = response.message || 'Failed to Change Password. Please try again.';
          }
        },
        error: (err) => {
          this.isLoading = false;
          this.errorMessage = 'An error occurred. Please try again later.';
          console.error('Error Changing Password:', err);
        }
      });
  }

}
