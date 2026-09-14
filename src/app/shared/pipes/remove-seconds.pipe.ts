import { Pipe, PipeTransform } from '@angular/core';

@Pipe({
  name: 'removeSeconds'
})
export class RemoveSecondsPipe implements PipeTransform {

  transform(value: string): string {

    if (!value || !value.match(/^\d{2}:\d{2}:\d{2}$/)) {
      return value;
    }

    const [hours, minutes] = value.split(':').slice(0, 2);

    return `${hours}:${minutes}`;
  }

}
