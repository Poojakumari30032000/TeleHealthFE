import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  OnDestroy,
  OnInit,
} from '@angular/core';
import { GeneralService } from 'app/shared/services/general.service';
import { EChartsOption } from 'echarts';
import { Subject, takeUntil } from 'rxjs';
import * as echarts from 'echarts';
import { AuthService } from 'app/shared/Auth/auth.service';
import { Router } from '@angular/router';

interface Tile {
  index: number;
  tileName: string;
  value: string | number;
}

interface ApiResponse<T = any> {
  status: number;
  message: string;
  data: T;
  count?: number;
}

interface Appointment {
  appointmentId?: number;
  patientName: string;
  doctorName: string;
  category: string;
  date: string;
  time: string;
  status: string;
}

interface PatientCountsData {
  months: string[];
  visits: number[];
}

interface TreatmentDistributionItem {
  value: number;
  name: string;
}

interface TreatmentDistributionData {
  data: TreatmentDistributionItem[];
}

@Component({
  selector: 'app-provider-dashboard',
  templateUrl: './provider-dashboard.component.html',
  styleUrls: ['./provider-dashboard.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ProviderDashboardComponent implements OnInit, OnDestroy {

  tiles: { [key: string]: any } = {};
  tilesLoading: boolean = true;

  treatmentLoading: boolean = false;
  patientVisitsLoading: boolean = false;
  dailyAppointmentsLoading: boolean = false;
  totalPatientsLoading: boolean = false;

  treatmentDistributionIsEmpty = false;
  patientVisitsIsEmpty = false;

  dailyAppointments: Appointment[] = [];
  totalPatientsCount: number = 0;

  appointmentComparisonDateRange: Date[] = [];
  patientVisitsDateRange: Date[] = [];
  totalPatientsDateRange: Date[] = [];
  treatmentDateRange: Date[] = [];

  patientVisitChart: EChartsOption = {};
  treatmentDistributionChart: EChartsOption = {};

  private destroy$ = new Subject<void>();
  userId: number = this.auth.getUserId() || 0;
  userRoleId: number = this.auth.getUserRoleId() || 0;

  constructor(
    private generalService: GeneralService,
    private auth: AuthService,
    private cdr: ChangeDetectorRef,
    private router: Router
  ) {

    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0);

    this.patientVisitsDateRange = [startOfMonth, endOfMonth];
    this.totalPatientsDateRange = [startOfMonth, endOfMonth];
  }

  ngOnInit(): void {
    this.fetchSummary();
    this.fetchTreatmentDistribution();
    this.fetchPatientVisits();
    this.fetchDailyAppointments();
    this.fetchTotalPatients();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  fetchSummary(): void {
    this.tilesLoading = true;

    this.generalService
      .commonGet(
        `Dashboards/getProviderSummary?UserId=${this.userId}&RoleId=${this.userRoleId}`
      )
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (response: ApiResponse<Tile[]>) => {
          if (response.status === 1 && response.data) {
            const data = response.data;
            data.forEach((tile: Tile) => {
              let uiName = String(tile.tileName);

              if (uiName === 'Total Patients') uiName = 'Active Patients';
              if (
                uiName === 'Pending Prescriptions' ||
                uiName === 'Pending Prescription'
              ) {
                uiName = 'Pending Prescription Upload';
              }
              if (uiName === 'Total Appointments') {
                uiName = 'Pending Appointments';
              }

              this.tiles[uiName] = tile.value;
            });
          } else {
            console.error('Failed to fetch summary:', response.message);
          }
          this.tilesLoading = false;
          this.cdr.markForCheck();
        },
        error: (err) => {
          console.error('Error fetching summary:', err);
          this.tilesLoading = false;
          this.cdr.markForCheck();
        },
      });
  }

  fetchDailyAppointments(): void {
    const todayStr = this.formatDateLocal(new Date());
    const clientTimezoneOffsetMinutes = -new Date().getTimezoneOffset();
    this.dailyAppointmentsLoading = true;

    const url = `Dashboards/getDailyAppointments?UserId=${this.userId}&RoleId=${this.userRoleId}&Date=${todayStr}&ClientTimezoneOffsetMinutes=${clientTimezoneOffsetMinutes}`;

    this.generalService
      .commonGet(url)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (response: ApiResponse<Appointment[]>) => {
          if (response.status === 1 && response.data) {
            const arr = response.data as any[];
            this.dailyAppointments = arr.map(
              (a) =>
                ({
                  appointmentId:
                    Number(
                      a.patientAppointmentSlotId ??
                        a.appointmentId ??
                        a.id ??
                        0
                    ) || undefined,
                  patientName:
                    a.patientName ||
                    a.PatientName ||
                    `${a.patientFirstName || ''} ${
                      a.patientLastName || ''
                    }`.trim() ||
                    'Unknown',
                  doctorName:
                    a.doctorName || a.DoctorName || a.providerName || 'Unknown',
                  category:
                    a.category || a.Category || a.treatmentCategory || '-',
                  date:
                    a.date ||
                    a.Date ||
                    (a.appointmentDate
                      ? this.formatDateLocal(new Date(a.appointmentDate))
                      : ''),
                  time: a.time || a.Time || a.appointmentTime || '',
                  status: a.status || a.Status || a.appointmentStatus || '',
                } as Appointment)
            );
          } else {
            console.error(
              'Failed to fetch daily appointments:',
              response.message
            );
            this.dailyAppointments = [];
          }
          this.dailyAppointmentsLoading = false;
          this.cdr.markForCheck();
        },
        error: (err) => {
          console.error('Error fetching daily appointments:', err);
          this.dailyAppointments = [];
          this.dailyAppointmentsLoading = false;
          this.cdr.markForCheck();
        },
      });
  }

  fetchTotalPatients(): void {
    this.totalPatientsLoading = true;
    let url = `Dashboards/getTotalPatients?UserId=${this.userId}&RoleId=${this.userRoleId}`;

    if (this.totalPatientsDateRange && this.totalPatientsDateRange.length === 2) {
      const start = this.formatDateLocal(this.totalPatientsDateRange[0]!);
      const end = this.formatDateLocal(this.totalPatientsDateRange[1]!);
      url += `&StartDate=${start}&EndDate=${end}`;
    }

    this.generalService
      .commonGet(url)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (response: ApiResponse<{ count: number } | any>) => {
          if (response.status === 1 && response.data != null) {
            const raw = response.data;
            if (typeof raw === 'object' && raw.count != null) {
              this.totalPatientsCount = Number(raw.count);
            } else if (!isNaN(Number(raw))) {
              this.totalPatientsCount = Number(raw);
            } else if (Array.isArray(raw)) {
              const found = raw.find((t: any) =>
                String(t.tileName).toLowerCase().includes('patient')
              );
              this.totalPatientsCount = found ? Number(found.value || 0) : 0;
            } else {
              this.totalPatientsCount = 0;
            }
          } else {
            console.error('Failed to fetch total patients:', response.message);
            this.totalPatientsCount = 0;
          }
          this.totalPatientsLoading = false;
          this.cdr.markForCheck();
        },
        error: (err) => {
          console.error('Error fetching total patients:', err);
          this.totalPatientsCount = 0;
          this.totalPatientsLoading = false;
          this.cdr.markForCheck();
        },
      });
  }

  onTotalPatientsDateChange(): void {
    this.fetchTotalPatients();
  }

  fetchTreatmentDistribution(): void {
    this.treatmentLoading = true;
    this.treatmentDistributionIsEmpty = false;

    const url = `Dashboards/getTreatmentDistribution?UserId=${this.userId}&RoleId=${this.userRoleId}`;

    this.generalService
      .commonGet(url)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (response: ApiResponse<TreatmentDistributionData>) => {
          let chartData: TreatmentDistributionItem[] = [];

          if (response.status === 1 && response.data) {
            const payload = response.data;
            chartData = payload?.data || [];
          } else {
            console.error(
              'Failed to fetch treatment distribution:',
              response.message
            );
          }

          this.treatmentDistributionIsEmpty =
            !chartData || chartData.length === 0;

          this.buildTreatmentDistributionChart(chartData);
          this.treatmentLoading = false;
          this.cdr.markForCheck();
        },
        error: (err) => {
          console.error('Error fetching treatment distribution:', err);
          this.treatmentDistributionIsEmpty = true;
          this.buildTreatmentDistributionChart([]);
          this.treatmentLoading = false;
          this.cdr.markForCheck();
        },
      });
  }

  private buildTreatmentDistributionChart(
    data: TreatmentDistributionItem[]
  ): void {
    this.treatmentDistributionChart = {
      tooltip: {
        trigger: 'item',
        backgroundColor: '#1f2937',
        borderColor: '#374151',
        textStyle: { color: '#fff' },
      },
      legend: {
        top: '0%',
        right: 'right',
        textStyle: { color: '#9ca3af' },
      },
      series: [
        {
          name: 'Treatment Distribution',
          type: 'pie',
          radius: ['40%', '70%'],
          avoidLabelOverlap: false,
          padAngle: 5,
          itemStyle: {
            borderRadius: 10,
            color: (params: any) => {
              const colors = ['#3b82f6', '#10b981', '#8b5cf6', '#f59e0b'];
              return colors[params.dataIndex] || '#3b82f6';
            },
          },
          label: { show: false, position: 'center' },
          emphasis: {
            label: {
              show: true,
              fontSize: 18,
              fontWeight: 'bold',
              color: '#1f2937',
            },
          },
          labelLine: { show: false },
          data: data,
        },
      ],
      grid: { left: '3%', right: '3%', bottom: '3%', containLabel: true },
    };
  }

  fetchPatientVisits(): void {
    this.patientVisitsLoading = true;
    this.patientVisitsIsEmpty = false;

    let url = `Dashboards/getPatientCounts?UserId=${this.userId}&RoleId=${this.userRoleId}`;

    if (this.patientVisitsDateRange && this.patientVisitsDateRange.length === 2) {
      const start = this.formatDateLocal(this.patientVisitsDateRange[0]!);
      const end = this.formatDateLocal(this.patientVisitsDateRange[1]!);
      url += `&StartDate=${start}&EndDate=${end}`;
    }

    this.generalService
      .commonGet(url)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (response: ApiResponse<PatientCountsData>) => {
          let months: string[] = [];
          let visits: number[] = [];

          if (response.status === 1 && response.data) {
            months = response.data.months || [];
            visits = response.data.visits || [];
          } else {
            console.error(
              'Failed to fetch patient counts:',
              response.message
            );
          }

          this.patientVisitsIsEmpty =
            !months || months.length === 0 || !visits || visits.length === 0;

          this.buildPatientVisitsChart(months, visits);
          this.patientVisitsLoading = false;
          this.cdr.markForCheck();
        },
        error: (err) => {
          console.error('Error fetching patient counts:', err);
          this.patientVisitsIsEmpty = true;
          this.buildPatientVisitsChart([], []);
          this.patientVisitsLoading = false;
          this.cdr.markForCheck();
        },
      });
  }

  onPatientVisitsDateChange(): void {
    this.fetchPatientVisits();
  }

  private buildPatientVisitsChart(months: string[], visits: number[]): void {
    this.patientVisitChart = {
      tooltip: {
        trigger: 'axis',
        backgroundColor: '#111827',
        borderColor: '#1f2937',
        borderWidth: 1,
        textStyle: { color: '#f9fafb', fontSize: 12 },
        axisPointer: {
          type: 'shadow',
          label: { backgroundColor: '#4b5563' },
        },
      },
      legend: {
        data: ['Patients'],
        top: 20,
        itemWidth: 14,
        itemHeight: 8,
        textStyle: { color: '#9ca3af', fontWeight: 500 },
      },
      grid: {
        left: '3%',
        right: '4%',
        bottom: '12%',
        top: '20%',
        containLabel: true,
      },
      xAxis: {
        type: 'category',
        data: months,
        axisLine: { lineStyle: { color: '#d1d5db' } },
        axisTick: { show: false },
        axisLabel: { color: '#9ca3af', fontSize: 13, margin: 12 },
      },
      yAxis: {
        type: 'value',
        nameTextStyle: {
          color: '#6b7280',
          fontSize: 13,
          padding: [0, 0, 10, 0],
        },
        axisLine: { show: false },
        axisLabel: { color: '#9ca3af', fontSize: 12 },
        splitLine: { lineStyle: { color: '#e5e7eb', type: 'dashed' } },
      },
      series: [
        {
          name: 'Patients',
          type: 'bar',
          barWidth: '40%',
          data: visits,
          itemStyle: {
            color: new (echarts as any).graphic.LinearGradient(0, 0, 0, 1, [
              { offset: 0, color: '#60a5fa' },
              { offset: 1, color: '#2563eb' },
            ]),
            borderRadius: [6, 6, 0, 0],
          },
          emphasis: {
            itemStyle: {
              color: '#1e40af',
            },
          },
        },
      ],
    };
  }

  disabledDate = (): boolean => {

    return false;
  };

  formatDateLocal(date: Date): string {
    const year = date.getFullYear();
    const month = ('0' + (date.getMonth() + 1)).slice(-2);
    const day = ('0' + date.getDate()).slice(-2);
    return `${year}-${month}-${day}`;
  }

  get activePatients(): number {
    return Number(this.tiles['Active Patients']) || 0;
  }

  get activeTreatments(): number {
    return Number(this.tiles['Active Treatments']) || 0;
  }

  get pendingPrescriptionUpload(): number {
    return Number(this.tiles['Pending Prescription Upload']) || 0;
  }

  get pendingAppointments(): number {
    return Number(this.tiles['Pending Appointments']) || 0;
  }

  openPatients(): void {
    this.router.navigate(['/patient/view']);
  }

  openTreatments(): void {
    this.router.navigate(['/treatment/view']);
  }

  openPrescriptions(): void {
    this.router.navigate(['/prescription/view']);
  }

  openAppointments(): void {
    this.router.navigate(['/schedule/calendar']);
  }

  openAppointmentRow(row: Appointment): void {
    if (row?.appointmentId) {
      this.router.navigate(['/schedule/appointment/details', row.appointmentId]);
      return;
    }
    this.openAppointments();
  }
}
