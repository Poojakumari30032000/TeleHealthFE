import { Injectable } from '@angular/core';
import { FormGroup, ValidatorFn } from '@angular/forms';
import { CustomValidators } from './validators';

@Injectable({
  providedIn: 'root'
})
export class ValidationService {
  private validatorPatterns: { pattern: RegExp, validators: ValidatorFn[] }[] = [
    { pattern: /phone|fax/i, validators: [CustomValidators.phoneNumberValidator()] },
    { pattern: /^(?!isSend).*email$/i, validators: [CustomValidators.emailValidator()] },
    { pattern: /zipcode|zipCode|zip_code|postalcode|postal_code/i, validators: [CustomValidators.zipCodeValidator()] },
    { pattern: /title/i, validators: [CustomValidators.titleValidator()] },
    { pattern: /ssn/i, validators: [CustomValidators.ssnValidator()] },
    { pattern: /creditcard|cardnumber|ccnumber/i, validators: [CustomValidators.creditCardValidator()] },
    { pattern: /cvc|cvv/i, validators: [CustomValidators.cvcValidator()] },
    { pattern: /password/i, validators: [CustomValidators.passwordValidator()] },
    { pattern: /npi/i, validators: [CustomValidators.npiCodeValidator()] }
  ];

  applyGlobalValidators(form: FormGroup): void {
    Object.keys(form.controls).forEach(key => {
      const control = form.get(key);

      if (control) {
        this.validatorPatterns.forEach(({ pattern, validators }) => {
          if (pattern.test(key)) {
            const existingValidators = control.validator ? [control.validator] : [];
            control.setValidators([...existingValidators, ...validators]);
            control.updateValueAndValidity();
          }
        });
      }
    });
    console.log('refactor form', form);
  }

  addValidator(pattern: RegExp, validator: ValidatorFn): void {
    this.validatorPatterns.push({ pattern, validators: [validator] });
  }
}
