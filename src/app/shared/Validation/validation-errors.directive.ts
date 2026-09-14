import { Directive, OnInit, Renderer2, ElementRef } from '@angular/core';
import { NgControl } from '@angular/forms';
import { Subject, takeUntil } from 'rxjs';

@Directive({
  selector: '[appValidationErrors]'
})
export class ValidationErrorsDirective implements OnInit {
  private errorContainer!: HTMLElement;
  private previousValue: string = '';
  private destroy$ = new Subject<void>();

  constructor(
    private renderer: Renderer2,
    private el: ElementRef,
    private ngControl: NgControl
  ) {}

  ngOnInit() {
    this.errorContainer = this.renderer.createElement('div');
    this.renderer.setStyle(this.errorContainer, 'color', 'red');
    this.renderer.setStyle(this.errorContainer, 'margin-top', '5px');
    this.renderer.setStyle(this.errorContainer, 'font-size', '12px');
    this.renderer.appendChild(this.el.nativeElement.parentNode, this.errorContainer);

    this.ngControl.statusChanges?.pipe(takeUntil(this.destroy$)).subscribe(() => {
      this.displayErrors();
    });

    this.ngControl.valueChanges?.pipe(takeUntil(this.destroy$)).subscribe((value: string) => {
      const maxLength = this.getMaxLength();
      if (value?.length > maxLength) {
        this.ngControl.control?.setValue(value.slice(0, maxLength), { emitEvent: false });
      }
      this.handleValueChange(value);
      this.displayErrors();
    });
  }

  private handleValueChange(value: string) {
    if(!value) return;
    const control = this.ngControl.control;
    const controlName = this.ngControl.name;
    if(!control || typeof controlName !== 'string') return;
    const controlNameLower = controlName.toLowerCase();

    if ((/phone|fax/i.test(controlNameLower)) && value?.length > 0) {
      let numericValue = value.replace(/\D/g, '');
      if (numericValue.length > 10) numericValue = numericValue.substring(0, 10);
      const formattedValue = numericValue
        .replace(/^(\d{3})(\d{3})(\d{4})$/, '($1) $2-$3')
        .replace(/^(\d{3})(\d{3})(\d{0,4})$/, '($1) $2-$3')
        .replace(/^(\d{3})(\d{0,3})$/, '($1) $2')
        .replace(/^(\d{0,3})$/, '($1');

      if(numericValue.length === 0){
        control.setValue(numericValue, { emitEvent: false });
        this.previousValue = numericValue;
      }else if (formattedValue !== this.previousValue) {
        control.setValue(formattedValue, { emitEvent: false });
        this.previousValue = formattedValue;
      }
      return;
    }

    if (controlNameLower.includes('npi')) {
      let numericValue = value.replace(/\D/g, '');
      if (numericValue.length > 10) numericValue = numericValue.substring(0, 10);
      control.setValue(numericValue, { emitEvent: false });
      return;
    }

    if (controlNameLower.includes('zipcode')) {
      let numericValue = value.replace(/\D/g, '');
      if (numericValue.length > 5) numericValue = numericValue.substring(0, 5);
      control.setValue(numericValue, { emitEvent: false });
      return;
    }

    if (controlNameLower.includes('ssn') && value?.length > 0) {
      let numericValue = value.replace(/\D/g, '');
      if (numericValue.length > 9)  numericValue = numericValue.substring(0, 9);
      const formattedValue = numericValue
        .replace(/^(\d{3})(\d{2})(\d{4})$/, '$1-$2-$3')
        .replace(/^(\d{3})(\d{2})(\d{0,4})$/, '$1-$2-$3')
        .replace(/^(\d{3})(\d{0,2})$/, '$1-$2')
        .replace(/^(\d{0,3})$/, '$1');

      if(numericValue.length === 0){
        control.setValue(numericValue, { emitEvent: false });
        this.previousValue = numericValue;
      }else if (formattedValue !== this.previousValue) {
        control.setValue(formattedValue, { emitEvent: false });
        this.previousValue = formattedValue;
      }
      return;
    }

    if (controlNameLower.includes('cardnumber')) {
      let numericValue = value.replace(/\D/g, '');
      if (numericValue.length > 16) numericValue = numericValue.substring(0, 16);
      const formattedValue = numericValue
        .replace(/(\d{4})(?=\d)/g, '$1 ')
        .trim();
      if(numericValue.length === 0){
        control.setValue(numericValue, { emitEvent: false });
        this.previousValue = numericValue;
      }else if (formattedValue !== this.previousValue) {
        control.setValue(formattedValue, { emitEvent: false });
        this.previousValue = formattedValue;
      }
      return;
    }

    if (controlNameLower.includes('cvc') || controlNameLower.includes('cvv')) {
      const numericValue = value.replace(/\D/g, '').substring(0, 4);
      if(numericValue.length === 0){
        control.setValue(numericValue, { emitEvent: false });
        this.previousValue = numericValue;
      }else if (numericValue !== this.previousValue) {
        control.setValue(numericValue, { emitEvent: false });
        this.previousValue = numericValue;
      }
      return;
    }

  }

  private displayErrors() {
    const errors = this.ngControl.errors;
    const messages: string[] = [];
    const element = this.el.nativeElement;

    const isDarkMode = document.documentElement.classList.contains('dark');

    if (this.ngControl.value || this.ngControl.dirty || this.ngControl.touched) {
      if (errors) {
        for (const errorName in errors) {
          if (errors.hasOwnProperty(errorName)) {
            messages.push(this.getErrorMessage(errorName));
          }
        }
        if (!isDarkMode) {
          this.renderer.addClass(element, 'bg-danger-50');
        }
        this.renderer.addClass(element, 'border-danger-500');
        this.renderer.addClass(element, 'in-valid');
      } else {

        this.renderer.removeClass(element, 'bg-danger-50');
        this.renderer.removeClass(element, 'border-danger-500');
        this.renderer.removeClass(element, 'in-valid');
      }
    } else {

      this.renderer.removeClass(element, 'bg-danger-50');
      this.renderer.removeClass(element, 'border-danger-500');
      this.renderer.removeClass(element, 'in-valid');
    }

    this.errorContainer.innerHTML = messages.join('<br>');
  }

  private getErrorMessage(errorName: string): string {
    const messages = {
      required: 'This field is required',
      invalidPhoneNumber: 'Invalid format (XXX) XXX-XXXX',
      invalidEmail: 'Invalid email format (xx@xx.xx)',
      invalidZipCode: 'Invalid zip code format (XXXXX)',
      invalidName: 'Invalid, only alphabets are allowed',
      invalidSSN: 'Invalid SSN format (XXX-XX-XXXX)',
      invalidCardNumber: 'Invalid card number format (#### #### #### ####)',
      invalidCVC: 'Invalid CVC format (3-4 digits only)',
      noUpperCase: 'Password must include at least one uppercase letter',
      noLowerCase: 'Password must include at least one lowercase letter',
      noSpecialCharacter: 'Password must include at least one special character',
      noNumber: 'Password must include at least one number',
      invalidLength: 'Password must be between 8 and 20 characters long',
      invalidNpi: 'Npi should be upto 10 digits and contain numeric values'
    };
    return messages[errorName as keyof typeof messages] || 'Invalid input';
  }

  private getMaxLength(): number {
    const controlName = this.ngControl.name;
    if (typeof controlName === 'string') {
      const controlNameLower = controlName.toLowerCase();
      if ((/phone|fax/i.test(controlNameLower))) {
        return 14;
      } else if (controlNameLower.includes('zipcode')) {
        return 5;
      } else if (controlNameLower.includes('ssn')) {
        return 11;
      } else if (controlNameLower.includes('cardnumber')) {
        return 19;
      } else if (controlNameLower.includes('cvc') || controlNameLower.includes('cvv')) {
        return 4;
      }

      else if (controlNameLower.includes('npi')) {
        return 10;
      }
    }
    return Infinity;
  }

  ngOnDestroy() {
    this.destroy$.next();
    this.destroy$.complete();
    if (this.errorContainer && this.el.nativeElement.parentNode) {
      this.renderer.removeChild(this.el.nativeElement.parentNode, this.errorContainer);
    }
  }

}
