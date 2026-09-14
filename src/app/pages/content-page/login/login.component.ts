import { ChangeDetectionStrategy, ChangeDetectorRef, Component, OnDestroy, OnInit, AfterViewInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { NzNotificationService } from 'ng-zorro-antd/notification';
import { Subject, takeUntil } from 'rxjs';

import { AuthService } from 'app/shared/Auth/auth.service';
import { ChatService } from 'app/chat/chat.service';

@Component({
  selector: 'app-login',
  templateUrl: './login.component.html',
  styleUrls: ['./login.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class LoginComponent implements OnInit, AfterViewInit, OnDestroy {
  loginForm: FormGroup;

  isLoading = false;
  passwordVisible = false;
  btnText = 'Login';

  introPlay = false;
  introHide = false;

  uiAnimate = false;

  private destroy$ = new Subject<void>();

  constructor(
    private fb: FormBuilder,
    private auth: AuthService,
    private router: Router,
    private notification: NzNotificationService,
    private cdr: ChangeDetectorRef,
    private chatService: ChatService
  ) {
    this.loginForm = this.fb.group({
      email: ['', [Validators.required, Validators.email]],
      password: ['', [Validators.required]],
      rememberMe: [false]
    });
  }

  ngOnInit(): void {
    const rememberedEmail = localStorage.getItem('rememberedEmail');
    if (rememberedEmail) {
      this.loginForm.patchValue({ email: rememberedEmail, rememberMe: true }, { emitEvent: false });
    }

    const token: string | null = localStorage.getItem('isolHealthToken');
    if (token) {
      const userRole = this.auth.getUserRole();
      if (userRole === 'Global Admin') this.router.navigate(['/dashboard/admin']);
      else if (userRole === 'Clinic Admin') this.router.navigate(['/dashboard/clinic']);
      else if (userRole === 'Provider') this.router.navigate(['/dashboard/provider']);
      else if (userRole === 'Patient') this.router.navigate(['/dashboard/patient']);
    }
  }

  ngAfterViewInit(): void {
    const reduceMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches ?? false;

    if (reduceMotion) {
      this.uiAnimate = true;
      this.introHide = true;
      this.cdr.markForCheck();
      return;
    }

    requestAnimationFrame(() => {
      this.introPlay = true;
      this.cdr.markForCheck();

      window.setTimeout(() => {
        this.uiAnimate = true;
        this.cdr.markForCheck();
      }, 900);
    });
  }

  onIntroAnimationEnd(e: AnimationEvent): void {
    console.log(e);

    this.introHide = true;
    this.cdr.markForCheck();
  }

  submitForm(): void {
    this.isLoading = true;
    this.btnText = 'Loading';
    this.cdr.markForCheck();

    if (this.loginForm.invalid) {
      this.validateFormFields();
      this.resetButtonState();
      return;
    }

    const { email, password, rememberMe } = this.loginForm.value;
    this.handleRememberMe(email, rememberMe);

    this.auth
      .login(email, password)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (res) => this.handleLoginSuccess(res),
        error: (err) => this.handleLoginError(err)
      });
  }

  togglePasswordVisibility(): void {
    this.passwordVisible = !this.passwordVisible;
    this.cdr.markForCheck();
  }

  private handleRememberMe(email: string, rememberMe: boolean): void {
    if (rememberMe) localStorage.setItem('rememberedEmail', email);
    else localStorage.removeItem('rememberedEmail');
  }

  private validateFormFields(): void {
    Object.values(this.loginForm.controls).forEach((control) => {
      if (control.invalid) {
        control.markAsDirty();
        control.updateValueAndValidity({ onlySelf: true });
      }
    });
  }

  private handleLoginSuccess(response: any): void {
    if (response?.status !== 1) {
      this.notification.warning(response?.message || 'Login failed.', '');
      this.resetButtonState();
      return;
    }

    const newUserId = this.auth.getUserId() || 0;
    if (this.auth.hasUserChanged(newUserId)) {
      this.chatService.clearAllData();
    }

    const roleRoutes: Record<string, string> = {
      'Global Admin': '/dashboard/admin',
      'Clinic Admin': '/dashboard/clinic',
      'Provider': '/dashboard/provider',
      'Patient': '/dashboard/patient',
      'Tech Support': '/globalAdminTickets'
    };

    const queryParams = this.router.parseUrl(this.router.url).queryParams;
    const userRole = this.auth.getUserRole() || '';

    const returnUrl: string =
      (typeof queryParams['returnUrl'] === 'string' && queryParams['returnUrl'].trim().length > 0)
        ? queryParams['returnUrl']
        : (roleRoutes[userRole] ?? '/');

    const cleanUrl: string = returnUrl.split('?')[0] || '/';

    this.notification.success(response?.message || 'Login successful.', '');

    this.chatService.startConnection().catch((error) => {
      console.error('LoginComponent: Failed to initialize chat connection', error);
    });

    this.router.navigateByUrl(cleanUrl, {
      replaceUrl: true,
      state: { preserveQueryParams: !!queryParams['returnUrl'] }
    });

    this.resetButtonState();
  }

  private handleLoginError(error: any): void {
    const errorMessage = error?.error?.message || 'Login failed. Please try again.';
    this.notification.error(errorMessage, '');
    this.resetButtonState();
  }

  private resetButtonState(): void {
    this.btnText = 'Login';
    this.isLoading = false;
    this.cdr.markForCheck();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }
}
