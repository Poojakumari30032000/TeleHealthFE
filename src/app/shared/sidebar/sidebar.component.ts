import {
  Component,
  ElementRef,
  Renderer2,
  OnDestroy,
  OnInit,
  HostListener,
  ChangeDetectorRef,
  ChangeDetectionStrategy,
  computed,
} from '@angular/core';
import { Router } from '@angular/router';
import { SidebarService } from '../services/sidebar.service';
import { sidebarMenu, MenuItem } from '../../layout/full-layout/sidebar/sidebar-data';
import { NzModalRef, NzModalService } from 'ng-zorro-antd/modal';
import { AuthService } from '../Auth/auth.service';
import { BrandingService } from 'app/branding/branding.service';
import { ChatService } from 'app/chat/chat.service';
import { GeneralService } from 'app/shared/services/general.service';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';

@Component({
  selector: 'app-sidebar',
  templateUrl: './sidebar.component.html',
  styleUrl: './sidebar.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class SidebarComponent implements OnInit, OnDestroy {

  menuItems: MenuItem[] = [];
  sidebarCollapsed = false;
  private readonly lgBreakpoint = 1024;
  private unlistenClickEvents!: () => void;
  confirmModal?: NzModalRef;
  userRole: string | null = this.auth.getUserRole() || '';
  private destroy$ = new Subject<void>();
  isDarkTheme: boolean = false;
  readonly darkLogoutButtonStyles = {
    background: 'rgba(11, 18, 32, 0.92)',
    borderColor: 'rgba(71, 85, 105, 0.85)',
    color: '#e2e8f0',
    boxShadow: 'none'
  };

  totalUnreadMessages = computed(() => {
    const onlineUsers = this.chatService.onlineUsers();
    const chatChannels = this.chatService.chatChannels();

    const directMessagesCount = onlineUsers.reduce((total, user) => total + (user.unreadCount || 0), 0);
    const channelsCount = chatChannels.reduce((total, channel) => total + (channel.unreadCount || 0), 0);
    return directMessagesCount + channelsCount;
  });

  constructor(
    private router: Router,
    private sidebarService: SidebarService,
    private renderer: Renderer2,
    private elementRef: ElementRef,
    private modal: NzModalService,
    private cdr: ChangeDetectorRef,
    private auth: AuthService,
    private brandingService: BrandingService,
    private chatService: ChatService,
    private generalService: GeneralService
  ) {}

  ngOnInit() {
    this.isDarkTheme = localStorage.getItem('theme') === 'dark';

    this.menuItems = (this.userRole && sidebarMenu[this.userRole]) || [];

    this.unlistenClickEvents = this.renderer.listen(
      'document',
      'click',
      (event: MouseEvent) => {
        this.handleOutsideClick(event);
      }
    );

    this.toggleSidebar(window.innerWidth);

    this.sidebarService.collapsed$.pipe(
      takeUntil(this.destroy$)
    ).subscribe((collapsed) => {
      this.sidebarCollapsed = collapsed;
      this.cdr.detectChanges();
    });

    this.generalService
      .getData()
      .pipe(takeUntil(this.destroy$))
      .subscribe((event) => {
        if (event?.type === 'themeChanged') {
          this.isDarkTheme = event?.value === 'dark';
          this.cdr.detectChanges();
        }
      });
  }

  @HostListener('window:resize', ['$event'])
  onResize(event: any) {
    this.toggleSidebar(event.target.innerWidth);
  }

  handleOutsideClick(event: MouseEvent) {
    if (window.innerWidth < this.lgBreakpoint) {
      const targetElement = event.target as HTMLElement;
      const sidebarElement = this.elementRef.nativeElement;
      const toggleButton = document.querySelector('.toggle-button');

      if (
        sidebarElement &&
        toggleButton &&
        !sidebarElement.contains(targetElement) &&
        !toggleButton.contains(targetElement) &&
        !this.sidebarCollapsed
      ) {
        this.sidebarCollapsed = true;
        this.cdr.detectChanges();
      }
    }
  }

  ngOnDestroy() {
    this.destroy$.next();
    this.destroy$.complete();
    if (this.unlistenClickEvents) {
      this.unlistenClickEvents();
    }
  }

  toggleSidebar(width?: number): void {
    if (width !== undefined) {
      this.sidebarCollapsed = width < this.lgBreakpoint;
      console.log('this.sidebarCollapsed', this.sidebarCollapsed);
      this.cdr.detectChanges();
    } else {
      this.sidebarCollapsed = !this.sidebarCollapsed;
      console.log(
        'this.sidebarCollapsed = !this.sidebarCollapsed',
        this.sidebarCollapsed
      );
      this.cdr.detectChanges();
    }
  }

  showMessageBadge(menu: MenuItem): boolean {
    return this.totalUnreadMessages() > 0 && this.isMessagesMenuItem(menu);
  }

  getMessageBadgeCount(): string {
    const count = this.totalUnreadMessages();
    return count > 99 ? '99+' : `${count}`;
  }

  private isMessagesMenuItem(menu: MenuItem): boolean {
    const title = (menu.title || '').trim().toLowerCase();
    const route = (menu.route || '').trim().toLowerCase();
    return title === 'messages' || route === 'chat' || route.endsWith('/chat');
  }

  isActive(route?: string): boolean {
    return route ? this.router.url === route : false;
  }

  isMessagesMenu(menu: MenuItem): boolean {
    return menu?.title === 'Messages' && (menu?.route === 'chat' || menu?.route === '/chat');
  }

  hasUnreadMessages = this.chatService.hasUnreadMessages;

  hasActiveChild(menu: MenuItem): boolean {
    if (menu.children) {
      return menu.children.some((child) =>
        child.route
          ? this.isActive(child.route) || this.hasActiveChild(child)
          : this.hasActiveChild(child)
      );
    }
    return false;
  }

  confirmLogout(event: MouseEvent): void {
    event.preventDefault();
    event.stopPropagation();

    this.confirmModal = this.modal.confirm({
      nzTitle: 'Are you sure you want to log out?',
      nzContent: 'You will be redirected to the login page.',
      nzOkText: 'Yes, Log Out',
      nzCancelText: 'Cancel',
      nzCentered: true,
      nzOnOk: () => this.logout(),
    });
  }

  logout(): void {

    console.log('SharedSidebarComponent: Logout - clearing chat data');
    this.chatService.clearAllData();

    this.auth.logout();
    this.brandingService.resetBranding();
    this.router.navigate(['login']);
  }
}
