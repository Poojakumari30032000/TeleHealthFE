import {
  Component,
  ElementRef,
  Renderer2,
  OnDestroy,
  OnInit,
  HostListener,
  ChangeDetectorRef,
  ChangeDetectionStrategy,
  AfterViewInit,
  ViewChild,
  computed,
} from '@angular/core';
import { Router, RouterLink, RouterLinkActive } from '@angular/router';
import { SidebarService } from '../../../shared/services/sidebar.service';
import { sidebarMenu, MenuItem } from './sidebar-data';
import { NzModalModule, NzModalRef, NzModalService } from 'ng-zorro-antd/modal';
import { AuthService } from '../../../shared/Auth/auth.service';
import { BrandingService } from 'app/branding/branding.service';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import { NzLayoutModule } from 'ng-zorro-antd/layout';
import { NzMenuModule } from 'ng-zorro-antd/menu';
import { CommonModule } from '@angular/common';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzSelectModule } from 'ng-zorro-antd/select';
import { FormsModule } from '@angular/forms';
import { GeneralService } from 'app/shared/services/general.service';

import { CommanFormModalComponent } from 'app/shared/comman-form-modal/comman-form-modal.component';
import { SharedModule } from 'app/shared/shared.module';
import { QuestionnaireModule } from 'app/questionnaire/questionnaire.module';
import { NavigationEnd } from '@angular/router';
import { filter } from 'rxjs/operators';
import { ChatService } from 'app/chat/chat.service';
import { BaaSigningModalComponent } from 'app/facility/baa-signing-modal/baa-signing-modal.component';

@Component({
  selector: 'app-sidebar',
  standalone: true,
  imports: [
    NzLayoutModule,
    NzMenuModule,
    RouterLink,
    RouterLinkActive,
    CommonModule,
    NzButtonModule,
    NzSelectModule,
    FormsModule,
    NzModalModule,
    SharedModule,
    QuestionnaireModule,
    BaaSigningModalComponent
  ],
  templateUrl: './sidebar.component.html',
  styleUrl: './sidebar.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SidebarComponent implements OnInit,AfterViewInit,OnDestroy {
  @ViewChild('commanModel', { static: false }) commanModel!: CommanFormModalComponent;
  menuItems: MenuItem[] = [];
  sidebarCollapsed = false;
  private readonly lgBreakpoint = 1024;
  private unlistenClickEvents!: () => void;
  confirmModal?: NzModalRef;
  userRole: string | null = this.auth.getUserRole() || '';
  private destroy$ = new Subject<void>();

  selectedFacility = {
    facilityId: '',
    titlelong: '',
    titleshort: '',
    guid: '',
    organizationId: 0,
    organizationName: ''
  };
  facilitiesLoading: boolean = false;
  facilities: any[] = [];

    modalApiUrl : { save?: string; get?: string } = {
    save : '',
    get : ''
  };

  questionnaireVisible: boolean = false;
  welcomeVisible = false;
  baaModalVisible = false;
  private pendingAfterWelcome: 'signup' | 'questionnaire' | null = null;
  isDarkTheme: boolean = false;
  readonly darkLogoutButtonStyles = {
    background: 'rgba(11, 18, 32, 0.92)',
    borderColor: 'rgba(71, 85, 105, 0.85)',
    color: '#e2e8f0',
    boxShadow: 'none'
  };

  customModalParams : {dontShowCancel: boolean} = {
    dontShowCancel:false,
  }

  totalUnreadMessages = computed(() => {
    const onlineUsers = this.chatService.onlineUsers();
    const chatChannels = this.chatService.chatChannels();

    const directMessagesCount = onlineUsers.reduce((total, user) => total + (user.unreadCount || 0), 0);
    const channelsCount = chatChannels.reduce((total, channel) => total + (channel.unreadCount || 0), 0);
    return directMessagesCount + channelsCount;
  });

  private firstUseArgs:
    | { title: string; formPath: string; id: number; facilityId: number }
    | null = null;

  constructor(
    private router: Router,
    private sidebarService: SidebarService,
    private renderer: Renderer2,
    private elementRef: ElementRef,
    private modal: NzModalService,
    private cdr: ChangeDetectorRef,
    private auth: AuthService,
    private brandingService: BrandingService,
    private generalService: GeneralService,
    private chatService: ChatService

  ) {}

  ngOnInit() {
    this.isDarkTheme = localStorage.getItem('theme') === 'dark';

    this.menuItems = (this.userRole && sidebarMenu[this.userRole]) || [];
    const raw = (this.userRole && sidebarMenu[this.userRole]) || [];
    this.menuItems = this.userRole === 'Clinic Admin' ? JSON.parse(JSON.stringify(raw)) : raw;

    this.syncOpenStateToActiveRoute();

    if (this.userRole === 'Clinic Admin') {
      this.applyClinicAdminPaymentModeFilter();
    }

    this.router.events
      .pipe(
        filter((e): e is NavigationEnd => e instanceof NavigationEnd),
        takeUntil(this.destroy$)
      )
      .subscribe(() => {
        this.syncOpenStateToActiveRoute();
      });

    this.getClinics();

    if(this.userRole === 'Patient'){

    this.prepareFirstLogin();

     }

    if (this.userRole === 'Clinic Admin') {
      const userData = JSON.parse(localStorage.getItem('userData') ?? 'null');
      this.baaModalVisible = userData?.isBaaSigned !== true;
    }

    this.unlistenClickEvents = this.renderer.listen(
      'document',
      'click',
      (event: MouseEvent) => {
        this.handleOutsideClick(event);
      }
    );

    this.toggleSidebar(window.innerWidth);

    this.sidebarService.collapsed$
      .pipe(takeUntil(this.destroy$))
      .subscribe((collapsed) => {
        this.sidebarCollapsed = collapsed;
        this.cdr.markForCheck();
      });

    this.generalService
      .getData()
      .pipe(takeUntil(this.destroy$))
      .subscribe((event) => {
        if (event?.type === 'themeChanged') {
          this.isDarkTheme = event?.value === 'dark';
          this.cdr.markForCheck();
        }
      });
  }

  ngAfterViewInit() {
    if (this.userRole === 'Patient') {

      if (this.firstUseArgs && this.commanModel?.showModal && !this.welcomeVisible) {
        queueMicrotask(() => {
          const { title, formPath, id, facilityId } = this.firstUseArgs!;
          this.commanModel.showModal(title, 'form', formPath, id, facilityId);
          this.cdr.detectChanges();
        });
      }
    }
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
        this.cdr.markForCheck();
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
      this.cdr.markForCheck();
    } else {
      this.sidebarCollapsed = !this.sidebarCollapsed;
      console.log(
        'this.sidebarCollapsed = !this.sidebarCollapsed',
        this.sidebarCollapsed
      );
      this.cdr.markForCheck();
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

  private prepareFirstLogin() {
    const userData = JSON.parse(localStorage.getItem('userData') ?? 'null');
    const isFirstUse: boolean = !!userData?.isFirstUse;
    const patientId: number = Number(userData?.patientId ?? 0);

    if (isFirstUse) {
      this.modalApiUrl = {
        save: 'Patients/savePatient',
        get: 'Patients/getPatientById?Id='
      };
      const selectedFacilityId = Number(localStorage.getItem('FOS') ?? 0);
      this.firstUseArgs = {
        title: 'Complete the Sign Up process',
        formPath: 'patient/add-edit-patient-form.json',
        id: patientId,
        facilityId: selectedFacilityId
      };

      this.welcomeVisible = true;
      this.pendingAfterWelcome = 'signup';
    } else if (userData?.isFirstQuestionaire === true) {

      this.welcomeVisible = true;
      this.pendingAfterWelcome = 'questionnaire';
      this.firstUseArgs = null;
    } else {
      this.firstUseArgs = null;
    }
  }

  onWelcomeDismissed(): void {
    this.welcomeVisible = false;

    if (this.pendingAfterWelcome === 'signup' && this.firstUseArgs && this.commanModel?.showModal) {
      const { title, formPath, id, facilityId } = this.firstUseArgs;
      queueMicrotask(() => {
        this.commanModel.showModal(title, 'form', formPath, id, facilityId);
        this.cdr.detectChanges();
      });
    } else if (this.pendingAfterWelcome === 'questionnaire') {
      this.questionnaireVisible = true;
    }

    this.pendingAfterWelcome = null;
    this.cdr.markForCheck();
  }

  closeQuestForm(){
    this.questionnaireVisible = false

    let userDataString = localStorage.getItem('userData');
    let userData = userDataString ? JSON.parse(userDataString) : null;

    userData.isFirstQuestionaire = false;

    localStorage.setItem('userData', JSON.stringify(userData));
     this.cdr.markForCheck();
  }

  onBaaSigned(): void {
    this.baaModalVisible = false;

    const userDataString = localStorage.getItem('userData');
    const userData = userDataString ? JSON.parse(userDataString) : null;
    if (userData) {
      userData.isBaaSigned = true;
      localStorage.setItem('userData', JSON.stringify(userData));
    }
    this.cdr.markForCheck();
  }

  private applyClinicAdminPaymentModeFilter(): void {
    const facilityId = this.auth.getUserFacilityId();
    if (facilityId == null) {

      this.removeStripeOnlyItemsFromInvoicing();
      this.cdr.markForCheck();
      return;
    }
    this.generalService
      .commonGet(`Facilities/getFacilityPaymentMode?id=${facilityId}`)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (res) => {
          const data = res?.data ?? res;
          const paymentModeId = data?.paymentModeId != null ? Number(data.paymentModeId) : 1;
          const isStripeMode = paymentModeId === 2 || paymentModeId === 3;

          if (!isStripeMode) {
            this.removeStripeOnlyItemsFromInvoicing();
          }

          if (isStripeMode) {
            this.removePaymentMethodsFromBilling();
          }
          this.syncOpenStateToActiveRoute();
          this.cdr.markForCheck();
        },
        error: () => {

          this.removeStripeOnlyItemsFromInvoicing();
          this.syncOpenStateToActiveRoute();
          this.cdr.markForCheck();
        },
      });
  }

  private removeStripeOnlyItemsFromInvoicing(): void {
    const invoicing = this.menuItems.find((m) => m.title === 'Invoicing');
    if (invoicing?.children) {
      const stripeOnlyTitles = new Set(['Stripe', 'Payment Dashboard']);
      invoicing.children = invoicing.children.filter((c) => !stripeOnlyTitles.has(c.title));
    }
  }

  private removePaymentMethodsFromBilling(): void {
    const billing = this.menuItems.find((m) => m.title === 'Billing');
    if (billing?.children) {
      billing.children = billing.children.filter((c) => c.title !== 'Payment Methods');
    }
  }

  getClinics(){

  let userDataString = localStorage.getItem('userData');
  let userData = userDataString ? JSON.parse(userDataString) : null;
  let userID: string = userData?.userId ?? '';
  let userRole: string = userData?.roleName ?? '';

  if(userRole === 'Provider'){
    this.generalService.commonGet(`DropDowns/GetAllFacilitiesbyProviderId?Id=${userID}`).pipe(takeUntil(this.destroy$)).subscribe({
      next: (response) => {
        if (response?.status === 1 && response?.data) {
           this.facilities = response?.data || [];
          localStorage.setItem('FOS', this.facilities[0].facilityId );
          localStorage.setItem('FOSG', this.facilities[0].guid );

          this.selectedFacility = this.facilities[0];

          this.cdr.markForCheck();
          return;
        }
      }
    });
    }
  }

  onSubmenuOpenChange(target: MenuItem, open: boolean, parent?: MenuItem): void {
    if (open) {

      const siblings = parent?.children ?? this.menuItems;
      siblings.forEach((m) => {
        if (m !== target) this.closeRecursively(m);
      });

      target.open = true;
    } else {

      this.closeRecursively(target);
    }

    this.cdr.markForCheck();
  }

  private closeRecursively(node: MenuItem): void {
    node.open = false;
    node.children?.forEach((c) => this.closeRecursively(c));
  }

  private syncOpenStateToActiveRoute(): void {

    this.menuItems.forEach((m) => this.closeRecursively(m));

    const openChain = (items: MenuItem[]): boolean => {
      for (const item of items) {
        if (item.route && this.isActive(item.route)) return true;

        if (item.children?.length) {
          const childHasActive = openChain(item.children);
          if (childHasActive) {
            item.open = true;
            return true;
          }
        }
      }
      return false;
    };

    openChain(this.menuItems);
    this.cdr.markForCheck();
  }

  refreshData() {

    let userDataString = localStorage.getItem('userData');
    let userData = userDataString ? JSON.parse(userDataString) : null;

    userData.isFirstUse = false;

    localStorage.setItem('userData', JSON.stringify(userData));
     this.cdr.markForCheck();

    if (userData.isFirstQuestionaire === true) {
      this.questionnaireVisible = true;
    }

  }

  logout(): void {

    console.log('SidebarComponent: Logout - clearing chat data');
    this.chatService.clearAllData();

    this.auth.logout();
    this.brandingService.resetBranding();
    this.router.navigate(['login']);
  }
}
