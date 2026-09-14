import { AbstractControl, ValidationErrors, ValidatorFn } from '@angular/forms';

export class CustomValidators {
  static phoneNumberValidator(): ValidatorFn {
    return (control: AbstractControl): ValidationErrors | null => {
      const value = control.value as string;

      if (value === null || value?.length === 0) {
        return null;
      }

      const isValidFormat = /^\(\d{3}\) \d{3}-\d{4}$/.test(value);
      return isValidFormat ? null : { invalidPhoneNumber: true };
    };
  }

static emailValidator(): ValidatorFn {
  return (control: AbstractControl): ValidationErrors | null => {
    const value = control.value as string;

    if (value === null || value?.length === 0) {
      return null;
    }

    const valid = /^[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}$/i.test(value);
    return valid ? null : { invalidEmail: true };
  };
}

  static zipCodeValidator(): ValidatorFn {
    return (control: AbstractControl): ValidationErrors | null => {
      const value = control.value as string;

      if (value === null || value?.length === 0) {
        return null;
      }

      const valid = /^[0-9]{1,5}$/.test(value);
      return valid ? null : { invalidZipCode: true };
    };
  }

  static npiCodeValidator(): ValidatorFn {
    return (control: AbstractControl): ValidationErrors | null => {
      const value = control.value as string;

      if (value === null || value?.length === 0) {
        return null;
      }

      const valid = /^[0-9]{1,10}$/.test(value);
      return valid ? null : { invalidNpiCode: true };
    };
  }

  static nameValidator(): ValidatorFn {
    return (control: AbstractControl): ValidationErrors | null => {
      const value = control.value as string;

      if (value === null || value?.length === 0) {
        return null;
      }

      const valid = /^[a-zA-Z-_\s]+$/.test(value);
      return valid ? null : { invalidName: true };
    };
  }

  static titleValidator(): ValidatorFn {
    return (control: AbstractControl): ValidationErrors | null => {
      const value = control.value as string;

      if (value === null || value?.length === 0) {
        return null;
      }

      const valid = /^[a-zA-Z0-9\-_,.&\/'"():\s]+$/.test(value);
      return valid ? null : { invalidName: true };
    };
  }

  static ssnValidator(): ValidatorFn {
    return (control: AbstractControl): ValidationErrors | null => {
      const value = control.value as string;

      if (value === null || value?.length === 0) {
        return null;
      }

      const regex = /^(?!666|000|9\d{2})\d{3}-(?!00)\d{2}-(?!0{4})\d{4}$/;
      const valid = regex.test(value);

      return valid ? null : { invalidSSN: true };
    };
  }

  static creditCardValidator(): ValidatorFn {
    return (control: AbstractControl): ValidationErrors | null => {
      const value = control.value as string;

      if (value === null || value?.length === 0) {
        return null;
      }

      const valid = /^\d{4} \d{4} \d{4} \d{4}$/.test(value);
      return valid ? null : { invalidCardNumber: true };
    };
  }

  static cvcValidator(): ValidatorFn {
    return (control: AbstractControl): ValidationErrors | null => {
      const value = control.value as string;

      if (value === null || value?.length === 0) {
        return null;
      }

      const valid = /^\d{3,4}$/.test(value);
      return valid ? null : { invalidCVC: true };
    };
  }

  static passwordValidator(): ValidatorFn {
    return (control: AbstractControl): ValidationErrors | null => {
      const value = control.value as string;

      if (!value) {
        return null;
      }

      const hasUpperCase = /[A-Z]/.test(value);
      const hasLowerCase = /[a-z]/.test(value);
      const hasSpecialCharacter = /[!@#$%^&*(),.?":{}|<>]/.test(value);
      const hasNumber = /[0-9]/.test(value);
      const isValidLength = value.length >= 8 && value.length <= 20;

      const errors: ValidationErrors = {};
      if (!hasUpperCase) {
        errors['noUpperCase'] = true;
      }
      if (!hasLowerCase) {
        errors['noLowerCase'] = true;
      }
      if (!hasSpecialCharacter) {
        errors['noSpecialCharacter'] = true;
      }
      if (!hasNumber) {
        errors['noNumber'] = true;
      }
      if (!isValidLength) {
        errors['invalidLength'] = true;
      }

      return Object.keys(errors).length > 0 ? errors : null;
    };
  }

}
