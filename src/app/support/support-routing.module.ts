import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { SupportListViewComponent } from './support-list-view/support-list-view.component';
import { SupportDetailViewComponent } from './support-detail-view/support-detail-view.component';

const routes: Routes = [
  {
    path: '',
    redirectTo: 'list',
    pathMatch : 'full'
  },
  {
    path: 'list',
    component : SupportListViewComponent,
    data : {
      title : 'Support'
    }
  },
  {
    path: 'detail',
    component : SupportDetailViewComponent,
    data : {
      title: 'Add'
    }
  },
  {
    path: 'detail/:id',
    component : SupportDetailViewComponent,
    data : {
      title: 'Loading'
    }
  }
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule]
})
export class SupportRoutingModule { }
