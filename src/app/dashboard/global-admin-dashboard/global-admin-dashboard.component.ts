import { ChangeDetectionStrategy, ChangeDetectorRef, Component, OnInit, OnDestroy } from '@angular/core';
import { Router } from '@angular/router';
import { AuthService } from 'app/shared/Auth/auth.service';
import { GeneralService } from 'app/shared/services/general.service';
import { EChartsOption } from 'echarts';
import { Subject, takeUntil } from 'rxjs';

interface ApiResponse {
  status: number;
  message?: string;
  count?: number;
  data?: any;
  totalEntityCount?: number;
  totalPages?: number;
}

interface PieChartData {
  value: number;
  name: string;
}

@Component({
  selector: 'app-global-admin-dashboard',
  templateUrl: './global-admin-dashboard.component.html',
  styleUrls: ['./global-admin-dashboard.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class GlobalAdminDashboardComponent implements OnInit, OnDestroy {

  userId: number = 0;
  userRoleId: number = 0;

  tiles: { [key: string]: any } = {};
  tilesLoading = true;

  revenueChartLoading = true;
  collectionsChartLoading = true;
  categoriesChartLoading = true;
  activeProvidersLoading = true;

  monthlyRevenueBarChart: EChartsOption = {};
  collectionsDonutChart: EChartsOption = {};
  categoriesPieChart: EChartsOption = {};

  activeProvidersCount: number = 0;
  monthlyRevenueTotal = 0;
  collectionsSummary = {
    paid: 0,
    pending: 0,
    total: 0
  };
  topCategoryHighlights: PieChartData[] = [];

  revenueDateRange: Date[] = [];
  collectionsDateRange: Date[] = [];
  categoriesDateRange: Date[] = [];

  private destroy$ = new Subject<void>();

  constructor(
    private generalService: GeneralService,
    private auth: AuthService,
    private cdr: ChangeDetectorRef,
    private router: Router
  ) {

    this.userId = this.auth.getUserId() || 0;
    this.userRoleId = this.auth.getUserRoleId() || 0;

    const endDate = new Date();
    const revenueStart = new Date(endDate);
    revenueStart.setMonth(endDate.getMonth() - 5);
    revenueStart.setDate(1);

    const collectionsStart = new Date(endDate);
    collectionsStart.setDate(1);

    this.revenueDateRange = [revenueStart, endDate];
    this.collectionsDateRange = [collectionsStart, endDate];
    this.categoriesDateRange = [collectionsStart, endDate];
  }

  ngOnInit(): void {
    this.fetchDashboardTiles();
    this.fetchMonthlyRevenueBarChart();
    this.fetchPaymentStatus();
    this.fetchTreatmentCategoriesPieChart();
    this.fetchActiveProvidersCount();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  fetchDashboardTiles(): void {
    this.tilesLoading = true;
    this.generalService.commonGet(`Dashboards/getDashBoardTiles?UserId=${this.userId}&RoleId=${this.userRoleId}`)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (response: ApiResponse) => {
          if (response.status === 1 && Array.isArray(response.data)) {
            response.data.forEach((tile: any) => {

              this.tiles[tile.tileName] = tile.value;
            });
          } else {
            console.warn('Unexpected dashboard tiles response', response);
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

  fetchMonthlyRevenueBarChart(): void {
    this.revenueChartLoading = true;
    let url = 'Dashboards/getMonthlyRevenueByMonths';
    if (this.revenueDateRange && this.revenueDateRange.length === 2) {
      const s = this.formatDateLocal(this.revenueDateRange[0]!);
      const e = this.formatDateLocal(this.revenueDateRange[1]!);
      url += `?StartDate=${s}&EndDate=${e}`;
    }

    this.generalService.commonGet(url)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (response: ApiResponse) => {
          if (response.status === 1 && response.data) {

            const payload = response.data;
            let months: string[] = [];
            let values: number[] = [];

            if (Array.isArray(payload.months) && Array.isArray(payload.series) && payload.series.length > 0) {
              months = payload.months;
              values = payload.series[0].data || [];
            } else if (Array.isArray(payload) && payload.length > 0 && payload[0].month !== undefined) {

              months = payload.map((p: any) => p.month);
              values = payload.map((p: any) => Number(p.total) || 0);
            } else {
              console.warn('Unrecognized revenue payload shape', payload);
            }

            this.monthlyRevenueTotal = values.reduce((sum, val) => sum + (Number(val) || 0), 0);

            this.monthlyRevenueBarChart = {
              tooltip: {
                trigger: 'axis',
                backgroundColor: '#1f2937',
                borderColor: '#374151',
                textStyle: { color: '#fff' },
                axisPointer: { type: 'shadow' }
              },
              grid: { left: '3%', right: '4%', bottom: '8%', containLabel: true },
              xAxis: { type: 'category', data: months, axisLine: { lineStyle: { color: '#6b7280' } }, axisLabel: { color: '#9ca3af' } },
              yAxis: { type: 'value', axisLine: { lineStyle: { color: '#d3d6db' } }, axisLabel: { color: '#9ca3af', formatter: '${value}' } },
              series: [
                {
                  name: 'Revenue',
                  type: 'bar',
                  barWidth: '45%',
                  data: values,
                  itemStyle: { borderRadius: [4, 4, 0, 0] },
                }
              ],
              color: ['#3b82f6']
            };
          } else {
            console.error('Failed to fetch monthly revenue:', response?.message);

            this.monthlyRevenueBarChart = {};
            this.monthlyRevenueTotal = 0;
          }

          this.revenueChartLoading = false;
          this.cdr.markForCheck();
        },
        error: (err) => {
          console.error('Error fetching monthly revenue:', err);
          this.monthlyRevenueTotal = 0;
          this.revenueChartLoading = false;
          this.cdr.markForCheck();
        }
      });
  }

  fetchPaymentStatus(): void {
    this.collectionsChartLoading = true;
    let url = 'Dashboards/getPaymentStatusPieChart';
    if (this.collectionsDateRange && this.collectionsDateRange.length === 2) {
      const s = this.formatDateLocal(this.collectionsDateRange[0]!);
      const e = this.formatDateLocal(this.collectionsDateRange[1]!);
      url += `?StartDate=${s}&EndDate=${e}`;
    }

    this.generalService.commonGet(url)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (response: ApiResponse) => {
          const data = response?.data?.data;
          if (response.status === 1 && data) {
            const pieData = data as PieChartData[];
            const paid = pieData
              .filter((item) => String(item.name || '').toLowerCase().includes('paid'))
              .reduce((sum, item) => sum + (Number(item.value) || 0), 0);
            const pending = pieData
              .filter((item) => String(item.name || '').toLowerCase().includes('pending'))
              .reduce((sum, item) => sum + (Number(item.value) || 0), 0);
            const total = pieData.reduce((sum, item) => sum + (Number(item.value) || 0), 0);
            this.collectionsSummary = { paid, pending, total };

            this.collectionsDonutChart = {
              tooltip: { trigger: 'item', backgroundColor: '#1f2937', borderColor: '#374151', textStyle: { color: '#fff' } },
              legend: { orient: 'vertical', top: '2%', left: 'left', textStyle: { color: '#9ca3af' } },
              series: [{
                name: 'Payment Status',
                type: 'pie',
                radius: ['40%', '70%'],
                avoidLabelOverlap: false,
                padAngle: 5,
                itemStyle: { borderRadius: 10, borderWidth: 2 },
                label: { show: false, position: 'center' },
                emphasis: { label: { show: true, fontSize: 16, fontWeight: 'bold', color: '#9ca3af' } },
                labelLine: { show: false },
                data: pieData
              }],
              color: ['#8ab4ff', '#ffc107', '#9c27b0']
            };
          } else {
            console.error('Failed to fetch payment status:', response?.message);
            this.collectionsSummary = { paid: 0, pending: 0, total: 0 };
          }

          this.collectionsChartLoading = false;
          this.cdr.markForCheck();
        },
        error: (err) => {
          console.error('Error fetching payment status:', err);
          this.collectionsSummary = { paid: 0, pending: 0, total: 0 };
          this.collectionsChartLoading = false;
          this.cdr.markForCheck();
        }
      });
  }

  fetchTreatmentCategoriesPieChart(): void {
    this.categoriesChartLoading = true;
    let url = 'Dashboards/getMonthlyTreatmentCategoryPieChart';
    if (this.categoriesDateRange && this.categoriesDateRange.length === 2) {
      const s = this.formatDateLocal(this.categoriesDateRange[0]!);
      const e = this.formatDateLocal(this.categoriesDateRange[1]!);
      url += `?StartDate=${s}&EndDate=${e}`;
    }

    this.generalService.commonGet(url)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (response: ApiResponse) => {
          const data = response?.data?.data;
          if (response.status === 1 && data) {
            const pieData = data as PieChartData[];
            this.topCategoryHighlights = [...pieData]
              .sort((a, b) => (Number(b.value) || 0) - (Number(a.value) || 0))
              .slice(0, 3);

            this.categoriesPieChart = {
              tooltip: { trigger: 'item', backgroundColor: '#1f2937', borderColor: '#374151', textStyle: { color: '#fff' } },
              legend: { bottom: 10, left: 'center', textStyle: { color: '#9ca3af' }, data: pieData.map(d => d.name) },
              series: [{
                name: 'Categories',
                type: 'pie',
                radius: '60%',
                center: ['50%', '45%'],
                data: pieData,
                emphasis: { itemStyle: { shadowBlur: 10, shadowOffsetX: 0, shadowColor: 'rgba(0, 0, 0, 0.5)' } },
                itemStyle: { borderRadius: 6, borderWidth: 1 },
                label: { show: false },
                labelLine: { show: false }
              }],
              color: ['#8ab4ff', '#FB7185', '#F59E0B', '#34D399', '#A78BFA']
            };
          } else {
            console.error('Failed to fetch treatment categories:', response?.message);
            this.categoriesPieChart = {};
            this.topCategoryHighlights = [];
          }
          this.categoriesChartLoading = false;
          this.cdr.markForCheck();
        },
        error: (err) => {
          console.error('Error fetching treatment categories:', err);
          this.topCategoryHighlights = [];
          this.categoriesChartLoading = false;
          this.cdr.markForCheck();
        }
      });
  }

  fetchActiveProvidersCount(): void {
    this.activeProvidersLoading = true;

    const tileValue = this.tiles['Active Providers'] ?? this.tiles['Providers'] ?? this.tiles['ActiveProviders'];
    if (typeof tileValue !== 'undefined') {
      this.activeProvidersCount = Number(tileValue) || 0;
      this.activeProvidersLoading = false;
      this.cdr.markForCheck();
      return;
    }

    this.generalService.commonGet(`Dashboards/getActiveProvidersCount?UserId=${this.userId}&RoleId=${this.userRoleId}`)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (response: ApiResponse) => {
          if (response.status === 1 && response.data != null) {

            if (typeof response.data === 'number') {
              this.activeProvidersCount = response.data;
            } else if (response.data.count != null) {
              this.activeProvidersCount = Number(response.data.count) || 0;
            } else {

              this.activeProvidersCount = Number(response.data.total || response.data.totalCount || 0) || 0;
            }
          } else {
            console.warn('Failed to fetch active providers count:', response?.message);
            this.activeProvidersCount = 0;
          }
          this.activeProvidersLoading = false;
          this.cdr.markForCheck();
        },
        error: (err) => {
          console.error('Error fetching active providers count:', err);
          this.activeProvidersLoading = false;
          this.cdr.markForCheck();
        }
      });
  }

  formatDateLocal(date: Date): string {
    const year = date.getFullYear();
    const month = ('0' + (date.getMonth() + 1)).slice(-2);
    const day = ('0' + date.getDate()).slice(-2);
    return `${year}-${month}-${day}`;
  }

  formatCurrency(value: any): string {
    const num = Number(value);
    if (!isFinite(num)) {
      return '$0.00';
    }
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 2 }).format(num);
  }

  disabledDate = (current: Date): boolean => {
    return current && current > new Date();
  };

  get activeClinics(): number {
    return Number(this.tiles['Clinics']) || 0;
  }

  get monthlyClinicRevenue(): number {
    return Number(this.tiles['Monthly Revenue (Clinics)']) || 0;
  }

  get totalActiveTreatments(): number {
    return Number(this.tiles['Total Active Treatments']) || 0;
  }

  get monthlyPlatformRevenue(): number {
    return Number(this.tiles['Monthly Profits']) || 0;
  }

  get refillRequests(): number {
    return Number(this.tiles['Refill Requests']) || 0;
  }

  get pendingIntakes(): number {
    return Number(this.tiles['Pending Intakes']) || 0;
  }

  get upcomingAppointments(): number {
    return Number(this.tiles['Upcoming Appointments']) || 0;
  }

  openClinics(): void {
    this.router.navigate(['/clinic/view']);
  }

  openClinicInvoices(): void {
    this.router.navigate(['/billing/clinicInvoices']);
  }

  openTreatments(): void {
    this.router.navigate(['/treatment/view']);
  }

  openClinicBills(): void {
    this.router.navigate(['/billing/clinicBills']);
  }

  openUsers(): void {
    this.router.navigate(['/user-management'], {
      queryParams: { tab: 'providers', tabIndex: 1 }
    });
  }

  openRefillRequests(): void {
    this.router.navigate(['/patient/view'], { queryParams: { refillStatus: 'Refill requested' } });
  }

  openSchedule(): void {
    this.router.navigate(['/schedule/calendar']);
  }

}
