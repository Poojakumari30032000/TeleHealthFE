import { ChangeDetectionStrategy, Component } from '@angular/core';
import { Router } from '@angular/router';
import { AuthService } from 'app/shared/Auth/auth.service';

@Component({
  selector: 'app-error-page',
  templateUrl: './error-page.component.html',
  styleUrl: './error-page.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ErrorPageComponent {
  userRole: string | null = this.auth.getUserRole();

  constructor(
    private router: Router,
    private auth: AuthService
  ) {}

  navigate(type: string) {
    if(type === 'login'){
      this.router.navigate(['login']);
      return;
    }
    if(!this.userRole)return;
    const roleRoutes: Record<string, string> = {
      'Global Admin': '/dashboard/admin',
      'Clinic Admin': '/dashboard/clinic',
      'Provider': '/dashboard/provider',
      'Patient': '/dashboard/patient',
    };
    this.router.navigate([roleRoutes[this.userRole]]);
  }
}
