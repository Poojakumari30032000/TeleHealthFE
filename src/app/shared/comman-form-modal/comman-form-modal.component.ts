import { ChangeDetectionStrategy, ChangeDetectorRef, Component, EventEmitter, Input, Output, ViewChild } from '@angular/core';
import { DynamicFormsComponent } from '../dynamic-forms/dynamic-forms.component';

@Component({
  selector: 'app-comman-form-modal',
  templateUrl: './comman-form-modal.component.html',
  styleUrl: './comman-form-modal.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class CommanFormModalComponent {

  @Output() formClosed = new EventEmitter<string>();
  @Output() formData = new EventEmitter<{ title: string , data: any }>();
  @Output() saveStarted = new EventEmitter<void>();
  @Output() validationFailed = new EventEmitter<void>();
  @ViewChild(DynamicFormsComponent) dynamicForm!: DynamicFormsComponent;
  @Input() apiUrl: { save?: string; get?: string } = {};
  @Input() width: string = "1000px";
  @Input() customModalParams: {dontShowCancel: boolean} = {dontShowCancel:true}
  title: string = '';
  type: string = 'form';
  jsonPath: string = '';
  id : number = 0;
  facilityId : number = 0;
  roleId : number = 0;
  modalFormData: any;
  isVisible: boolean = false;
  isBtnLoading: boolean = false;
  dontShowCancel: boolean = true || undefined;
  dontCloseOnKeyboard: boolean = true

  constructor( private cdr : ChangeDetectorRef ){}

  showModal(title: string, type: string, jsonPath: string , id: number, facilityId?: number, roleId? : number, formData?: any): void {
    this.isBtnLoading = false;
    console.log('apiUrl', this.apiUrl);
    console.log(this.customModalParams)

      this.dontShowCancel = this.customModalParams.dontShowCancel

    this.title = title;
    this.type = type;
    this.jsonPath = 'assets/forms-json/' + jsonPath;
    this.id = id;
    this.facilityId = facilityId || 0;
    this.roleId = roleId || 0;
    this.modalFormData = formData;
    this.isVisible = true;
    this.cdr.detectChanges();
  }

  handleOk(): void {
    if (this.dynamicForm) {
      this.isBtnLoading = true;
      this.saveStarted.emit();
      this.dynamicForm.onSubmit();
    }
  }

  onFormStatus(status: {
    success: boolean;
    message: string;
    data: any;
    isValidationError?: boolean
  }): void {
    console.log("Form submission status:", status);

    if (status.isValidationError) {
      this.isBtnLoading = false;
      this.validationFailed.emit();
      return;
    }

    this.isBtnLoading = false;
    this.isVisible = false;
    this.formClosed.emit(this.title);

    if (status.success) {
      console.log('Success:', status.message);
    } else {
      console.log('Error:', status.message);
    }
  }

  onFormSubmit(data: any){
    this.formData.emit({
      title : this.title,
      data: data
    });
    if(this.apiUrl.save )return;
    this.isBtnLoading = false;
    this.isVisible = false;
  }

  handleCancel(): void {
    this.isBtnLoading = false;
    this.isVisible = false;
  }

}
