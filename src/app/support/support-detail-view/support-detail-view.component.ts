import { ChangeDetectionStrategy, ChangeDetectorRef, Component, ViewChild } from '@angular/core';
import { QuillEditorComponent } from 'ngx-quill';
import { environment } from "environments/environment";
import { NzUploadChangeParam, NzUploadFile } from 'ng-zorro-antd/upload';
import { Subject, takeUntil, tap, throwError, catchError } from 'rxjs';
import { GeneralService } from 'app/shared/services/general.service';
import { AuthService } from 'app/shared/Auth/auth.service';
import { TitleService } from 'app/shared/services/title.service';
import { ActivatedRoute, Router } from '@angular/router';

interface UserData {
  firstName: string;
  lastName: string;
  photoURL: string;
}

interface UploadTicketFile {
  ticketFileURL: string;
  ticketFileName: string;
  createdDate: string;
  type: 'New' | 'Previous';
}

interface TicketComment {
  ticketCommentId: number;
  comment: string;
  createdBy: string;
  createdDate: string;
  createdByImage: string;
  type: 'New' | 'Previous';
}

@Component({
  selector: 'app-support-detail-view',
  templateUrl: './support-detail-view.component.html',
  styleUrl: './support-detail-view.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class SupportDetailViewComponent {

  @ViewChild('desc', { static: true }) adminNotesEditor!: QuillEditorComponent;
  @ViewChild('commentEditor', { static: false }) commentEditor!: QuillEditorComponent;

  private destroy$ = new Subject<void>();
  readonly MAX_FILE_SIZE_MB = 2;
  readonly FILE_TYPES = {
    image: ['.jpg', '.jpeg', '.png', '.gif'],
    pdf: ['.pdf'],
    video: ['.mp4', '.mov', '.avi', '.mkv']
  };

  isLoading: boolean = false;
  isBtnLoading: boolean = false;
  ticketId = 0;
  userData: UserData | null = null;
  subject = '';
  description = '';
  ticketStatus = 'Pending';
  uploadTicketFile: UploadTicketFile[] = [];
  commentsList: TicketComment[] = [];
  uploadAction = `${environment.IAMGE_PATH}/api/Commons/UploadFile`;
  token = '';
  commentData = '';
  selectedFacility = 0;

  modules = {
    toolbar: [
      ['bold', 'italic', 'underline', 'strike'],
      ['blockquote', 'code-block'],
      [{ list: 'ordered' }, { list: 'bullet' }],
      [{ header: [1, 2, 3, 4, 5, 6, false] }],
      [{ color: [] }, { background: [] }],
      ['link'],
      ['clean'],
    ]
  };

  constructor(
    private cdr: ChangeDetectorRef,
    private generalService: GeneralService,
    private auth: AuthService,
    private titleService: TitleService,
    private route: ActivatedRoute,
    private router: Router
  ) {}

  ngOnInit(): void {
    this.token = this.auth.getToken() || '';
    this.resetForm();
    this.userData = this.auth.getUserData();
    this.selectedFacility = Number(localStorage.getItem('FOS')) || 0;
    this.ticketId = Number(this.route.snapshot.paramMap.get('id'));
    if(this.ticketId){
      this.loadTicketData();
    }else{
      this.titleService.updateTitle(
        'Add Support',
        [
          { label: 'Support', path: '/support'},
          { label: 'Details', path: '/support/detail'}
        ]
      );
    }
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  private resetForm(): void {
    this.subject = '';
    this.description = '';
    this.ticketStatus = 'Pending';
    this.commentData = '';
    this.commentsList = [];
    this.uploadTicketFile = [];
  }

  handleChange({ file }: NzUploadChangeParam): void {
    if (file.status === 'done') {
      this.uploadTicketFile.push({
        ticketFileName: file.response?.fileDetails?.fileName,
        ticketFileURL: file.response?.fileDetails?.filePath || '',
        createdDate: 'Just Now',
        type: 'New'
      });
    }
  }

  beforeUpload = (file: NzUploadFile): boolean => {
    const isSizeValid = (file.size || 0) / 1024 / 1024 < this.MAX_FILE_SIZE_MB;
    if (!isSizeValid) {
      this.generalService.showError(`File must be smaller than ${this.MAX_FILE_SIZE_MB}MB!`);
    }
    return isSizeValid;
  };

  getFileType(file: UploadTicketFile): string {
    const extension = file.ticketFileURL.substring(file.ticketFileURL.lastIndexOf('.')).toLowerCase();

    return Object.entries(this.FILE_TYPES).find(([_, extensions]) =>
      extensions.includes(extension)
    )?.[0] || 'default';
  }

  deleteItem(index: number): void {
    this.uploadTicketFile.splice(index, 1);
  }

  openFile(file: any): void {
    window.open(file.ticketFileURL, '_blank');
  }

  saveComment(): void {
    if (!this.userData || !this.commentData.trim()) return;

    this.commentsList.push({
      ticketCommentId: 0,
      comment: this.commentData,
      createdBy: `${this.userData.firstName} ${this.userData.lastName}`,
      createdDate: 'Just Now',
      createdByImage: this.userData.photoURL,
      type: 'New'
    });

    this.clearComment();
  }

  clearComment(): void {
    this.commentData = '';
    this.cdr.markForCheck();
  }

  handleOk(): void {
    if (!this.validateForm()) return;

    this.isBtnLoading = true;
    const payload = this.createPayload();

    this.generalService.commonPost("Tickets/saveTicket", payload)
      .pipe(
        takeUntil(this.destroy$),
        tap(() => {
          this.generalService.showSuccess(
            this.ticketId ? "Ticket Updated Successfully!" : "Ticket Created Successfully!"
          );
          this.isBtnLoading = false;
          this.moveBack();
        }),
        catchError((error) => {
          this.isBtnLoading = false;
          return throwError(error);
        })
      ).subscribe();
  }

  moveBack(): void {
    this.router.navigate(['/support/list']);
  }

  private validateForm(): boolean {
    if (!this.ticketStatus) {
      this.generalService.showError('Please select ticket status');
      return false;
    }

    if (!this.subject?.trim() || !this.description?.trim()) {
      this.generalService.showError('Please fill all required fields');
      return false;
    }

    return true;
  }

  private createPayload() {
    return {
      facilityId: this.selectedFacility,
      ticketId: this.ticketId,
      subject: this.subject,
      description: this.description,
      status: this.ticketStatus,
      uploadTicketFile: this.uploadTicketFile.filter(f => f.type === 'New'),
      ticketComment: this.commentsList.filter(c => c.type === 'New'),
      name: this.userData ? `${this.userData.firstName} ${this.userData.lastName}` : ''
    };
  }

  private loadTicketData(): void {
    this.isLoading = true;
    this.generalService.commonGet(`Tickets/getTicketById?Id=${this.ticketId}`)
      .pipe(
        takeUntil(this.destroy$),
        tap(res => {
          if (res.status === 1) {
            this.patchFormValues(res.data);
            this.titleService.updateTitle(
              res.data.subject,
              [
                { label: 'Support', path: '/support'},
                { label: 'Details', path: `/support/detail/${this.ticketId}`}
              ]
            );
            this.isLoading = false;
            return;
          }
          this.isLoading = false;
        })
      ).subscribe();
  }

  private patchFormValues(data: any): void {
    this.ticketId = data.ticketId;
    this.selectedFacility = data.facilityId;
    this.subject = data.subject;
    this.description = data.description;
    this.ticketStatus = data.status || 'Pending';

    this.uploadTicketFile = [
      ...(data.uploadTicketFile || []).map((f: UploadTicketFile) => ({ ...f, type: 'Previous' }))
    ];

    this.commentsList = [
      ...(data.ticketComment || []).map((c: TicketComment) => ({ ...c, type: 'Previous' }))
    ];

    this.cdr.markForCheck();
  }

}
