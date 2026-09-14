import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  OnDestroy,
  OnInit,
} from '@angular/core';
import { AuthService } from 'app/shared/Auth/auth.service';
import { GeneralService } from 'app/shared/services/general.service';
import { Subject, takeUntil } from 'rxjs';

interface Provider {
  providerId: number;
  name: string;
}

interface TimeRangeView {
  id: number | null;
  startTime: string;
  endTime: string;
  slotDurationMinutes: number | null;
  hasBookings: boolean;
}

interface DayView {
  date: string;
  dayOfWeek: number;
  label: string;
  isClosed: boolean;
  isOverride: boolean;

  note: string | null;
  slotDurationMinutes: number | null;
  timeRanges: TimeRangeView[];
  bookedSlotCount: number;

  saving: boolean;

  dirty: boolean;
}

interface WeekView {
  providerId: number;
  timezone: string;
  weekStartDate: string;
  defaultSlotDurationMinutes: number;
  days: DayView[];
}

const DAY_LABELS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

@Component({
  selector: 'app-manage-hours',
  templateUrl: './manage-hours.component.html',
  styleUrls: ['./manage-hours.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ManageHoursComponent implements OnInit, OnDestroy {
  private destroy$ = new Subject<void>();

  userRole: string = '';
  loadingProvider = false;
  providerList: Provider[] = [];
  selectedProvider: number = 0;

  weekStartDate!: Date;
  loading = false;
  week: WeekView | null = null;

  readonly clientTimezone: string = this.detectBrowserTimezone();

  timeOptions: Array<{ label: string; value: string }> = [];

  overrideModalVisible = false;
  overrideDate: Date | null = null;
  overrideIsClosed = false;
  overrideNote: string | null = null;
  overrideRanges: TimeRangeView[] = [];
  overrideSaving = false;
  overrideEditingFromDay = false;

  constructor(
    private generalService: GeneralService,
    private auth: AuthService,
    private cdr: ChangeDetectorRef,
  ) {
    this.userRole = this.auth.getUserRole() || '';
    if (this.userRole === 'Provider') {
      this.selectedProvider = this.auth.getUserId() || 0;
    }
    this.weekStartDate = this.startOfWeekSunday(new Date());
    this.timeOptions = this.generateTimeOptions();
  }

  ngOnInit(): void {
    if (this.userRole !== 'Provider') {
      this.fetchProviders();
    }
    if (this.selectedProvider > 0) {
      this.fetchWeek();
    }
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  private fetchProviders(): void {
    this.loadingProvider = true;
    this.cdr.markForCheck();
    this.generalService
      .commonGet('DropDowns/getAllProviders')
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (res) => {
          this.providerList = Array.isArray(res?.data) ? res.data : [];
          this.loadingProvider = false;
          if (this.providerList.length > 0) {
            this.selectedProvider = this.providerList[0]?.providerId ?? 0
            this.onProviderChange()
          }
          this.cdr.markForCheck();
        },
        error: () => {
          this.providerList = [];
          this.loadingProvider = false;
          this.cdr.markForCheck();
        },
      });
  }

  onProviderChange(): void {
    if (this.selectedProvider > 0) {
      this.fetchWeek();
    } else {
      this.week = null;
      this.cdr.markForCheck();
    }
  }

  previousWeek(): void {
    this.weekStartDate = this.addDays(this.weekStartDate, -7);
    this.fetchWeek();
  }

  nextWeek(): void {
    this.weekStartDate = this.addDays(this.weekStartDate, 7);
    this.fetchWeek();
  }

  goToCurrentWeek(): void {
    this.weekStartDate = this.startOfWeekSunday(new Date());
    this.fetchWeek();
  }

  get weekRangeLabel(): string {
    if (!this.weekStartDate) return '';
    const end = this.addDays(this.weekStartDate, 6);
    const sameMonth = this.weekStartDate.getMonth() === end.getMonth();
    const startStr = this.weekStartDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    const endStr = sameMonth
      ? end.toLocaleDateString('en-US', { day: 'numeric', year: 'numeric' })
      : end.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    return `${startStr} – ${endStr}`;
  }

  private fetchWeek(): void {
    if (!this.selectedProvider || this.selectedProvider <= 0) {
      this.week = null;
      this.cdr.markForCheck();
      return;
    }
    this.loading = true;
    this.cdr.markForCheck();

    const weekStart = this.formatDateLocal(this.weekStartDate);
    const tz = encodeURIComponent(this.clientTimezone || '');
    const url = `providerHours/week?providerId=${this.selectedProvider}&weekStartDate=${weekStart}&clientTimezone=${tz}`;
    this.generalService
      .commonGet(url)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (res) => {
          if (res?.status === 1 && res?.data) {
            this.week = this.adaptWeek(res.data);
          } else {
            this.week = null;
          }
          this.loading = false;
          this.cdr.markForCheck();
        },
        error: () => {
          this.week = null;
          this.loading = false;
          this.cdr.markForCheck();
        },
      });
  }

  private adaptWeek(data: any): WeekView {
    const days: DayView[] = (data?.days || []).map((d: any, i: number) => ({
      date: d.date,
      dayOfWeek: d.dayOfWeek ?? i,
      label: DAY_LABELS[d.dayOfWeek ?? i],
      isClosed: !!d.isClosed,
      isOverride: !!d.isOverride,
      note: d.note ?? null,
      slotDurationMinutes: d.slotDurationMinutes ?? null,
      timeRanges: (d.timeRanges || []).map((r: any) => ({
        id: r.id ?? null,
        startTime: this.normalizeTime(r.startTime),
        endTime: this.normalizeTime(r.endTime),
        slotDurationMinutes: r.slotDurationMinutes ?? null,
        hasBookings: !!r.hasBookings,
      })),
      bookedSlotCount: d.bookedSlotCount ?? 0,
      saving: false,
      dirty: false,
    }));
    return {
      providerId: data.providerId,
      timezone: data.timezone,
      weekStartDate: data.weekStartDate,
      defaultSlotDurationMinutes: data.defaultSlotDurationMinutes ?? 30,
      days,
    };
  }

  onClosedChange(day: DayView): void {
    if (day.isClosed) {
      day.timeRanges = [];
    } else if (day.timeRanges.length === 0) {
      day.timeRanges = [this.blankRange('09:00', '17:00')];
    }
    day.dirty = true;
    this.cdr.markForCheck();
  }

  addRange(day: DayView): void {
    day.timeRanges = [...day.timeRanges, this.blankRange()];
    day.dirty = true;
    this.cdr.markForCheck();
  }

  removeRange(day: DayView, index: number): void {
    const range = day.timeRanges[index];
    if (range?.hasBookings) return;
    day.timeRanges = day.timeRanges.filter((_, i) => i !== index);
    day.dirty = true;
    this.cdr.markForCheck();
  }

  onRangeChange(day: DayView): void {
    day.dirty = true;
    this.cdr.markForCheck();
  }

  copyToAllDays(source: DayView): void {
    if (!this.week) return;
    for (const day of this.week.days) {
      if (day === source) continue;

      const anyBooked = day.timeRanges.some((r) => r.hasBookings);
      if (anyBooked) continue;
      day.isClosed = source.isClosed;
      day.timeRanges = source.timeRanges.map((r) => ({
        id: null,
        startTime: r.startTime,
        endTime: r.endTime,
        slotDurationMinutes: r.slotDurationMinutes,
        hasBookings: false,
      }));
      day.dirty = true;
    }
    this.cdr.markForCheck();
  }

  get isSavingAny(): boolean {
    return !!this.week?.days?.some((d) => d.saving);
  }

  saveDay(day: DayView): void {
    if (!this.week || day.saving || this.isSavingAny) return;
    day.saving = true;
    this.cdr.markForCheck();

    const body = {
      providerId: this.week.providerId,
      isClosed: day.isClosed,
      slotDurationMinutes: day.slotDurationMinutes ?? null,
      timeRanges: day.timeRanges.map((r) => ({
        id: r.id,
        startTime: r.startTime,
        endTime: r.endTime,
        slotDurationMinutes: r.slotDurationMinutes ?? null,
      })),
    };

    this.generalService
      .commonPut(`providerHours/day/${day.dayOfWeek}`, body)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (res) => {
          day.saving = false;
          if (res?.status === 1 && res?.data === true) {
            (this.generalService as any).showSuccess?.(`${day.label} hours saved.`);
            day.dirty = false;
            this.fetchWeek();
          } else {
            (this.generalService as any).showError?.(res?.message || 'Failed to save.');
            this.cdr.markForCheck();
          }
        },
        error: () => {
          day.saving = false;
          this.cdr.markForCheck();
        },
      });
  }

  saveAll(): void {
    if (!this.week) return;
    this.week.days.filter((d) => d.dirty).forEach((d) => this.saveDay(d));
  }

  openOverrideModal(seed?: DayView): void {
    if (seed) {
      this.overrideEditingFromDay = true;
      this.overrideDate = new Date(seed.date);
      this.overrideIsClosed = seed.isClosed;
      this.overrideRanges = seed.timeRanges.map((r) => ({ ...r }));

      this.overrideNote = seed.note;
    } else {
      this.overrideEditingFromDay = false;

      const today = new Date(); today.setHours(0, 0, 0, 0);
      const seedDate = this.weekStartDate > today ? new Date(this.weekStartDate) : today;
      this.overrideDate = seedDate;
      this.overrideIsClosed = false;
      this.overrideRanges = [this.blankRange('09:00', '17:00')];
      this.overrideNote = null;
    }
    this.overrideModalVisible = true;
    this.cdr.markForCheck();
  }

  closeOverrideModal(): void {
    this.overrideModalVisible = false;
    this.overrideSaving = false;
    this.cdr.markForCheck();
  }

  onOverrideClosedChange(): void {
    if (this.overrideIsClosed) {
      this.overrideRanges = [];
    } else if (this.overrideRanges.length === 0) {
      this.overrideRanges = [this.blankRange('09:00', '17:00')];
    }
    this.cdr.markForCheck();
  }

  addOverrideRange(): void {
    this.overrideRanges = [...this.overrideRanges, this.blankRange()];
    this.cdr.markForCheck();
  }

  removeOverrideRange(index: number): void {
    const r = this.overrideRanges[index];
    if (r?.hasBookings) return;
    this.overrideRanges = this.overrideRanges.filter((_, i) => i !== index);
    this.cdr.markForCheck();
  }

  saveOverride(): void {
    if (!this.overrideDate || !this.selectedProvider) return;
    this.overrideSaving = true;
    this.cdr.markForCheck();

    const body: any = {
      providerId: this.selectedProvider,
      date: this.formatDateLocal(this.overrideDate),
      isClosed: this.overrideIsClosed,
      note: this.overrideNote,
      timeRanges: this.overrideIsClosed
        ? []
        : this.overrideRanges.map((r) => ({
            id: r.id,
            startTime: r.startTime,
            endTime: r.endTime,
            slotDurationMinutes: r.slotDurationMinutes ?? null,
          })),
    };

    this.generalService
      .commonPut('providerHours/dateOverride', body)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (res) => {
          this.overrideSaving = false;
          if (res?.status === 1 && res?.data === true) {
            (this.generalService as any).showSuccess?.('Alternative hours saved.');
            this.overrideModalVisible = false;
            this.fetchWeek();
          } else {
            (this.generalService as any).showError?.(res?.message || 'Failed to save alternative hours.');
            this.cdr.markForCheck();
          }
        },
        error: () => {
          this.overrideSaving = false;
          this.cdr.markForCheck();
        },
      });
  }

  resetDayToTemplate(day: DayView): void {
    if (!day.isOverride || !this.selectedProvider) return;
    const dateStr = this.formatDateLocal(new Date(day.date));
    const url = `providerHours/dateOverride?providerId=${this.selectedProvider}&date=${dateStr}`;
    this.generalService
      .commonHttpDelete(url)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (res) => {
          if (res?.status === 1 && res?.data === true) {
            (this.generalService as any).showSuccess?.(`${day.label} reverted to weekly hours.`);
            this.fetchWeek();
          } else {
            (this.generalService as any).showError?.(res?.message || 'Failed to revert.');
          }
        },
      });
  }

  trackByDay(_index: number, day: DayView): string {
    return day.date;
  }

  trackByRangeIndex(index: number, range: TimeRangeView): number {
    return range.id ?? -(index + 1);
  }

  trackByProvider(_index: number, provider: Provider): number {
    return provider.providerId;
  }

  formatTimeLabel(value: string): string {
    if (!value) return '';
    const opt = this.timeOptions.find((o) => o.value === value);
    return opt ? opt.label : value;
  }

  private startOfWeekSunday(date: Date): Date {
    const d = new Date(date);
    d.setHours(0, 0, 0, 0);
    const dow = d.getDay();
    d.setDate(d.getDate() - dow);
    return d;
  }

  private addDays(date: Date, days: number): Date {
    const d = new Date(date);
    d.setDate(d.getDate() + days);
    return d;
  }

  private formatDateLocal(date: Date): string {
    const y = date.getFullYear();
    const m = ('0' + (date.getMonth() + 1)).slice(-2);
    const d = ('0' + date.getDate()).slice(-2);
    return `${y}-${m}-${d}`;
  }

  private normalizeTime(s: string): string {
    if (!s) return '';

    if (/^\d{2}:\d{2}:\d{2}$/.test(s)) return s.substring(0, 5);
    return s;
  }

  private blankRange(start = '09:00', end = '17:00'): TimeRangeView {
    return {
      id: null,
      startTime: start,
      endTime: end,
      slotDurationMinutes: null,
      hasBookings: false,
    };
  }

  private generateTimeOptions(): Array<{ label: string; value: string }> {
    const out: Array<{ label: string; value: string }> = [];
    for (let h = 0; h < 24; h++) {

      for (let m = 0; m < 60; m += 10) {

        if (h === 0 && m === 0) continue;
        if (h === 23 && m === 50) continue;
        const value = `${('0' + h).slice(-2)}:${('0' + m).slice(-2)}`;
        const ampm = h < 12 ? 'AM' : 'PM';
        const hour12 = h % 12 === 0 ? 12 : h % 12;
        out.push({ value, label: `${hour12}:${('0' + m).slice(-2)} ${ampm}` });
      }
    }
    return out;
  }

  private detectBrowserTimezone(): string {
    try {
      const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
      return tz && tz.length > 0 ? tz : 'Etc/UTC';
    } catch {
      return 'Etc/UTC';
    }
  }
}
