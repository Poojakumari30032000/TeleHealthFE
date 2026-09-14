import { ChangeDetectionStrategy, ChangeDetectorRef, Component, EventEmitter, Input, Output } from '@angular/core';
import { GeneralService } from 'app/shared/services/general.service';
import { DatePipe } from '@angular/common';
import { Subject, takeUntil } from 'rxjs';

interface ScheduleSlot {
  providerScheduledSlotId: number;
  slotDate: string;
  startTime: Date;
  endTime: Date;
  duration: number;
  providerId: number;
  providerName: string;
}

interface TimeSlotGroup {
  startTime: Date;
  endTime: Date;
  slots: ScheduleSlot[];
}

@Component({
  selector: 'app-visit-provider',
  templateUrl: './visit-provider.component.html',
  styleUrls: ['./visit-provider.component.css'],
  providers: [DatePipe],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class VisitProviderComponent {

  @Input() categoryId: number = 0;
  @Input() providerApt: any = null;
  @Output() onContinue = new EventEmitter<any>();
  @Output() onPrevious = new EventEmitter<any>();

  timeSlotGroups: TimeSlotGroup[] = [];
  selectedTimeGroup: TimeSlotGroup | null = null;
  selectedSlot: ScheduleSlot | null = null;
  selectedDate: Date | null = null;
  isLoading: boolean = false;
  currentDate = new Date();
  private destroy$ = new Subject<void>();

  constructor(
    private generalService: GeneralService,
    private datePipe: DatePipe,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit(){
    if(this.providerApt){
      this.initializeFromExistingAppointment();
    }
  }

  private async initializeFromExistingAppointment() {
    const apt = this.providerApt;
    if (apt?.selectedDate && apt?.selectedSlot) {
      this.selectedDate = new Date(apt.selectedDate);
      await this.fetchAvailableSlots();

      this.selectedTimeGroup = this.timeSlotGroups.find(g =>
        g.slots.some(s => s.providerScheduledSlotId === apt.selectedSlot.providerScheduledSlotId)
      ) || null;

      if (this.selectedTimeGroup) {
        this.selectedSlot = this.selectedTimeGroup.slots.find(
          s => s.providerScheduledSlotId === apt.selectedSlot.providerScheduledSlotId
        ) || null;
      }
    }
  }

  disabledDate = (date: Date): boolean => {
    return date < this.stripTime(this.currentDate);
  };

  private stripTime(date: Date): Date {
    return new Date(date.getFullYear(), date.getMonth(), date.getDate());
  }

  onDateChange(date: Date): void {
    this.selectedDate = date;
    this.selectedTimeGroup = null;
    this.selectedSlot = null;
    this.fetchAvailableSlots();
  }

  private fetchAvailableSlots(): Promise<void> {
    return new Promise((resolve, reject) => {
      if (!this.selectedDate || !this.categoryId) {
        reject('Invalid date or category ID');
        return;
      }

      this.isLoading = true;
      const formattedDate = this.datePipe.transform(this.selectedDate, 'yyyy-MM-dd');
      const now = new Date();
      const clientTime = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}T${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}:${String(now.getSeconds()).padStart(2, '0')}`;
      const tzOffset = -now.getTimezoneOffset();

      this.generalService.commonGet(
        `UnAuthorize/getProviderScheduledSlots?CategoryId=${this.categoryId}&Date=${formattedDate}&ClientCurrentTime=${encodeURIComponent(clientTime)}&ClientTimezoneOffsetMinutes=${tzOffset}`
      ).pipe(takeUntil(this.destroy$)).subscribe({
        next: (response) => {
          const rawSlots = response?.data ?? [];
          const slots = (Array.isArray(rawSlots) ? rawSlots : []).map((slot: any) => {
            const slotDateStr = slot.slotDate != null ? String(slot.slotDate) : '';
            const datePart = slotDateStr.includes('T') ? slotDateStr.split('T')[0] : slotDateStr.slice(0, 10);

            const startStr = (slot.startTime != null ? String(slot.startTime) : '00:00:00').slice(0, 8);
            const endStr = (slot.endTime != null ? String(slot.endTime) : '00:00:00').slice(0, 8);
            const startDateTime = `${datePart}T${startStr}`;
            const endDateTime = `${datePart}T${endStr}`;
            return {
              ...slot,
              startTime: new Date(startDateTime),
              endTime: new Date(endDateTime),
            };
          });

          const groupsMap = new Map<string, TimeSlotGroup>();
          slots.forEach((slot: any) => {
            const key = `${slot.startTime.getTime()}-${slot.endTime.getTime()}`;
            if (!groupsMap.has(key)) {
              groupsMap.set(key, {
                startTime: slot.startTime,
                endTime: slot.endTime,
                slots: [slot]
              });
            } else {
              groupsMap.get(key)?.slots.push(slot);
            }
          });

          this.timeSlotGroups = Array.from(groupsMap.values());
          this.isLoading = false;
          this.cdr.markForCheck();
          resolve();
        },
        error: (error) => {
          console.error('Error fetching slots:', error);
          this.isLoading = false;
          this.cdr.markForCheck();
          reject(error);
        }
      });
    });
  }

  selectTimeGroup(group: TimeSlotGroup): void {
    this.selectedTimeGroup = group;
    this.selectedSlot = null;
    this.cdr.markForCheck();
  }

  selectProvider(slot: ScheduleSlot): void {
    this.selectedSlot = slot;
    this.cdr.markForCheck();
  }

  continue(): void {
    if (this.selectedTimeGroup && this.selectedSlot) {
      const providerApt = {
        providerScheduledSlotId: this.selectedSlot.providerScheduledSlotId,
        selectedDate: this.selectedDate,
        slot: this.selectedSlot
      }
      const data = { stage: 'continue', providerApt: providerApt };
      this.onContinue.emit(data);
    } else if (this.selectedDate) {
      this.selectedTimeGroup = null;
      this.selectedSlot = null;
    }
  }

  goToPreviousStep(): void {
    if (this.selectedTimeGroup) {
      this.selectedTimeGroup = null;
      this.selectedSlot = null;
    } else if (this.selectedDate) {
      this.selectedDate = null;
      this.timeSlotGroups = [];
    } else {
      this.onPrevious.emit({ stage: 'previous' });
    }
  }

  ngOnDestroy(): void{
    this.destroy$.next();
    this.destroy$.complete();
  }

}
