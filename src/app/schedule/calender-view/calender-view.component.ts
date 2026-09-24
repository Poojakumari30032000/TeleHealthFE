import { ChangeDetectorRef, Component, ViewChild, AfterViewInit, ChangeDetectionStrategy, Input } from '@angular/core';
import { FullCalendarComponent } from '@fullcalendar/angular';
import { CalendarOptions, MoreLinkArg } from '@fullcalendar/core';
import dayGridPlugin from '@fullcalendar/daygrid';
import timeGridPlugin from '@fullcalendar/timegrid';
import interactionPlugin from '@fullcalendar/interaction';
import { Router } from '@angular/router';
import { GeneralService } from '../../shared/services/general.service';
import listPlugin from '@fullcalendar/list';
import { Subject, takeUntil } from 'rxjs';
import { AuthService } from 'app/shared/Auth/auth.service';
import { HttpErrorResponse } from '@angular/common/http';
import { CommanFormModalComponent } from 'app/shared/comman-form-modal/comman-form-modal.component';

interface AppointmentDetailTab {
  key: string;
  title: string;
  appointmentId: number;
}

@Component({
  selector: 'app-calender-view',
  templateUrl: './calender-view.component.html',
  styleUrls: ['./calender-view.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class CalenderViewComponent implements AfterViewInit {

  @ViewChild('calendar') calendarComponent!: FullCalendarComponent;
  @ViewChild(CommanFormModalComponent) commanModel!: CommanFormModalComponent;
  @Input() asSelector: boolean = false;

  readonly calendarTabKey = 'calendar';
  activeTabKey = this.calendarTabKey;
  detailTabs: AppointmentDetailTab[] = [];

  activePopoverEventId: string | null = null;

  currentTitle: string = '';
  selectedView: string = 'dayGridMonth';
  facilityId: number = 0;
  readonly orgId = Number(localStorage.getItem('OFL'));
  currentDate: Date | null = null;
  currentView: 'month' | 'week' | 'day' = 'month';
  hideNames: boolean = false;
  isTodayDisabled: boolean = false;
  modalApiUrl : { save?: string; get?: string } = {
    save : 'Invoices/UpdateAppointmentStatus',
    get : ''
  };
  layoutMode: 'grid' | 'list' = 'grid';
  calendarOptions: CalendarOptions = {
    initialView: 'dayGridMonth',
    plugins: [dayGridPlugin, timeGridPlugin, interactionPlugin, listPlugin],
    headerToolbar: false,
    datesSet: this.updateToolbar.bind(this),
    slotEventOverlap: true,
    dayMaxEvents: false,
    dayMaxEventRows: false,
    nowIndicator: true,
    showNonCurrentDates: false,
    contentHeight: 'auto',
    slotDuration: '00:15:00',
    slotMinTime: '00:00:00',
    slotMaxTime: '24:00:00',
    eventMinHeight: 72,
    views: {
      dayGridMonth: {
        dayMaxEvents: false,
        dayMaxEventRows: false,
      },
      timeGridWeek: {
        slotEventOverlap: false,
        eventMinHeight: 72,
      },
      timeGridDay: {
        slotEventOverlap: false,
        eventMinHeight: 72,
      },
    },
    events: [],
    eventContent: () => {
      return { domNodes: [] };
    },
    eventClick: this.onEventClick.bind(this),
    moreLinkClick: (info: MoreLinkArg) => {
      this.handleMoreLinkClick(info);
      return "none";
    },
  };
  clickedEventDetails: any = null;
  moreEvents: any[] = [];
  isDrawerVisible: boolean = false;
  patientId: number = 0;
  providerId: number = 0;
  visitStatus: string = '';
  private destroy$ = new Subject<void>();
  isLoading: boolean = false;
  loadingProvider : boolean = false;
  loadingPatient : boolean = false;
  facilitiesLoading: boolean = false;
  patientData: Array<{patientId: number, patientName: string}> = [];
  providerData: Array<{providerId: number, name: string}> = [];
  facilities: Array<{facilityId: number, titlelong: string}> = [];
  userRole: string = '';
  showFilters: boolean = false;
  appliedFilters: any[] = [];

  showUpdateAppointmentModal: boolean = false;
  selectedStatus: string = '';
  selectedAppointmentId: number | null = null;
  isUpdatingAppointmentStatus: boolean = false;

  isCreateApptVisible = false;
  isSubmittingAppt = false;
  selectedCreateProviderId: number | null = null;

  userId: number = 0;

  providerPatients: Array<{ patientId: number; patientName: string; facilityId: number }> = [];
  loadingProviderPatients = false;
  selectedPatientId: number | null = null;
  selectedPatientFacilityId: number | null = null;

  treatments: Array<{ treatmentId: number; productId: number; bundleName: string; startDate: string }> = [];
  loadingTreatments = false;
  selectedTreatmentId: number | null = null;
  selectedTreatmentProductId: number | null = null;

  selectedDate: Date | null = null;
  formattedDate: string | null = null;

  slots: Array<{
    providerScheduledSlotId: number;
    slotDate: string;
    startTime: string;
    endTime: string;
    duration: number;
    providerId: number;
    facilityId: number | null;
    providerName: string;
  }> = [];
  loadingSlots = false;
  slotsError: string | null = null;
  selectedSlotId: number | null = null;

  disablePastDates = (current: Date): boolean => {
    if (!current) return false;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const date = new Date(current);
    date.setHours(0, 0, 0, 0);
    return date < today;
  };

  constructor(
    private cdr: ChangeDetectorRef,
    private route: Router,
    private generalService: GeneralService,
    private auth: AuthService
  ) {}

  ngOnInit(): void {
    this.userRole = this.auth.getUserRole() || '';
    this.userId = this.auth.getUserId() || 0;

    if (this.userRole === 'Clinic Admin') {

      this.facilityId = Number(this.auth.getUserFacilityId() || 0);
    }

    const userId = this.userId;

    if (this.userRole === 'Global Admin' || this.userRole === 'Provider') {
      this.getClinics();
    }

    if (this.userRole === 'Provider') {
      this.providerId = userId;
    } else if (this.userRole === 'Patient') {
      this.facilityId = Number(this.auth.getUserFacilityId() || 0);
      this.patientId = this.auth.getPatientId() || 0;
    }

    this.getAllPatient();
    this.getAllProvdiders();

    this.applyFilters();
  }
  async ngAfterViewInit(): Promise<void> {
    if (!this.calendarComponent) {
      console.log('!this.calendarComponent');
      return;
    }

    this.calendarOptions = {
      initialView: 'dayGridMonth',
      plugins: [dayGridPlugin, timeGridPlugin, interactionPlugin, listPlugin],
      headerToolbar: false,
      datesSet: this.updateToolbar.bind(this),
      slotEventOverlap: true,
      dayMaxEvents: 3,
      eventMaxStack: 1,
      nowIndicator: true,
      showNonCurrentDates: false,
      events: async (fetchInfo: any) => {
        try {
          return await this.handleFetchEvents(fetchInfo);
        } catch (error) {
          console.error('Error fetching events:', error);
          return [];
        }
      },
      eventContent: () => {
        return { domNodes: [] };
      },
      eventClick: this.onEventClick.bind(this),
      moreLinkClick: (info: MoreLinkArg) => {
        this.handleMoreLinkClick(info);
        return "none";
      },
      loading: (isLoading: boolean) => {
        this.isLoading = isLoading;
        this.cdr.detectChanges();
      }
    };
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  get visibleFiltersCount(): number {
    return this.appliedFilters.filter(f => !this.shouldHideAppliedFilter(f.name)).length;
  }

  private get isClinicAdminRole(): boolean {
    return this.userRole === 'Clinic Admin';
  }

  private get canFilterClinic(): boolean {
    return ['Global Admin', 'Provider'].includes(this.userRole);
  }

  private get effectiveFacilityId(): number {
    if (this.isClinicAdminRole) {
      const clinicFacilityId = Number(this.auth.getUserFacilityId() || 0);
      return clinicFacilityId || Number(this.facilityId || 0);
    }
    return Number(this.facilityId || 0);
  }

  applyFilters(type?: string) {
    if (this.isClinicAdminRole) {
      this.facilityId = this.effectiveFacilityId;
    }

    if (type === 'Clinic' && this.canFilterClinic) {
      this.patientId = 0;
      this.getAllPatient();
      if (this.userRole !== 'Provider') this.providerId = 0;
      this.getAllProvdiders();
    }

    this.appliedFilters = [
      ...(this.canFilterClinic ? [{ name: 'Clinic', value: this.facilityId }] : []),
      { name: 'Patient', value: this.patientId },
      { name: 'Provider', value: this.providerId },
      { name: 'Status', value: this.visitStatus }
    ].filter(item => item.value !== '' && item.value !== 0 && item.value !== null);

    this.calendarComponent?.getApi()?.refetchEvents();
  }

  shouldHideAppliedFilter(filterName: string): boolean {
    if (!filterName) return false;
    if (filterName === 'Clinic') {
      return !this.canFilterClinic;
    }
    if (this.userRole === 'Patient') {
      return filterName === 'Patient' || filterName === 'Provider';
    }
    if (this.userRole === 'Provider') {
      return filterName === 'Provider';
    }
    return false;
  }

  getFilterDisplayValue(filter: any): string {
    switch (filter.name) {
      case 'Patient':
        const optionPatient = this.patientData.find(opt => opt.patientId.toString() === filter.value?.toString());
        return optionPatient ? optionPatient.patientName : filter.value;
      case 'Provider':
        const optionProvider = this.providerData.find(opt => opt.providerId.toString() === filter.value?.toString());
        return optionProvider ? optionProvider.name : filter.value;
      case 'Clinic':
        const optionFacility = this.facilities.find(opt => opt.facilityId.toString() === filter.value?.toString());
        return optionFacility ? optionFacility.titlelong : filter.value;
      default:
        return filter.value;
    }
  }

  trackByFilterName(_index: number, filter: any): string {
    return filter.name;
  }

  clearFilters() {
    this.visitStatus = '';
    this.patientId = ['Patient'].includes(this.userRole) ? this.patientId : 0;
    this.providerId = ['Patient', 'Provider'].includes(this.userRole) ? this.providerId : 0;
    if (this.canFilterClinic) {
      this.facilityId = 0;
    } else if (this.isClinicAdminRole) {
      this.facilityId = this.effectiveFacilityId;
    }
    this.showFilters = false;
    this.applyFilters(this.canFilterClinic ? 'Clinic' : undefined);
  }

  removeFilter(filterName: string) {
    switch(filterName) {
      case 'Clinic':
        if (this.canFilterClinic) {
          this.facilityId = 0;
          this.applyFilters('Clinic');
          return;
        }
        return;
      case 'Status':
        this.visitStatus = '';
        break;
      case 'Patient':
        this.patientId = 0;
        break;
      case 'Provider':
        this.providerId = 0;
        break;
    }
    this.applyFilters();
  }

  private async handleFetchEvents(fetchInfo: any): Promise<any[]> {

    if(this.userRole != 'Provider'){
      if(!this.providerId){

    }
    }

    const data = await this.fetchDayEvents(fetchInfo.start, fetchInfo.end);
    return this.mapAppointmentsToEvents(data);
  }

  private async fetchDayEvents(startDate: Date, endDate: Date): Promise<any> {
    const formattedStart = startDate.toISOString().split('T')[0];
    const formattedEnd = endDate.toISOString().split('T')[0];
    const facilityId = this.effectiveFacilityId;

    let url =
      `PatientAppointments/getAllPatientAppointmentsByDays` +
      `?StartDate=${formattedStart}` +
      `&EndDate=${formattedEnd}`;

    if (facilityId) url += `&FacilityId=${facilityId}`;

    if (this.patientId) url += `&PatientId=${this.patientId}`;
    if (this.providerId) url += `&ProviderId=${this.providerId}`;
    if (this.visitStatus) url += `&Status=${this.visitStatus}`;
    url += `&ClientTimezoneOffsetMinutes=${-new Date().getTimezoneOffset()}`;

    try {
      const res = await this.generalService.commonGet(url).toPromise();
      return res?.data || [];
    } catch (error) {
      throw new Error('Failed to fetch day/week events');
    }
  }

  private getStatusColor(status: string): string {
    const s = (status || '').toLowerCase().trim();
    if (s === 'completed') return '#22c55e';
    if (s === 'missed') return '#ef4444';
    if (s === 'scheduled') return '#f6c343';
    return '#2d71fa';
  }

  private mapAppointmentsToEvents(appointments: any[]): any[] {
    return appointments.map(appointment => {

      const status = appointment.status || appointment.Status || appointment.appointmentStatus || appointment.visitStatus || appointment.appointmentStatusName || '';
      const color = this.getStatusColor(status);
      return {
        id: appointment.patientAppointmentSlotId,
        title: appointment.title || `${appointment.patientName} - ${appointment.categoryName}`,
        start: this.combineDateTime(appointment.startDate, appointment.startTime),
        end: this.combineDateTime(appointment.startDate, appointment.endTime),
        patientName: appointment.patientName || appointment.PatientName || '',
        providerName: appointment.providerName || appointment.ProviderName || '',
        clinicName: appointment.clinicName || appointment.ClinicName || '',
        categoryName: appointment.categoryName || appointment.CategoryName || '',
        status,
        duration: appointment.duration,
        allDay: false,
        backgroundColor: color,
        borderColor: color,
      };
    });
  }

  private combineDateTime(dateStr: string, timeStr: string): string {
    const slotDate = dateStr.split("T")[0];
    const date = `${slotDate}T${timeStr}`;
    return date;
  }

  private getAllPatient(): void{
    const facilityId = this.effectiveFacilityId;
    if (!facilityId || facilityId === 0) {
      this.patientData = [];
      this.loadingPatient = false;
      this.cdr.detectChanges();
      return;
    }
    this.loadingPatient = true;
    this.generalService.commonGet(`DropDowns/getAllPatients?FacilityId=${facilityId}`).pipe(takeUntil(this.destroy$)).subscribe({
      next : (response) =>{
        if(response.status === 1 && response.data){
          this.patientData = response.data;
        }
        this.loadingPatient = false;
        this.cdr.detectChanges();
      },
      error: (err) => {
        console.error(err);
        this.loadingPatient = false;
      }
    })
  }

  private getAllProvdiders(): void{
    this.loadingProvider = true;

    // A Clinic Admin may only ever see providers assigned to their own facility.
    // getAllProviders applies FacilityId only when IsAssign is supplied alongside it.
    const facilityId = this.isClinicAdminRole ? this.effectiveFacilityId : 0;
    const url = facilityId
      ? `DropDowns/getAllProviders?IsAssign=true&FacilityId=${facilityId}`
      : 'DropDowns/getAllProviders';

    this.generalService.commonGet(url).pipe(takeUntil(this.destroy$)).subscribe({
      next : (response) =>{
        if(response.status === 1 && response.data){
          this.providerData = response.data;
        }
        this.loadingProvider = false;
        this.cdr.detectChanges();
      },
      error: (err) => {
        console.error(err);
        this.loadingProvider = false;
      }
    })
  }

  getClinics(){
    if(this.userRole == 'Provider'){

          this.facilitiesLoading = true;
    this.facilities = [];
    this.generalService.commonGet(`DropDowns/GetAllFacilitiesbyProviderId?Id=${this.userId}`).pipe(takeUntil(this.destroy$)).subscribe({
      next: (response) => {
        if (response?.status === 1 && response?.data) {
          this.facilities = response?.data || [];
          this.facilitiesLoading = false;

          this.cdr.detectChanges();
          return;
        }
        this.facilities = [];
        this.facilitiesLoading = false;
        this.cdr.detectChanges();
      },
      error: (err: HttpErrorResponse) => {
        console.error('Failed to fetch categories:', err);
        this.facilities = [];
        this.facilitiesLoading = false;
        this.cdr.detectChanges();
      }
    });

    }
    else{
    this.facilitiesLoading = true;
    this.facilities = [];
    this.generalService.commonGet(`DropDowns/getAllFacilities?OrganizationId=${this.orgId}`).pipe(takeUntil(this.destroy$)).subscribe({
      next: (response) => {
        if (response?.status === 1 && response?.data) {
          this.facilities = response?.data || [];
          this.facilitiesLoading = false;

          this.cdr.detectChanges();
          return;
        }
        this.facilities = [];
        this.facilitiesLoading = false;
        this.cdr.detectChanges();
      },
      error: (err: HttpErrorResponse) => {
        console.error('Failed to fetch categories:', err);
        this.facilities = [];
        this.facilitiesLoading = false;
        this.cdr.detectChanges();
      }
    });
    }
  }

  trackByPatientId(_index: number, data: {patientId: number, patientName: string}): number {
    return data.patientId;
  }

  trackById(_index: number, data: {providerId: number, name: string}): number {
    return data.providerId;
  }

  onEventClick(info: any): void {
    console.log('Event Clicked:', info);
    if (info?.event) {
      this.clickedEventDetails = {
        id: info.event.id,
        title: info.event.title,
        start: info.event.start,
        end: info.event.end,
        color: info.event.backgroundColor,
        patientName: info.event.extendedProps?.patientName,
        providerName: info.event.extendedProps?.providerName,
        clinicName: info.event.extendedProps?.clinicName,
        categoryName: info.event.extendedProps?.categoryName,
        status: info.event.extendedProps?.status
      };
      console.log('Event clicked:', this.clickedEventDetails);
      console.log('info?.event', info?.event);
    } else {
      console.error('Invalid event data:', info);
    }
    this.cdr.markForCheck();
  }

  handleMoreLinkClick(info: any): void {
    this.moreEvents = info.allSegs.map((seg: any) => ({
      id: seg.event.id,
      title: seg.event.title,
      start: seg.event.start,
      end: seg.event.end,
      color: seg.event.backgroundColor,
      patientName: seg.event.extendedProps?.patientName,
      providerName: seg.event.extendedProps?.providerName,
      service: seg.event.extendedProps?.service
    }));
    this.isDrawerVisible = true;
    console.log('More Events:', this.moreEvents);
  }

  closeDrawer(): void {
    this.isDrawerVisible = false;
  }

  updateToolbar(info: any): void {
    const viewType = this.calendarComponent.getApi().view.type;
    this.currentView = viewType === 'dayGridMonth' ? 'month' :
                     viewType === 'timeGridWeek' ? 'week' : 'day';

    if (viewType === 'dayGridMonth' || viewType === 'timeGridWeek' || viewType === 'timeGridDay') {
      this.selectedView = viewType;
    }
    this.updateToolbarTitle(info);
    this.checkIfToday();
  }

  updateToolbarTitle(_info: any): void {
    setTimeout(() => {
      const calendarApi = this.calendarComponent.getApi();
      const view = calendarApi.view;

      if (view.type === 'timeGridWeek') {
        const startDate = new Date(view.currentStart);
        const endDate = new Date(view.currentEnd);
        endDate.setDate(endDate.getDate() - 1);

        const startDay = startDate.getDate().toString().padStart(2, '0');
        const startMonth = startDate.toLocaleString('default', { month: 'short' });
        const startYear = startDate.getFullYear();

        const endDay = endDate.getDate().toString().padStart(2, '0');
        const endMonth = endDate.toLocaleString('default', { month: 'short' });
        const endYear = endDate.getFullYear();

        if(startYear === endYear){
          this.currentTitle = (startMonth === endMonth)
          ? `${startDay} - ${endDay} ${endMonth} ${endYear}`
          : `${startDay} ${startMonth} - ${endDay} ${endMonth} ${endYear}`;
        }else{
          this.currentTitle = `${startDay} ${startMonth} ${startYear} - ${endDay} ${endMonth} ${endYear}`;
        }

      } else if (view.type === 'timeGridDay') {
        this.currentTitle = view.currentStart.toLocaleDateString('en-US', {
          weekday: 'long',
          month: 'long',
          day: 'numeric',
          year: 'numeric',
        });
      } else {
        this.currentTitle = view.title;
      }

      this.cdr.detectChanges();
    });
  }

  checkIfToday(): void {
    const calendarApi = this.calendarComponent.getApi();
    const currentDate = calendarApi.getDate();
    const today = new Date();
    this.isTodayDisabled = currentDate.toDateString() === today.toDateString();
    console.log('this.isTodayDisabled', this.isTodayDisabled);
    this.cdr.detectChanges();
  }

  goToPrevious(): void {
    const calendarApi = this.calendarComponent.getApi();
    calendarApi.prev();
    this.checkIfToday();
  }

  goToNext(): void {
    const calendarApi = this.calendarComponent.getApi();
    calendarApi.next();
    this.checkIfToday();
  }

  goToToday(): void {
    const calendarApi = this.calendarComponent.getApi();
    calendarApi.today();
    this.checkIfToday();
  }

  get currentRange(): 'month' | 'week' | 'day' {
    if (this.selectedView.includes('Month')) return 'month';
    if (this.selectedView.includes('Week')) return 'week';
    return 'day';
  }

  switchLayout(mode: 'grid' | 'list'): void {
    if (this.layoutMode === mode) return;

    this.layoutMode = mode;
    const newView = mode === 'grid'
      ? this.getGridView(this.currentRange)
      : this.getListView(this.currentRange);

    this.selectedView = this.getGridView(this.currentRange);
    this.calendarComponent.getApi().changeView(newView);
    this.cdr.detectChanges();
  }

  changeView(viewType: 'dayGridMonth' | 'timeGridWeek' | 'timeGridDay'): void {
    this.selectedView = viewType;
    this.cdr.markForCheck();
    let range: 'month' | 'week' | 'day';
    if (viewType === 'dayGridMonth') {
      range = 'month';
    } else if (viewType === 'timeGridWeek') {
      range = 'week';
    } else {
      range = 'day';
    }

    const view = this.layoutMode === 'grid'
      ? this.getGridView(range)
      : this.getListView(range);
    const api = this.calendarComponent.getApi();
    api.changeView(view);

    api.refetchEvents();
    this.cdr.detectChanges();
    this.checkIfToday();
  }

  private getGridView(range: string): string {
    return {
      month: 'dayGridMonth',
      week: 'timeGridWeek',
      day: 'timeGridDay'
    }[range] ?? 'timeGridWeek';
  }

  private getListView(range: string): string {
    return `list${range.charAt(0).toUpperCase()}${range.slice(1)}`;
  }

  navigateToApptView(id: number): void {
    const ID = Number(id || 0);
    if (!ID) {
      this.generalService.showError('Unable to Continue Appointment Id Not Found');
      return;
    }
    this.dismissEventPopover();
    this.openAppointmentDetailTab(ID);
  }

  private dismissEventPopover(): void {
    this.activePopoverEventId = null;
    this.cdr.markForCheck();
  }

  isPopoverOpen(eventId: string): boolean {
    return this.activePopoverEventId === eventId;
  }

  onPopoverVisibilityChange(eventId: string, open: boolean): void {
    this.activePopoverEventId = open ? eventId : (this.activePopoverEventId === eventId ? null : this.activePopoverEventId);
    this.cdr.markForCheck();
  }

  openAppointmentDetailTab(appointmentId: number): void {
    const apptId = Number(appointmentId || 0);
    if (!apptId) return;

    const existingTab = this.detailTabs.find((tab) => tab.appointmentId === apptId);
    if (existingTab) {
      this.activeTabKey = existingTab.key;
      this.cdr.markForCheck();
      return;
    }

    const tab: AppointmentDetailTab = {
      key: `appointment-${apptId}`,
      title: `Appointment #${apptId}`,
      appointmentId: apptId,
    };

    this.detailTabs = [...this.detailTabs, tab];
    this.activeTabKey = tab.key;
    this.cdr.markForCheck();
  }

  closeAppointmentDetailTab(tabKey: string): void {
    const closingIndex = this.detailTabs.findIndex((tab) => tab.key === tabKey);
    if (closingIndex < 0) return;

    const wasActive = this.activeTabKey === tabKey;
    this.detailTabs = this.detailTabs.filter((tab) => tab.key !== tabKey);

    if (wasActive) {
      const fallbackTab =
        this.detailTabs[closingIndex - 1] ?? this.detailTabs[closingIndex] ?? null;
      this.activeTabKey = fallbackTab?.key ?? this.calendarTabKey;
    }

    this.cdr.markForCheck();
  }

  activateCalendarTab(): void {
    this.activeTabKey = this.calendarTabKey;
    this.cdr.markForCheck();
  }

  get selectedTabIndex(): number {
    if (this.activeTabKey === this.calendarTabKey) return 0;
    const detailIdx = this.detailTabs.findIndex((tab) => tab.key === this.activeTabKey);
    return detailIdx >= 0 ? detailIdx + 1 : 0;
  }

  onTabIndexChange(index: number): void {
    if (index <= 0) {
      this.activeTabKey = this.calendarTabKey;
      return;
    }
    const selectedTab = this.detailTabs[index - 1];
    this.activeTabKey = selectedTab?.key ?? this.calendarTabKey;
  }

  onTabClose(event: { index: number } | number): void {
    const closedIndex =
      typeof event === 'number' ? Number(event) : Number(event?.index ?? -1);
    if (closedIndex <= 0) return;
    const tab = this.detailTabs[closedIndex - 1];
    if (!tab) return;
    this.closeAppointmentDetailTab(tab.key);
  }

  trackByTabKey(_index: number, tab: AppointmentDetailTab): string {
    return tab.key;
  }

  navigateToVideoCall(id: number) {
    const ID = id || 0;
    if (!ID || ID === 0) {
        this.generalService.showError('Unable to Continue Appointment Id Not Found');
    }
    this.route.navigate(['telehealth', ID]);
  }

  onDelete(data: any): void {
    const endDate = new Date(data.end).toLocaleDateString('en-US', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    });

    const formatTime = (dateStr: string) => {
      return new Date(dateStr).toLocaleTimeString('en-US', {
        hour: 'numeric',
        minute: '2-digit',
        hour12: true
      });
    };

    const apiUrl = `PatientAppointments/deletePatientAppointment?Id=${data.id}`;
    const title = `Appointment of Patient: <b>${data?.extendedProps?.patientName || data?.patientName } at ${endDate} ( ${formatTime(data.start)}-${formatTime(data.end)} )</b>`;
    const body = {
      Id : data.id
    }
    this.generalService.commonDelete(apiUrl, title ,body).pipe(
      takeUntil(this.destroy$)
    ).subscribe({
      next: (data) => {
        console.log('Deleted data:', data);
        this.calendarComponent.getApi().refetchEvents();
      },
      error: (err) => {
        console.error('Delete failed:', err);
      }
    });
  }

  openCreateAppointment(): void {
    if (!['Provider', 'Global Admin', 'Clinic Admin'].includes(this.userRole)) return;
    this.resetCreateApptForm();
    this.isCreateApptVisible = true;
    if (this.userRole === 'Provider') {
      this.selectedCreateProviderId = this.userId;
      this.fetchProviderPatients(this.selectedCreateProviderId);
    }
    this.cdr.markForCheck();
  }

  handleCancelCreateAppointment(): void {
    this.isCreateApptVisible = false;
    this.resetCreateApptForm();
    this.cdr.markForCheck();
  }

  private resetCreateApptForm(): void {
    this.isSubmittingAppt = false;
    this.selectedCreateProviderId = this.userRole === 'Provider' ? this.userId : null;
    this.providerPatients = [];
    this.selectedPatientId = null;
    this.selectedPatientFacilityId = null;

    this.treatments = [];
    this.selectedTreatmentId = null;
    this.selectedTreatmentProductId = null;

    this.selectedDate = null;
    this.formattedDate = null;

    this.slots = [];
    this.selectedSlotId = null;
    this.slotsError = null;
    this.loadingProviderPatients = this.loadingTreatments = this.loadingSlots = false;
  }

  onCreateProviderChange(providerId: number | null): void {
    this.selectedCreateProviderId = providerId;

    this.providerPatients = [];
    this.selectedPatientId = null;
    this.selectedPatientFacilityId = null;

    this.treatments = [];
    this.selectedTreatmentId = null;
    this.selectedTreatmentProductId = null;

    this.selectedDate = null;
    this.formattedDate = null;

    this.slots = [];
    this.selectedSlotId = null;
    this.slotsError = null;

    if (providerId) {
      this.fetchProviderPatients(providerId);
    }
    this.cdr.markForCheck();
  }

  private fetchProviderPatients(providerId: number): void {
    this.loadingProviderPatients = true;
    this.generalService
      .commonGet(`DropDowns/getAllPatients?ProviderId=${providerId}`)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (res) => {
          this.providerPatients = Array.isArray(res?.data) ? res.data : [];
          this.loadingProviderPatients = false;
          this.cdr.markForCheck();
        },
        error: (err) => {
          console.error(err);
          this.loadingProviderPatients = false;
          this.generalService.showError('Failed to load patients.');
          this.cdr.markForCheck();
        }
      });
  }

  onPatientChange(patientId: number | null): void {
    this.selectedPatientId = patientId;

    this.treatments = [];
    this.selectedTreatmentId = null;
    this.selectedTreatmentProductId = null;

    this.selectedDate = null;
    this.formattedDate = null;

    this.slots = [];
    this.selectedSlotId = null;
    this.slotsError = null;

    const p = this.providerPatients.find(x => x.patientId === patientId!);
    this.selectedPatientFacilityId = p?.facilityId ?? null;

    if (patientId) {
      this.fetchPatientTreatments(patientId);
    }
    this.cdr.markForCheck();
  }

  private fetchPatientTreatments(patientId: number): void {
    this.loadingTreatments = true;
    this.generalService
      .commonGet(`PatientTreatments/getPatientTreatmentSummaries?patientId=${patientId}`)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (res) => {
          this.treatments = Array.isArray(res?.data) ? res.data : [];
          this.loadingTreatments = false;
          this.cdr.markForCheck();
        },
        error: (err) => {
          console.error(err);
          this.loadingTreatments = false;
          this.generalService.showError('Failed to load treatments.');
          this.cdr.markForCheck();
        }
      });
  }

  onTreatmentChange(treatmentId: number | null): void {
    this.selectedTreatmentId = treatmentId;
    const t = this.treatments.find(x => x.treatmentId === treatmentId!);
    this.selectedTreatmentProductId = t?.productId ?? null;

    this.selectedDate = null;
    this.formattedDate = null;
    this.slots = [];
    this.selectedSlotId = null;
    this.slotsError = null;

    this.cdr.markForCheck();
  }

  onDateChange(date: Date | null): void {
    if (date) {
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const day = String(date.getDate()).padStart(2, '0');
      this.formattedDate = `${year}-${month}-${day}`;
      this.loadSlotsForDate(this.formattedDate);
    } else {
      this.formattedDate = null;
      this.slots = [];
      this.slotsError = null;
      this.cdr.markForCheck();
    }
  }

  private loadSlotsForDate(_dateStr: string): void {
    if (!this.selectedCreateProviderId) {
      this.slots = [];
      this.slotsError = 'Please select provider first.';
      this.cdr.markForCheck();
      return;
    }
    if (!this.selectedPatientFacilityId) {
      this.slots = [];
      this.slotsError = 'Patient facility not found.';
      this.cdr.markForCheck();
      return;
    }
    this.loadingSlots = true;
    this.slotsError = null;

    const providerId = this.selectedCreateProviderId;

    this.generalService
      .commonGet(`DropDowns/getProviderScheduledSlotsByProvider?ProviderId=${providerId}&Date=${_dateStr}&ClientTimezoneOffsetMinutes=${-new Date().getTimezoneOffset()}`)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (res) => {

          this.slots = Array.isArray(res?.data) ? res.data : [];

          this.loadingSlots = false;
          this.cdr.markForCheck();
        },
        error: (err) => {
          console.error(err);
          this.loadingSlots = false;
          this.slots = [];
          this.slotsError = 'Failed to load slots.';
          this.cdr.markForCheck();
        }
      });
  }

  getTreatmentLabel(t: {treatmentId: number; bundleName: string; startDate: string}): string {
    const date = new Date(t.startDate);
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${t.treatmentId} - ${t.bundleName} - ${y}-${m}-${d}`;
  }

  getSlotLabel(s: {
    slotDate: string; startTime: string; endTime: string; duration: number;
  }): string {
    const date = (s.slotDate || '').split('T')[0];
    return `${date} ${s.startTime} - ${s.endTime} • ${s.duration} mins`;
  }

  canSubmitRecall(): boolean {
    return !!(
      this.selectedCreateProviderId &&
      this.selectedPatientId &&
      this.selectedTreatmentId &&
      this.selectedSlotId &&
      !this.isSubmittingAppt
    );
  }

  submitRecallAppointment(): void {
    if (!this.canSubmitRecall()) return;

    this.isSubmittingAppt = true;

    const payload = {
      providerId: this.selectedCreateProviderId || 0,
      patientTreatmentId: this.selectedTreatmentId || 0,
      patientId: this.selectedPatientId || 0,
      providerScheduledSlotId: this.selectedSlotId || 0,
      productId: this.selectedTreatmentProductId || 0,
      userId: this.userId
    };

    this.generalService
      .commonPost('PatientAppointments/recallPatientAppointment', payload)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (res) => {
          this.isSubmittingAppt = false;

          if (res?.status === 1 && res?.data === true) {
            this.generalService.showSuccess('Appointment created successfully.');
            this.isCreateApptVisible = false;
            this.resetCreateApptForm();
            this.calendarComponent?.getApi()?.refetchEvents();
          } else {

            this.generalService.showError(
              res?.message || 'Unable to create the follow-up appointment.'
            );
          }
          this.cdr.markForCheck();
        },
        error: (err) => {
          console.error(err);
          this.isSubmittingAppt = false;
          this.generalService.showError(err?.message || 'Failed to create appointment.');
          this.cdr.markForCheck();
        }
      });
  }

  updateApptStatus(id: number) {

    const ID = id || 0;
    console.log('ID', ID);
    this.dismissEventPopover();
    this.showUpdateAppointmentModal = true
    this.selectedAppointmentId = ID

  };

  handleCancelUpdateAppointment(){
    if (this.isUpdatingAppointmentStatus) return;
    this.showUpdateAppointmentModal = false;
  }

  handleUpdateAppointment(){

    if(this.selectedStatus === '' || this.selectedStatus === null || this.selectedStatus === undefined){
      this.generalService.showError('Please select a status')
    }
    else{
      this.isUpdatingAppointmentStatus = true;
      this.cdr.markForCheck();

      let payload = {
        appointmentId: this.selectedAppointmentId,
        status: this.selectedStatus
      }

      this.generalService.updateAppointmentStatus(payload).subscribe({
        next: (res) => {
          console.log('res', res);
          this.generalService.showSuccess('Appointment status updated successfully');
          this.showUpdateAppointmentModal = false;
          this.calendarComponent.getApi().refetchEvents();
          this.selectedAppointmentId = null;
          this.selectedStatus = ''
          this.isUpdatingAppointmentStatus = false;
          this.cdr.markForCheck();
        },
        error: (err) => {
          this.isUpdatingAppointmentStatus = false;
          this.generalService.showError(err?.message || 'Failed to update appointment status');
          this.cdr.markForCheck();
        }
      })
    }

    console.log(this.selectedAppointmentId);
    console.log(this.selectedStatus)

  }

  getEventBg(arg: any): string {
    const status = String(arg?.event?.extendedProps?.status || '').toLowerCase().trim();
    if (status === 'completed') return '#22c55e';
    if (status === 'missed' || status === 'missed') return '#ef4444';
    if (status === 'scheduled') return '#f6c343';
    return arg?.event?.backgroundColor || '';
  }

}
