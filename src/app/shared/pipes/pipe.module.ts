import { NgModule } from '@angular/core';
import {CommonModule} from "@angular/common";

import { FilterPipe } from './filter.pipe';
import { SearchPipe } from './search.pipe';
import { ShortNamePipe } from './short-name.pipe';
import { RemoveSecondsPipe } from './remove-seconds.pipe';
import { TruncatePipe } from './truncate.pipe';
import { IsArrayPipe } from './is-array.pipe';

@NgModule({
  declarations:[FilterPipe, SearchPipe, ShortNamePipe, RemoveSecondsPipe, TruncatePipe, IsArrayPipe],
  imports:[CommonModule],
  exports:[FilterPipe, SearchPipe, ShortNamePipe, RemoveSecondsPipe, TruncatePipe, IsArrayPipe]
})

export class PipeModule{}
