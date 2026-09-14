import { ChangeDetectionStrategy, ChangeDetectorRef, Component, OnDestroy, OnInit } from '@angular/core';
import { RouterOutlet } from '@angular/router';

import { NzLayoutModule } from 'ng-zorro-antd/layout';
import { GeneralService } from 'app/shared/services/general.service';
import { Subject, takeUntil } from 'rxjs';
import { BrandingService } from 'app/branding/branding.service';
import { SidebarComponent } from './sidebar/sidebar.component';
import { NavbarComponent } from './navbar/navbar.component';
import { OutletReloadService } from '../outlet-reload.service';
import { CommonModule } from '@angular/common';
import { ChatService } from 'app/chat/chat.service';

@Component({
  selector: 'app-full-layout',
  standalone: true,
  imports: [RouterOutlet, NzLayoutModule, SidebarComponent, NavbarComponent, CommonModule],
  templateUrl: './full-layout.component.html',
  styleUrl: './full-layout.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class FullLayoutComponent implements OnInit, OnDestroy {

  readonly orgId = Number(localStorage.getItem('OFL'));
  private destroy$ = new Subject<void>();
  isloading: boolean = true;

  constructor(
    public reload: OutletReloadService,
    private generalService: GeneralService,
    private brandingService: BrandingService,
    private cdr: ChangeDetectorRef,
    private chatService: ChatService
  ){
    this.generalService.getAllCities().pipe(takeUntil(this.destroy$)).subscribe();
    const userRole = this.brandingService.getUserRole();
    if(userRole === 'Provider')this.getClinics();

    this.brandingService.getBranding(true)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: () => {
          this.isloading = false;
          console.log('Branding initialized successfully');
          this.cdr.markForCheck();
        },
        error: (err) => {
          this.isloading = false;
          console.error('Failed to initialize branding', err);
          this.cdr.markForCheck();
        }
      });
  }

  ngOnInit(): void {
    if (!localStorage.getItem('isolHealthToken')) {
      return;
    }

    this.chatService.startConnection().catch((error) => {
      console.error('FullLayoutComponent: Failed to initialize chat connection', error);
    });
  }

  getClinics(){

  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

}
