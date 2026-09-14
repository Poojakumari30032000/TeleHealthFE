import { ChangeDetectionStrategy, Component } from '@angular/core';
import { Router } from '@angular/router';
import { AuthService } from 'app/shared/Auth/auth.service';

@Component({
  selector: 'app-thankyou',
  templateUrl: './thankyou.component.html',
  styleUrl: './thankyou.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ThankyouComponent {

  userRole: string | null = this.auth.getUserRole();

  constructor(
    private router: Router,
    private auth: AuthService
  ) {}

  navigate(url: string) {
    this.router.navigate([url]);
  }

}
