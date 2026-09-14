import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component, OnInit,
} from '@angular/core';
import { NzCollapseModule } from 'ng-zorro-antd/collapse';
import { NzCardModule } from 'ng-zorro-antd/card';
import {AuthService} from "../../shared/Auth/auth.service";

@Component({
  selector: 'app-doctor-portal-docs',
  standalone: true,
  imports: [
    NzCollapseModule,
    NzCardModule
  ],
  templateUrl: './doctor-portal-docs.component.html',
  styleUrl: './doctor-portal-docs.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DoctorPortalDocsComponent implements OnInit {

  activeSectionId = 'section-1';
  userRole = this.auth.getUserRole();

  constructor(
    private cdr: ChangeDetectorRef,
    private  auth: AuthService) {
  }

  ngOnInit() {

    this.userRole = this.auth.getUserRole();

  }

  scrollToSection(sectionId: string): void {

    this.activeSectionId = sectionId;
    this.cdr.markForCheck();

    setTimeout(() => {
      const element = document.getElementById(sectionId);
      if (!element) {
        return;
      }

      const yOffset = -80;
      const y =
        element.getBoundingClientRect().top +
        window.pageYOffset +
        yOffset;

      window.scrollTo({ top: y, behavior: 'smooth' });
    }, 0);
  }

}
