import {
  Component,
  EventEmitter,
  Output,
  ChangeDetectionStrategy,
  ChangeDetectorRef,
} from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { AuthService } from 'app/shared/Auth/auth.service';
import { GeneralService } from 'app/shared/services/general.service';
import { ValidationService } from 'app/shared/Validation/validation.service';
import { Subject, Subscription } from 'rxjs';
import { takeUntil } from 'rxjs/operators';

interface Provider {
  providerId: number;
  name: string;
}

@Component({
  selector: 'app-availability-add-edit-model',
  templateUrl: './availability-add-edit-model.component.html',
  styleUrl: './availability-add-edit-model.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AvailabilityAddEditModelComponent {
  @Output() formClosed = new EventEmitter<string>();
  availabilityForm!: FormGroup;
  isVisible = false;
  providerScheduleId: number = 0;
  modelTitle: string = '';
  providers: Provider[] = [];
  loadingProvider: boolean = false;
  daysOfWeek = [
    { value: 0, label: 'Sunday' },
    { value: 1, label: 'Monday' },
    { value: 2, label: 'Tuesday' },
    { value: 3, label: 'Wednesday' },
    { value: 4, label: 'Thursday' },
    { value: 5, label: 'Friday' },
    { value: 6, label: 'Saturday' },
  ];
  readonly selectAllDaysValue = '__select_all_days__';
  timeOptions: Array<{ label: string; value: string }> = [];
  filteredEndTimeOptions: Array<{ label: string; value: string }> = [];
  private destroy$ = new Subject<void>();
  isFormSubmitting: boolean = false;
  private apiStartDate?: Date | undefined;
  private apiEndDate?: Date | undefined;
  userRole: string = this.auth.getUserRole() || '';
  userId: number = this.auth.getUserId() || 0;
  allDurations = [10, 15, 30, 45, 60];
  filteredDurations: number[] = [];
  private blockDateSub: Subscription | null = null;

  constructor(
    private fb: FormBuilder,
    private generalService: GeneralService,
    private validationService: ValidationService,
    private cdr: ChangeDetectorRef,
    private auth: AuthService
  ) {}

  ngOnInit() {
    this.initForm();
    this.generateTimeOptions();
    this.filteredDurations = [...this.allDurations];
  }

  ngOnDestroy(): void {
    this.blockDateSub?.unsubscribe();
    this.destroy$.next();
    this.destroy$.complete();
  }

  initForm(): void {

    const facilityID = null;
    this.availabilityForm = this.fb.group({
      providerScheduleId: [0],
      title: ['', Validators.required],
      providerId: [null, Validators.required],
      facilityId: [facilityID],
      slotDate: [null, Validators.required],
      startTime: [null, Validators.required],
      endTime: [null, Validators.required],
      duration: [null, Validators.required],
      isRecurrence: [false],
      recurrenceDays: [[]],
      recurrenceEndType: [1],
      recurrenceEndDate: [null],
      recurrenceEndSlot: [null],
    });
    this.validationService.applyGlobalValidators(this.availabilityForm);
  }

  updateRepeatValidation(isRepeat: boolean): void {
    const selectedDaysControl = this.availabilityForm.get('recurrenceDays');
    const endTypeControl = this.availabilityForm.get('recurrenceEndType');
    const endDateControl = this.availabilityForm.get('recurrenceEndDate');
    const endSlotControl = this.availabilityForm.get('recurrenceEndSlot');

    if (isRepeat) {
      selectedDaysControl?.setValidators([
        Validators.required,
        Validators.minLength(1),
      ]);
      endTypeControl?.setValue(1, { emitEvent: false });
      endSlotControl?.setValue(null, { emitEvent: false });
      this.updateEndConditionValidation(1);
    } else {
      selectedDaysControl?.clearValidators();
      selectedDaysControl?.setValue([], { emitEvent: false });
      endTypeControl?.setValue(1, { emitEvent: false });
      endDateControl?.clearValidators();
      endSlotControl?.clearValidators();
      endDateControl?.setValue(null, { emitEvent: false });
      endSlotControl?.setValue(null, { emitEvent: false });
      endDateControl?.updateValueAndValidity({ emitEvent: false });
      endSlotControl?.updateValueAndValidity({ emitEvent: false });
    }
    selectedDaysControl?.updateValueAndValidity();
  }

  updateEndConditionValidation(
    condition: string | number | null | undefined
  ): void {
    const endDateControl = this.availabilityForm.get('recurrenceEndDate');
    const numberOfSlotsControl = this.availabilityForm.get('recurrenceEndSlot');
    const isRepeat = !!this.availabilityForm.get('isRecurrence')?.value;

    if (!isRepeat) {
      endDateControl?.clearValidators();
      numberOfSlotsControl?.clearValidators();
      endDateControl?.updateValueAndValidity({ emitEvent: false });
      numberOfSlotsControl?.updateValueAndValidity({ emitEvent: false });
      return;
    }

    const normalizedCondition = String(condition ?? '').toLowerCase();
    const isEndByDate =
      normalizedCondition === '1' || normalizedCondition === 'date';
    const isEndBySlots =
      normalizedCondition === '2' || normalizedCondition === 'slots';

    if (isEndByDate) {
      endDateControl?.setValidators([Validators.required]);
      numberOfSlotsControl?.clearValidators();
      numberOfSlotsControl?.setValue(null, { emitEvent: false });
    } else if (isEndBySlots) {
      endDateControl?.clearValidators();
      endDateControl?.setValue(null, { emitEvent: false });
      numberOfSlotsControl?.setValidators([
        Validators.required,
        Validators.min(1),
      ]);
    } else {
      this.availabilityForm.get('recurrenceEndType')?.setValue(1, {
        emitEvent: false,
      });
      endDateControl?.setValidators([Validators.required]);
      numberOfSlotsControl?.clearValidators();
      numberOfSlotsControl?.setValue(null, { emitEvent: false });
    }

    endDateControl?.updateValueAndValidity({ emitEvent: false });
    numberOfSlotsControl?.updateValueAndValidity({ emitEvent: false });
  }

  loadProviders(): void {
    this.loadingProvider = true;
    this.generalService
      .commonGet('DropDowns/getAllProviders')
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (res) => {
          if (res.status !== 1 || !res.data) return;
          this.providers = res.data;
        },
        error: (err) => {
          this.generalService.showError(
            err.message || 'Failed to load providers.'
          );
          this.loadingProvider = false;
        },
        complete: () => {
          this.loadingProvider = false;
          this.cdr.detectChanges();
        },
      });
  }

  generateTimeOptions(): void {
    const times = [];
    for (let hours = 0; hours < 24; hours++) {
      for (let minutes = 0; minutes < 60; minutes += 15) {
        const time = new Date(0, 0, 0, hours, minutes);
        const label = time.toLocaleTimeString('en-US', {
          hour: '2-digit',
          minute: '2-digit',
          hour12: true,
        });
        const value = time
          .toLocaleTimeString('en-US', {
            hour: '2-digit',
            minute: '2-digit',
            hour12: true,
          })
          .toLowerCase()
          .replace(/ /g, ' ');
        times.push({ label, value });
      }
    }
    this.timeOptions = times;
  }

  updateEndTimeOptions(): void {
    const start = this.availabilityForm.value.startTime;
    const end = this.availabilityForm.value.endTime;

    if (start) {
      const startMin = this.convertTimeToMinutes(start);
      this.filteredEndTimeOptions = this.timeOptions.filter(
        (t) => this.convertTimeToMinutes(t.value) > startMin
      );

      if (end && this.convertTimeToMinutes(end) <= startMin) {
        this.availabilityForm.patchValue({ endTime: null });
      }
    } else {
      this.filteredEndTimeOptions = [...this.timeOptions];
    }

    let availableMinutes = 0;
    if (start && end) {
      const startMin = this.convertTimeToMinutes(start);
      const endMin = this.convertTimeToMinutes(end);
      availableMinutes = Math.max(0, endMin - startMin);
    }
    this.filteredDurations = this.allDurations.filter((d) => d <= availableMinutes);

    if (this.availabilityForm.value.duration > availableMinutes) {
      this.availabilityForm.patchValue({ duration: null });
    }
  }

  private convertTimeToMinutes(timeString: string): number {
    if (!timeString) return 0;

    const [timePart, modifier] = timeString.split(' ');
    const [hoursStr, minutesStr] = timePart?.split(':') || [];

    if (!hoursStr || !minutesStr) return 0;

    let hours = parseInt(hoursStr, 10);
    const minutes = parseInt(minutesStr, 10);

    if (modifier) {
      const isPM = modifier.toLowerCase() === 'pm';
      if (hours === 12) {
        hours = isPM ? 12 : 0;
      } else {
        hours = isPM ? hours + 12 : hours;
      }
    }
    return hours * 60 + minutes;
  }

  onProviderChange(providerId: number | null): void {
    if (providerId) {
      this.blockDate(providerId, 'New');
    } else {
      this.blockDateSub?.unsubscribe();
      this.availabilityForm.get('slotDate')?.reset();
      this.apiStartDate = undefined;
      this.apiEndDate = undefined;
      this.cdr.markForCheck();
    }
  }

  showModal(id: number, title: string): void {
    if (id > 0) {
      this.generalService.showInfo(
        'Availability cannot be edited once added. Please add a new availability and manage slots instead.'
      );
      return;
    }

    this.initForm();
    this.providerScheduleId = id || 0;
    this.modelTitle = title;

    const facilityID = null;
    this.availabilityForm.reset({
      providerScheduleId: 0,
      title: '',
      providerId: null,
      facilityId: facilityID,
      slotDate: null,
      startTime: null,
      endTime: null,
      duration: null,
      isRecurrence: false,
      recurrenceDays: [],
      recurrenceEndType: 1,
      recurrenceEndDate: null,
      recurrenceEndSlot: null,
    });
    this.apiStartDate = undefined;
    this.apiEndDate = undefined;
    this.updateRepeatValidation(false);
    this.updateEndConditionValidation(1);

    if (this.userRole === 'Provider') {
      this.availabilityForm.get('providerId')?.setValue(this.userId);
      if (id === 0) this.blockDate(this.userId, 'New');
    } else {
      this.loadProviders();
    }

    this.availabilityForm.get('providerScheduleId')?.setValue(0);
    this.availabilityForm.get('facilityId')?.setValue(facilityID);
    this.isVisible = true;
    this.cdr.markForCheck();
  }

  loadAvailabilityData(id: number): void {
    this.generalService
      .commonGet(`ProviderSchedules/getProviderSsheduleById?Id=${id}`)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (res) => {
          if (res.status === 1 && res.data) {
            const data = { ...res.data };
            data.startTime = this.convertTo12HourFormat(res.data.startTime);
            data.endTime = this.convertTo12HourFormat(res.data.endTime);
            this.availabilityForm.patchValue(data);
            this.updateRepeatValidation(res.data.isRecurrence);
            if (res.data.isRecurrence === true) {
              this.updateEndConditionValidation(res.data.recurrenceEndType);
            }
            this.generalService.showSuccess(res.message);
            this.cdr.markForCheck();
          } else {
            this.generalService.showError(res.message);
          }
        },
        error: (err) =>
          this.generalService.showError(
            err.message || 'Failed to load availability data.'
          ),
      });
  }

  private convertTo12HourFormat(timeString: string): string {
    if (!timeString) return '';
    const [hoursStr, minutesStr] = timeString.split(':');
    const hours = Number(hoursStr);
    const minutes = Number(minutesStr);
    if (isNaN(hours) || isNaN(minutes)) return '';
    const period = hours >= 12 ? 'pm' : 'am';
    const formattedHours = hours % 12 || 12;
    const formattedTime = `${formattedHours}:${minutes.toString().padStart(2, '0')} ${period}`;
    return formattedTime;
  }

  blockDate(providerId: number, type: string): void {
    if (type === 'New' && this.providerScheduleId > 0) return;

    this.blockDateSub?.unsubscribe();
    this.apiStartDate = undefined;
    this.apiEndDate = undefined;
    if (type === 'New') {
      this.availabilityForm.get('slotDate')?.setValue(null);
    }
    this.cdr.markForCheck();

    const url: string =
      type === 'New'
        ? `ProviderSchedules/getProviderSchedulesStartDateById?Id=${providerId}&ClientTimezoneOffsetMinutes=${-new Date().getTimezoneOffset()}`
        : `ProviderSchedules/getProviderScheduledSlotStartDateById?Id=${this.providerScheduleId}&ClientTimezoneOffsetMinutes=${-new Date().getTimezoneOffset()}`;
    this.blockDateSub = this.generalService
      .commonGet(url)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (res) => {
          if (res.status === 1 && res.data) {
            this.apiStartDate = type !== 'New' ? new Date() : new Date(res.data.startDate);
            this.apiEndDate = new Date(res.data.endDate);
          } else {
            this.apiStartDate = undefined;
            this.apiEndDate = undefined;
          }
          this.cdr.markForCheck();
        },
        error: (err) => {
          this.apiStartDate = undefined;
          this.apiEndDate = undefined;
          this.generalService.showError(err.message || 'Failed to load start date.');
          this.cdr.markForCheck();
        },
      });
  }

  private toUtcMidnight(d: Date): Date {
    return new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate(), 0, 0, 0, 0));
  }

  handleOk(): void {
    this.isFormSubmitting = true;
    if (this.availabilityForm.invalid) {
      this.markFormControlsAsTouched();
      this.isFormSubmitting = false;
      this.generalService.showError('Please review and complete all required fields before saving availability.');
      return;
    }

    const formData = this.availabilityForm.value;

    if (!this.validateAvailabilityPayload(formData)) {
      this.isFormSubmitting = false;
      return;
    }

    formData.clientTimezoneOffsetMinutes = -new Date().getTimezoneOffset();

    const d: Date | null = formData.slotDate;
    if (d) {
      const y = d.getFullYear();
      const m = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      formData.slotDate = `${y}-${m}-${day}`;
    }

    if (
      formData.isRecurrence === true &&
      formData.recurrenceEndDate
    ) {
      formData.recurrenceEndType = 1;
      const endDate = new Date(formData.recurrenceEndDate);
      formData.recurrenceEndDate = this.toUtcMidnight(endDate);

    }

    const url: string =
      this.providerScheduleId > 0
        ? 'ProviderSchedules/rescheduleProviderSchedule'
        : 'ProviderSchedules/saveProviderSlot';
    this.generalService
      .commonPost(url, formData)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (res) => {
          if (res.status !== 1 || !res.data) {
            this.generalService.showError(res.message);
            this.isFormSubmitting = false;
            return;
          }
          this.generalService.showSuccess(res.message);
          this.isFormSubmitting = false;
          this.isVisible = false;
          this.formClosed.emit(this.modelTitle);
          this.cdr.markForCheck();
        },
        error: (err) => {
          this.generalService.showError(
            err.message || 'Failed to save availability.'
          );
          this.isFormSubmitting = false;
          this.cdr.markForCheck();
        },
      });
  }

  markFormControlsAsTouched(): void {
    Object.keys(this.availabilityForm.controls).forEach((field) => {
      const control = this.availabilityForm.get(field);
      if (control) {
        control.markAsTouched({ onlySelf: true });
        control.updateValueAndValidity();
      }
    });
  }

  handleCancel(): void {
    this.isVisible = false;
    this.cdr.markForCheck();
  }

  disabledDate = (current: Date): boolean => {
    const currentDate = new Date(current);
    currentDate.setHours(0, 0, 0, 0);

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    if (this.providerScheduleId === 0) {
      if (this.apiEndDate) {
        const apiDate = new Date(this.apiEndDate);
        apiDate.setHours(0, 0, 0, 0);

        if (apiDate >= today) {
          return currentDate <= apiDate;
        }
        return currentDate < today;
      } else {
        return currentDate < today;
      }
    } else {
      if (this.apiStartDate && this.apiEndDate) {
        const start = new Date(this.apiStartDate);
        start.setHours(0, 0, 0, 0);
        const end = new Date(this.apiEndDate);
        end.setHours(0, 0, 0, 0);
        return currentDate < start || currentDate > end;
      } else {
        return true;
      }
    }
  };

  disabledEndDate = (current: Date): boolean => {
    const slotDate = this.availabilityForm.get('slotDate')?.value;
    if (!slotDate) return true;

    const slotDateObj = new Date(slotDate);
    slotDateObj.setHours(0, 0, 0, 0);

    let endDateLimit: Date | undefined;
    if (this.providerScheduleId > 0 && this.apiEndDate) {
      endDateLimit = new Date(this.apiEndDate);
      endDateLimit.setHours(0, 0, 0, 0);
    }

    if (endDateLimit) {
      return current < slotDateObj || current > endDateLimit;
    } else {
      return current < slotDateObj;
    }
  };

  trackByProvider(_index: number, provider: Provider): number {
    return provider.providerId;
  }

  trackByTime(index: number): number {
    return index;
  }

  trackByDay(_index: number, day: { value: number; label: string }): number {
    return day.value;
  }

  onRecurrenceDaysChange(selectedDays: string[] | null): void {
    const selected = Array.isArray(selectedDays) ? selectedDays : [];
    if (!selected.includes(this.selectAllDaysValue)) return;

    const allDayLabels = this.daysOfWeek.map((day) => day.label);
    const recurrenceDaysControl = this.availabilityForm.get('recurrenceDays');
    recurrenceDaysControl?.setValue(allDayLabels);
    recurrenceDaysControl?.markAsDirty();
    recurrenceDaysControl?.updateValueAndValidity();
    this.cdr.markForCheck();
  }

  private validateAvailabilityPayload(formData: any): boolean {
    const startTime = formData?.startTime;
    const endTime = formData?.endTime;
    const duration = Number(formData?.duration || 0);

    if (!startTime || !endTime || duration <= 0) {
      this.generalService.showError(
        'Please verify start time, end time, and duration before saving availability.'
      );
      return false;
    }

    const startMinutes = this.convertTimeToMinutes(startTime);
    const endMinutes = this.convertTimeToMinutes(endTime);

    if (endMinutes <= startMinutes) {
      this.generalService.showError('End time must be later than start time.');
      return false;
    }

    if (duration > endMinutes - startMinutes) {
      this.generalService.showError(
        'Selected duration must fit within the selected start and end time.'
      );
      return false;
    }

    if (
      this.providerScheduleId === 0 &&
      (!formData?.title?.trim?.() || !formData?.providerId || !formData?.slotDate)
    ) {
      this.generalService.showError(
        'Please double-check title, provider, and date before adding availability.'
      );
      return false;
    }

    if (formData?.isRecurrence === true) {
      if (!Array.isArray(formData?.recurrenceDays) || formData.recurrenceDays.length === 0) {
        this.generalService.showError('Please select at least one recurrence day.');
        return false;
      }

      if (!formData?.recurrenceEndDate) {
        this.generalService.showError('Please select an end date for repeated availability.');
        return false;
      }
    }

    return true;
  }
}
