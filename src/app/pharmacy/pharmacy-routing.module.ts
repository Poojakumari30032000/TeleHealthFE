import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { PharmacyListViewComponent } from './pharmacy-list-view/pharmacy-list-view.component';
import { PharmacyDetailViewComponent } from './pharmacy-detail-view/pharmacy-detail-view.component';

const routes: Routes = [
  {
    path: '',
    redirectTo: 'view',
    pathMatch : 'full'
  },
  {
    path: 'view',
    component : PharmacyListViewComponent,
    data : {
      title : 'Pharmacies'
    }
  },
  {
    path: 'detail/:id',
    component : PharmacyDetailViewComponent,
    data : {
      title : 'Loading'
    }
  }
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule]
})
export class PharmacyRoutingModule { }
