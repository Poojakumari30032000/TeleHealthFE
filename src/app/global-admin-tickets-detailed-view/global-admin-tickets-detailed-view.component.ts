import { CommonModule, Location } from '@angular/common';
import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  EventEmitter,
  Input,
  OnChanges,
  OnInit,
  OnDestroy,
  Output,
  SimpleChanges,
  ViewChild
} from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { Subject, finalize, takeUntil } from 'rxjs';
import {FormBuilder, FormControl, FormGroup, FormsModule, ReactiveFormsModule, Validators} from '@angular/forms';

import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzModalModule } from 'ng-zorro-antd/modal';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzSelectModule } from 'ng-zorro-antd/select';
import { NzTableModule } from 'ng-zorro-antd/table';
import { NzCollapseModule } from 'ng-zorro-antd/collapse';
import { NzTabsModule } from 'ng-zorro-antd/tabs';

import { GeneralService } from 'app/shared/services/general.service';
import {CommanFormModalComponent} from "../shared/comman-form-modal/comman-form-modal.component";
import {SharedModule} from "../shared/shared.module";

export enum TicketPriority {
  Low = 1,
  Medium = 2,
  High = 3
}

export enum TicketStatus {
  Pending = 1,
  InProgress = 2,
  Review = 3,
  Closed = 4
}

interface ApiResponse<T = any> {
  status: number;
  success: boolean | null;
  message: string;
  count: number;
  data: T;
  totalEntityCount?: number | null;
  totalPages?: number | null;
}

type TicketComment = {
  ticketCommentId: number;
  comment: string;
  createdBy: string;
  createdDate: string;
  createdByImage: string | null;
};

type TicketDocument = {
  ticketFileId?: number;
  ticketFileName: string;
  description: string;
  ticketFileURL: string;
};

type TicketDetails = {
  id: number;
  ticketId: number;
  title: string;
  priority: TicketPriority;
  status: TicketStatus;
  createdBy: string;
  createdDate: string;
  description: string;
  documents: TicketDocument[];
  comments: TicketComment[];
};

@Component({
  selector: 'app-global-admin-tickets-detailed-view',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    FormsModule,
    NzButtonModule,
    NzModalModule,
    NzInputModule,
    NzSelectModule,
    NzTableModule,
    NzCollapseModule,
    NzTabsModule,
    SharedModule,
  ],
  templateUrl: './global-admin-tickets-detailed-view.component.html',
  styleUrl: './global-admin-tickets-detailed-view.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class GlobalAdminTicketsDetailedViewComponent implements OnInit, OnChanges, OnDestroy {
  @Input() ticketIdInput: number | null = null;
  @Input() embeddedInTabs = false;
  @Output() backToList = new EventEmitter<void>();

  @ViewChild('commanModel', { static: false }) commanModel!: CommanFormModalComponent;

  private destroy$ = new Subject<void>();

  ticketId: number = 0;

  isLoading = false;
  hasError = false;

  details: TicketDetails | null = null;

  editModalVisible = false;
  saving = false;
  editForm: FormGroup;

  statusModalVisible = false;
  isUpdatingStatus = false;
  statusControl = new FormControl<TicketStatus | null>(null, { validators: [Validators.required] });

  addingComment = false;
  newComment = '';

  modalApiUrl: { save?: string; get?: string } = { save: 'Tickets/createTicketDocument', get: '' };

  priorityOptions = [
    { value: TicketPriority.Low, label: 'Low' },
    { value: TicketPriority.Medium, label: 'Medium' },
    { value: TicketPriority.High, label: 'High' }
  ];

  statusOptions = [
    { value: TicketStatus.Pending, label: 'Pending' },
    { value: TicketStatus.InProgress, label: 'In Progress' },
    { value: TicketStatus.Review, label: 'Review' },
    { value: TicketStatus.Closed, label: 'Closed' }
  ];

  constructor(
    private ar: ActivatedRoute,
    private location: Location,
    private generalService: GeneralService,
    private cdr: ChangeDetectorRef,
    private fb: FormBuilder
  ) {
    this.editForm = this.fb.group({
      subject: ['', [Validators.required, Validators.maxLength(200)]],
      description: ['', [Validators.required, Validators.maxLength(4000)]],
      priority: [TicketPriority.Medium, [Validators.required]],
      contactEmail: ['', [Validators.email]]
    });
  }

  ngOnInit(): void {
    this.ticketId = this.resolveTicketId();
    this.loadDetails();
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (!changes['ticketIdInput']) return;

    const nextTicketId = Number(this.ticketIdInput ?? 0);
    if (!nextTicketId || nextTicketId === this.ticketId) return;

    this.ticketId = nextTicketId;
    this.loadDetails();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  priorityLabel(p?: TicketPriority | null): string {
    const found = this.priorityOptions.find((x) => x.value === p);
    return found ? found.label : '--';
  }

  statusLabel(s?: TicketStatus | null): string {
    const found = this.statusOptions.find((x) => x.value === s);
    return found ? found.label : '--';
  }

  priorityBadgeClass(p?: TicketPriority | null): string {
    switch (p) {
      case TicketPriority.Low:
        return 'ui-status-badge--success';
      case TicketPriority.Medium:
        return 'ui-status-badge--pending';
      case TicketPriority.High:
        return 'ui-status-badge--danger';
      default:
        return 'ui-status-badge--neutral';
    }
  }

  statusBadgeClass(s?: TicketStatus | null): string {
    switch (s) {
      case TicketStatus.Pending:
        return 'ui-status-badge--pending';
      case TicketStatus.InProgress:
        return 'ui-status-badge--info';
      case TicketStatus.Review:
        return 'ui-status-badge--created';
      case TicketStatus.Closed:
        return 'ui-status-badge--success';
      default:
        return 'ui-status-badge--neutral';
    }
  }

  getTicketInitials(title?: string | null): string {
    const clean = String(title || '').trim();
    if (!clean) return 'TK';
    const parts = clean.split(/\s+/).filter(Boolean);
    const first = parts[0] ?? '';
    if (parts.length === 1) return first.slice(0, 2).toUpperCase();
    const second = parts[1] ?? '';
    return `${first.charAt(0)}${second.charAt(0)}`.toUpperCase();
  }

  getCommentInitials(name?: string | null): string {
    const clean = String(name || '').trim();
    if (!clean) return 'U';
    const parts = clean.split(/\s+/).filter(Boolean);
    const first = parts[0] ?? '';
    if (parts.length === 1) return first.slice(0, 2).toUpperCase();
    const second = parts[1] ?? '';
    return `${first.charAt(0)}${second.charAt(0)}`.toUpperCase();
  }

  loadDetails(options: { silent?: boolean } = {}): void {
    if (!this.ticketId) return;
    const silent = options.silent === true;

    if (!silent) {
      this.isLoading = true;
      this.hasError = false;
    }

    this.generalService
      .commonGet(`Tickets/getTicketDetailsById?Id=${this.ticketId}`)
      .pipe(
        takeUntil(this.destroy$),
        finalize(() => {
          if (!silent) {
            this.isLoading = false;
          }
          this.cdr.markForCheck();
        })
      )
      .subscribe({
        next: (res: ApiResponse<TicketDetails>) => {
          if (res?.status === 1 && res?.data) {
            const d = res.data as any;

            this.details = {
              id: Number(d.id ?? d.ticketId ?? 0),
              ticketId: Number(d.ticketId ?? d.id ?? 0),
              title: String(d.title ?? ''),
              priority: Number(d.priority ?? TicketPriority.Medium) as TicketPriority,
              status: Number(d.status ?? TicketStatus.Pending) as TicketStatus,
              createdBy: String(d.createdBy ?? '--'),
              createdDate: String(d.createdDate ?? ''),
              description: String(d.description ?? ''),
              documents: Array.isArray(d.documents) ? d.documents : [],
              comments: Array.isArray(d.comments) ? d.comments : []
            };

            this.editForm.patchValue({
              subject: this.details.title ?? '',
              description: this.details.description ?? '',
              priority: this.details.priority ?? TicketPriority.Medium,
              contactEmail: ''
            });

            this.statusControl.setValue(this.details.status ?? TicketStatus.Pending);
          } else {
            if (!silent) {
              this.hasError = true;
              this.details = null;
            }
            this.generalService.showError(res?.message || 'Failed to load ticket details.');
          }
        },
        error: () => {
          if (!silent) {
            this.hasError = true;
            this.details = null;
          }
          this.generalService.showError('Failed to load ticket details.');
        }
      });
  }

  moveBack(): void {
    if (this.embeddedInTabs) {
      this.backToList.emit();
      return;
    }
    this.location.back();
  }

  private resolveTicketId(): number {
    const idFromInput = Number(this.ticketIdInput ?? 0);
    if (idFromInput > 0) return idFromInput;
    return Number(this.ar.snapshot.paramMap.get('id') ?? 0);
  }

  openEdit(): void {
    if (!this.details) return;

    this.editForm.patchValue({
      subject: this.details.title ?? '',
      description: this.details.description ?? '',
      priority: this.details.priority ?? TicketPriority.Medium
    });

    this.editModalVisible = true;
    this.cdr.markForCheck();
  }

  closeEdit(): void {
    this.editModalVisible = false;
    this.cdr.markForCheck();
  }

  saveEdits(): void {
    if (!this.details) return;

    if (this.editForm.invalid) {
      this.editForm.markAllAsTouched();
      return;
    }

    const v = this.editForm.getRawValue();

    const payload = {
      ticketId: this.details.ticketId,
      subject: String(v.subject || '').trim(),
      description: String(v.description || '').trim(),
      priority: Number(v.priority),
      contactEmail: String(v.contactEmail || '').trim()
    };

    this.saving = true;
    this.generalService
      .commonPost('Tickets/saveTicket', payload)
      .pipe(
        takeUntil(this.destroy$),
        finalize(() => {
          this.saving = false;
          this.cdr.markForCheck();
        })
      )
      .subscribe({
        next: (res: ApiResponse<number>) => {
          const ok = res?.status === 1 || res?.success === true;
          if (!ok) {
            this.generalService.showError(res?.message || 'Failed to update ticket.');
            return;
          }

          this.generalService.showSuccess(res?.message || 'Ticket updated successfully.');
          this.editModalVisible = false;
          this.loadDetails();
        },
        error: () => {
          this.generalService.showError('Failed to update ticket.');
        }
      });
  }

  openUpdateStatus(): void {
    if (!this.details) return;
    this.statusControl.setValue(this.details.status ?? TicketStatus.Pending);
    this.statusModalVisible = true;
    this.cdr.markForCheck();
  }

  handleStatusCancel(): void {
    this.statusModalVisible = false;
    this.cdr.markForCheck();
  }

  confirmUpdateStatus(): void {
    if (!this.details) return;
    if (this.statusControl.invalid) {
      this.statusControl.markAsTouched();
      return;
    }

    const payload = {
      id: this.details.ticketId,
      status: Number(this.statusControl.value)
    };

    this.isUpdatingStatus = true;
    this.generalService
      .commonPost('Tickets/updateTicketStatus', payload)
      .pipe(
        takeUntil(this.destroy$),
        finalize(() => {
          this.isUpdatingStatus = false;
          this.cdr.markForCheck();
        })
      )
      .subscribe({
        next: (res: ApiResponse<any>) => {
          const ok = res?.status === 1 || res?.success === true;
          if (!ok) {
            this.generalService.showError(res?.message || 'Failed to update status.');
            return;
          }

          this.generalService.showSuccess(res?.message || 'Status updated successfully.');
          this.statusModalVisible = false;
          this.loadDetails();
        },
        error: () => {
          this.generalService.showError('Failed to update status.');
        }
      });
  }

  addComment(): void {
    if (!this.details) return;

    const comment = (this.newComment || '').trim();
    if (!comment) return;

    const payload = {
      ticketId: this.details.ticketId,
      comment
    };

    this.addingComment = true;
    this.generalService
      .commonPost('Tickets/addTicketComment', payload)
      .pipe(
        takeUntil(this.destroy$),
        finalize(() => {
          this.addingComment = false;
          this.cdr.markForCheck();
        })
      )
      .subscribe({
        next: (res: ApiResponse<any>) => {
          const ok = res?.status === 1 || res?.success === true;
          if (!ok) {
            this.generalService.showError(res?.message || 'Failed to add comment.');
            return;
          }

          this.generalService.showSuccess(res?.message || 'Comment added.');
          this.newComment = '';
          this.loadDetails({ silent: true });
        },
        error: () => {
          this.generalService.showError('Failed to add comment.');
        }
      });
  }

  deleteComment(commentId: number): void {
    if (!commentId) return;

    this.generalService
      .commonConfirm('Confirmation', 'Are you sure you want to delete this comment?')
      .pipe(takeUntil(this.destroy$))
      .subscribe((confirmed: boolean) => {
        if (!confirmed) return;

        const payload = { id: commentId };

        this.generalService
          .commonPost('Tickets/deleteTicketComment', payload)
          .pipe(takeUntil(this.destroy$))
          .subscribe({
            next: (res: ApiResponse<any>) => {
              const ok = res?.status === 1 || res?.success === true;
              if (!ok) {
                this.generalService.showInfo(res?.message || 'Failed to delete comment.');
                return;
              }

              this.generalService.showInfo(res?.message || 'Comment deleted.');
              this.loadDetails();
            },
            error: () => this.generalService.showError('Failed to delete comment.')
          });
      });
  }

  trackByCommentId = (_: number, c: TicketComment) => c.ticketCommentId;

  viewDocument(doc: TicketDocument): void {
    if (!doc?.ticketFileURL) return;
    window.open(doc.ticketFileURL, '_blank');
  }

  uploadDocument(): void {
    if (!this.details) return;

    const title = 'Upload Document';
    const ID = this.details.ticketId;

    const formPath = 'treatment/uploadTicketDocument.json';

    this.modalApiUrl = { save: 'Tickets/createTicketDocument', get: '' };
    this.commanModel.showModal(title, 'form', formPath, ID);
  }

  get commentsDesc(): TicketComment[] {
    return (this.details?.comments || []).slice().reverse();
  }

  onDocumentFormClosed(): void {
    this.loadDetails();
  }
}
