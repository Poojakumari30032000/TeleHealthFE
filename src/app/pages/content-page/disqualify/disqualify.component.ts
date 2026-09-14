import { ChangeDetectionStrategy, Component } from '@angular/core';
import { Router } from '@angular/router';

@Component({
  selector: 'app-disqualify',
  templateUrl: './disqualify.component.html',
  styleUrl: './disqualify.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class DisqualifyComponent {
  constructor(private router: Router) {}

  onLogin() {
    this.router.navigate(['login']);
  }
}
