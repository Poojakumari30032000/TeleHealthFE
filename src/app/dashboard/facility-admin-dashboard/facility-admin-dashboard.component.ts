import { ChangeDetectionStrategy, ChangeDetectorRef, Component } from '@angular/core';
import { AuthService } from 'app/shared/Auth/auth.service';
import { GeneralService } from 'app/shared/services/general.service';
import { EChartsOption } from 'echarts';
import { Subject, takeUntil } from 'rxjs';
import {Router} from "@angular/router";

interface Tile {
  index: number;
  tileName: string;
  value: string;
}

interface ApiResponse<T = any> {
  status: number;
  success?: boolean | null;
  message: string | null;
  count: number;
  data: T;
  totalEntityCount: number | null;
  totalPages: number | null;
}

interface EarningsSeries {
  name: string;
  data: number[];
}

interface EarningsResponse {
  series: EarningsSeries[];
  days: string[];
}

interface AppointmentSeries {
  name: string;
  data: number[];
}

interface AppointmentResponse {
  series: AppointmentSeries[];
  months: string[];
}

@Component({
  selector: 'app-facility-admin-dashboard',
  templateUrl: './facility-admin-dashboard.component.html',
  styleUrls: ['./facility-admin-dashboard.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class FacilityAdminDashboardComponent {
  userId: number = this.auth.getUserId() || 0;
  userRoleId: number = this.auth.getUserRoleId() || 0;
  selectedFacilityId: number = Number(localStorage.getItem('FOS'));

  tiles: { [key: string]: string } = {};
  tilesLoading = true;

  earningsChartLoading = false;
  revenueChartLoading = false;
  appointmentChartLoading = false;
  prescriptionsLoading = false;

  private destroy$ = new Subject<void>();

  pendingPrescriptions: any[] = [];

  totalEarningChart: EChartsOption = {};
  pieChart: EChartsOption = {};
  appointmentChart: EChartsOption = {};

  earningsDateRange: Date[] = [];
  revenueSourcesDateRange: Date[] = [];
  appointmentsDateRange: Date[] = [];

  constructor(
    private generalService: GeneralService,
    private auth: AuthService,
    private cdr: ChangeDetectorRef,
    private router: Router,
  ) {

    const end = new Date();
    const start = new Date();
    start.setMonth(end.getMonth() - 5);

    this.earningsDateRange = [start, end];
    this.appointmentsDateRange = [start, end];

    const revEnd = new Date();
    const revStart = new Date();
    revStart.setDate(revEnd.getDate() - 30);
    this.revenueSourcesDateRange = [revStart, revEnd];
  }

  ngOnInit() {
    this.fetchDashboardTiles();
    this.fetchEarnings();

    this.fetchAppointments();
    this.getPendingPresciptionsForFacilityDashboard()
  }

  ngOnDestroy() {
    this.destroy$.next();
    this.destroy$.complete();
  }

  fetchDashboardTiles(): void {
    this.tilesLoading = true;

    this.generalService
      .getDashboardTiles(this.selectedFacilityId, this.userId, this.userRoleId)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (response: ApiResponse<Tile[]>) => {
          if (response.status === 1 && response.data) {
            response.data.forEach((tile: Tile) => {
              this.tiles[tile.tileName] = tile.value;
            });
          } else {
            console.error('Failed to fetch dashboard tiles:', response.message);
          }
          this.tilesLoading = false;
          this.cdr.markForCheck();
        },
        error: (err) => {
          console.error('Error fetching dashboard tiles:', err);
          this.tilesLoading = false;
          this.cdr.markForCheck();
        }
      });
  }

  fetchEarnings(): void {
    this.earningsChartLoading = true;

    let startDate = '';
    let endDate = '';

    if (this.earningsDateRange && this.earningsDateRange.length === 2) {
      startDate = this.formatDateLocal(this.earningsDateRange[0]!);
      endDate = this.formatDateLocal(this.earningsDateRange[1]!);
    }

    this.generalService
      .getEarnings(this.selectedFacilityId, this.userId, this.userRoleId, startDate, endDate)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (response: ApiResponse<EarningsResponse>) => {
          if (response.status === 1 && response.data) {
            const data = response.data;
            const seriesList = data.series || [];
            const totalSeries =
              seriesList.find(s => s.name === 'Total Earning') || seriesList[0];

            if (totalSeries && data.days && data.days.length) {
              this.totalEarningChart = {
                tooltip: {
                  trigger: 'axis',
                  axisPointer: { type: 'shadow' },
                  backgroundColor: '#1f2937',
                  borderColor: '#374151',
                  textStyle: { color: '#fff' },
                  valueFormatter: (value: any) =>
                    value != null ? '$' + Number(value).toLocaleString() : '$0',
                },
                toolbox: {
                  feature: {
                    dataView: { show: true, readOnly: false },
                    magicType: { show: true, type: ['bar'] },
                    restore: { show: true },
                    saveAsImage: { show: true }
                  }
                },
                legend: {
                  data: [totalSeries.name],
                  textStyle: { color: '#6b7280' }
                },
                xAxis: {
                  type: 'category',
                  data: data.days,
                  axisPointer: { type: 'shadow' },
                  axisLabel: { fontSize: 12 }
                },
                yAxis: {
                  type: 'value',
                  min: 0,
                  axisLabel: {
                    formatter: (value: number) =>
                      value >= 1000 ? '$' + value / 1000 + 'k' : '$' + value
                  }
                },
                series: [
                  {
                    name: totalSeries.name,
                    type: 'bar',
                    barWidth: '40%',
                    data: totalSeries.data,
                    itemStyle: {
                      borderRadius: [6, 6, 0, 0],
                      color: '#16a34a',
                    },
                    emphasis: {
                      focus: 'series'
                    }
                  }
                ],
                grid: {
                  left: '2%',
                  right: '2%',
                  bottom: '3%',
                  top: '15%',
                  containLabel: true
                },
                animation: true,
                animationDuration: 1500
              };
            } else {
              this.totalEarningChart = {};
            }
          } else {
            console.error('Failed to fetch earnings:', response.message);
          }
          this.earningsChartLoading = false;
          this.cdr.markForCheck();
        },
        error: (err) => {
          console.error('Error fetching earnings:', err);
          this.earningsChartLoading = false;
          this.cdr.markForCheck();
        }
      });
  }

  fetchAppointments(): void {
    this.appointmentChartLoading = true;

    let startDate = '';
    let endDate = '';

    if (this.appointmentsDateRange && this.appointmentsDateRange.length === 2) {
      startDate = this.formatDateLocal(this.appointmentsDateRange[0]!);
      endDate = this.formatDateLocal(this.appointmentsDateRange[1]!);
    }

    this.generalService
      .getAppointments(this.selectedFacilityId, this.userId, this.userRoleId, startDate, endDate)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (response: ApiResponse<AppointmentResponse>) => {
          if (response.status === 1 && response.data) {
            const data = response.data;
            const series = data.series || [];
            const months = data.months || [];

            if (series.length && months.length) {
              this.appointmentChart = {
                tooltip: {
                  trigger: 'axis',
                  axisPointer: { type: 'shadow' },
                  backgroundColor: '#1f2937',
                  borderColor: '#374151',
                  textStyle: { color: '#fff' }
                },
                legend: {
                  data: series.map(s => s.name),
                  textStyle: { color: '#6b7280' }
                },
                xAxis: {
                  type: 'category',
                  data: months,
                  axisLabel: { fontSize: 12, interval: 0 }
                },
                yAxis: {
                  type: 'value',
                  axisLabel: { formatter: (value) => value.toString() }
                },
                series: series.map(s => ({
                  name: s.name,
                  type: 'bar',
                  barWidth: '15%',
                  data: s.data,
                  itemStyle: {
                    color:
                      s.name === 'Scheduled'
                        ? '#FFA500'
                        : s.name === 'Completed'
                          ? '#8ab4ff'
                          : '#EF4444'
                  },
                })),
                grid: {
                  left: '2%',
                  right: '2%',
                  bottom: '3%',
                  top: '15%',
                  containLabel: true
                },
                barCategoryGap: '40%',
                color: ['#FFA500', '#8ab4ff', '#EF4444'],
              };
            } else {
              this.appointmentChart = {};
            }
          } else {
            console.error('Failed to fetch appointments:', response.message);
          }
          this.appointmentChartLoading = false;
          this.cdr.markForCheck();
        },
        error: (err) => {
          console.error('Error fetching appointments:', err);
          this.appointmentChartLoading = false;
          this.cdr.markForCheck();
        }
      });
  }

  disabledDate = (current: Date): boolean => {
    return !!current && current > new Date();
  };

  getPendingPresciptionsForFacilityDashboard(){
    this.prescriptionsLoading = true;
    this.generalService.getPendingPresciptionsForFacilityDashboard().subscribe({
      next: (response:any)=>{
        console.log(response);
        this.pendingPrescriptions = response.data;
        this.prescriptionsLoading = false;
        this.cdr.markForCheck();
    },
    error: (err:any) => {
        console.log(err);
        this.pendingPrescriptions = [];
        this.prescriptionsLoading = false;
        this.cdr.markForCheck();
    }
    })
  }

  openSelectedPrescription(id:number){
    this.router.navigate(['/prescription/detail/'+id]);
  }

  get totalProviders(): number {
    return Number(this.tiles['Total Providers']) || 0;
  }

  get totalPatients(): number {
    return Number(this.tiles['Total Patients']) || 0;
  }

  get drugsSold(): number {
    return Number(this.tiles['Drugs Sold']) || 0;
  }

  get packagesSold(): number {
    return Number(this.tiles['Packages Sold']) || 0;
  }

  openProviders(): void {
    this.router.navigate(['/user/view']);
  }

  openPatients(): void {
    this.router.navigate(['/patient/view']);
  }

  openDrugs(): void {
    this.router.navigate(['/product/view/Drugs']);
  }

  openPackages(): void {
    this.router.navigate(['/product/view/Bundles']);
  }

  openClinicInvoices(): void {
    this.router.navigate(['/billing/clinicInvoices']);
  }

  openAppointments(): void {
    this.router.navigate(['/schedule/calendar']);
  }

  openPrescriptions(): void {
    this.router.navigate(['/prescription/view']);
  }

  formatDateLocal(date: Date): string {
    const year = date.getFullYear();
    const month = ('0' + (date.getMonth() + 1)).slice(-2);
    const day = ('0' + date.getDate()).slice(-2);
    return `${year}-${month}-${day}`;
  }
}
