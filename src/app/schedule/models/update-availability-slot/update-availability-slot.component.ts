import { ChangeDetectionStrategy, ChangeDetectorRef, Component, EventEmitter, Output } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { GeneralService } from 'app/shared/services/general.service';
import { ValidationService } from 'app/shared/Validation/validation.service';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';

interface Slot {
  providerScheduledSlotId: number
  providerId: number
  date: string
  startTime: string
  endTime: string
  duration: number
  isAppointment: boolean
}

@Component({
  selector: 'app-update-availability-slot',
  templateUrl: './update-availability-slot.component.html',
  styleUrl: './update-availability-slot.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class UpdateAvailabilitySlotComponent {

  @Output() formClosed = new EventEmitter<string>();
  slotForm!: FormGroup;
  isVisible = false;
  providerScheduledSlotId: number = 0;
  providerScheduleId: number = 0;
  providerId: number = 0;
  modelTitle: string = '';
  private destroy$ = new Subject<void>();
  isFormSubmitting: boolean = false;
  timeOptions: Array<{ label: string; value: string; disabled: boolean }> = [];
  filteredEndTimeOptions: Array<{ label: string; value: string }> = [];
  private apiStartDate?: Date;
  private apiEndDate?: Date;
  existingSlots: Slot[] = [];

  constructor(
    private fb: FormBuilder,
    private generalService: GeneralService,
    private validationService: ValidationService,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    this.initForm();
    this.generateTimeOptions();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  initForm(): void {
    this.slotForm = this.fb.group({
      providerScheduledSlotId: [0],
      startDate: [null, Validators.required],
      startTime: [null, Validators.required],
      endTime: [null, Validators.required],
      duration: [null, Validators.required],
    });
    this.validationService.applyGlobalValidators(this.slotForm);

    this.slotForm.get('startDate')?.valueChanges.pipe(
      takeUntil(this.destroy$)
    ).subscribe(() => this.fetchExistingSlots());

    this.slotForm.get('duration')?.valueChanges.pipe(
      takeUntil(this.destroy$)
    ).subscribe(() => {
      this.fetchExistingSlots();
      this.updateEndTimeOptions();
    });
  }

  private fetchExistingSlots(): void {
    const startDate = this.slotForm.get('startDate')?.value;
    const duration = this.slotForm.get('duration')?.value;
    if (!startDate || !duration || !this.providerId) return;
    this.generalService.commonGet(
      `ProviderSchedules/getProviderScheduledSlotTimes?ProviderId=${this.providerId}&SlotDate=${startDate}`
    ).pipe(takeUntil(this.destroy$)).subscribe({
      next: (res) => {
        if (res.status === 1 && res.data) {
          this.existingSlots = res.data;
          this.updateDisabledTimeOptions();
        }
      },
      error: (err) => this.generalService.showError(err.message || 'Failed to fetch existing slots.')
    });
  }

  disabledDate = (current: Date): boolean => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    if (this.providerScheduleId === 0) {
      if (this.apiEndDate) {
        const apiDate = new Date(this.apiEndDate);
        apiDate.setHours(0, 0, 0, 0);
        const effectiveEndDate = apiDate < today ? today : apiDate;
        return current < effectiveEndDate;
      } else {
        return current < today;
      }
    } else {
      if (this.apiStartDate && this.apiEndDate) {
        const start = new Date(this.apiStartDate);
        start.setHours(0, 0, 0, 0);
        const end = new Date(this.apiEndDate);
        end.setHours(0, 0, 0, 0);
        return current < start || current > end;
      } else {
        return true;
      }
    }
  };

  private updateDisabledTimeOptions(): void {
    const duration = this.slotForm.get('duration')?.value;
    this.timeOptions.forEach(opt => opt.disabled = false);
    if (!duration || !this.existingSlots.length) {
      this.cdr.markForCheck();
      return;
    }
    this.existingSlots.forEach(slot => {
      const startMinutes = this.convertTimeToMinutes(slot.startTime);
      const endMinutes = this.convertTimeToMinutes(slot.endTime);
      this.timeOptions.forEach(opt => {
        const optMinutes = this.convertTimeToMinutes(opt.value);
        if (optMinutes > startMinutes && optMinutes <= endMinutes) {
          opt.disabled = true;
        }
      });
    });
    this.cdr.markForCheck();
  }

  generateTimeOptions(): void {
    const times = [];
    for (let hours = 0; hours < 24; hours++) {
      for (let minutes = 0; minutes < 60; minutes += 15) {
        const time = new Date(0, 0, 0, hours, minutes);
        const label = time.toLocaleTimeString('en-US', {
          hour: '2-digit',
          minute: '2-digit',
          hour12: true
        });
        const value = time.toLocaleTimeString('en-US', {
          hour: '2-digit',
          minute: '2-digit',
          hour12: true
        }).toLowerCase().replace(/ /g, ' ');
        times.push({ label, value, disabled: false });
      }
    }
    this.timeOptions = times;
  }

  updateEndTimeOptions(): void {
    const startTime = this.slotForm.value.startTime;
    const duration = this.slotForm.get('duration')?.value;

    if (startTime && duration) {
      const startMinutes = this.convertTimeToMinutes(startTime);
      const endMinutes = startMinutes + duration;
      const endTime = this.convertMinutesToTime(endMinutes);

      this.filteredEndTimeOptions = this.timeOptions.filter(t => {
        const tMinutes = this.convertTimeToMinutes(t.value);
        return tMinutes > startMinutes;
      });

      const endTimeOption = this.filteredEndTimeOptions.find(opt => opt.value === endTime);
      if (endTimeOption) {
        this.slotForm.patchValue({ endTime: endTime }, { emitEvent: false });
      } else {
        this.slotForm.patchValue({ endTime: null }, { emitEvent: false });
      }
    } else {
      this.filteredEndTimeOptions = this.timeOptions;
      this.slotForm.patchValue({ endTime: null }, { emitEvent: false });
    }

    const currentEnd = this.slotForm.value.endTime;
    if (currentEnd) {
      const currentEndMinutes = this.convertTimeToMinutes(currentEnd);
      const startMinutes = this.convertTimeToMinutes(startTime);
      if (currentEndMinutes <= startMinutes || this.timeOptions.find(opt => opt.value === currentEnd)?.disabled) {
        this.slotForm.patchValue({ endTime: null }, { emitEvent: false });
      }
    }
  }

  private convertTimeToMinutes(timeString: string): number {
    const [time, modifier] = timeString.split(' ');
    let [hours, minutes] = time?.split(':').map(Number) || [0, 0];
    if(!hours || !minutes) return 0;
    if (modifier?.toLowerCase() === 'pm' && hours !== 12) hours += 12;
    if (modifier?.toLowerCase() === 'am' && hours === 12) hours = 0;
    return hours * 60 + minutes;
  }

  private convertMinutesToTime(totalMinutes: number): string {
    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;
    const period = hours >= 12 ? 'pm' : 'am';
    let adjustedHours = hours % 12;
    adjustedHours = adjustedHours === 0 ? 12 : adjustedHours;
    const formattedHours = adjustedHours.toString();
    const formattedMinutes = minutes.toString().padStart(2, '0');
    return `${formattedHours}:${formattedMinutes} ${period}`.toLowerCase();
  }

  showModal(data: Slot | null, title: string, availabilityId: number): void {
    this.providerScheduleId = availabilityId;
    this.modelTitle = title;
    this.blockDate(availabilityId);
    if (data && data?.providerScheduledSlotId ) {
      this.providerScheduledSlotId = data?.providerScheduledSlotId;
      this.providerId = data?.providerId;
      this.slotForm.patchValue({
        providerScheduledSlotId: data.providerScheduledSlotId,
        startDate: data.date,
        startTime: data.startTime.toLowerCase(),
        endTime: data.endTime.toLowerCase(),
        duration: data.duration,
      });
      this.updateEndTimeOptions();
    } else {
      this.slotForm.reset();
      this.initForm();
    }
    this.isVisible = true;
    this.cdr.detectChanges();
  }

  blockDate(slotId: number,): void {
    this.generalService.commonGet(`ProviderSchedules/getProviderScheduledSlotStartDateById?Id=${slotId}&ClientTimezoneOffsetMinutes=${-new Date().getTimezoneOffset()}`)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (res) => {
          if (res.status === 1 && res.data) {
            this.apiStartDate =  new Date(res.data.startDate);
            this.apiEndDate = new Date(res.data.endDate);
          }
        },
        error: (err) => {
          this.generalService.showError(err.message || 'Failed to load start date.');
        }
    });
  }

  handleOk(): void {
    this.isFormSubmitting = true;
    if (this.slotForm.invalid) {
      this.markFormControlsAsTouched();
      this.isFormSubmitting = false;
      return;
    }
    const formData = this.slotForm.value;
    const url : string = this.providerScheduledSlotId > 0 ? 'ProviderSchedules/rescheduleProviderScheduledSlot' : 'ProviderSchedules/saveProviderScheduledSlot'
    this.generalService.commonPost(url, formData)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (res) => {
          if(res.status !== 1 && !res.data ){
            this.generalService.showError(res.message);
            this.isFormSubmitting = false;
            return
          }
          this.generalService.showSuccess(res.message);
          this.isFormSubmitting = false;
          this.isVisible = false;
          this.formClosed.emit(this.modelTitle);
        },
        error: (err) => {
          this.generalService.showError(err.message || 'Failed to save availability.')
          this.isFormSubmitting = false;
          this.isVisible = false;
        }
      });
  }

  markFormControlsAsTouched(): void {
    Object.keys(this.slotForm.controls).forEach(field => {
      const control = this.slotForm.get(field);
      if(control){
        control.markAsTouched({ onlySelf: true });
        control.updateValueAndValidity();
      }
    });
  }

  handleCancel(): void{
    this.isVisible = false;
  }

  trackByTime(index: number): number {
    return index;
  }

}
