import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { ProductListViewComponent } from './product-list-view/product-list-view.component';
import { ProductDetailViewComponent } from './product-detail-view/product-detail-view.component';
import { ProductBundleDetailViewComponent } from './product-bundle-detail-view/product-bundle-detail-view.component';
import { BundleCategoriesViewComponent } from './bundle-categories-view/bundle-categories-view.component';
import { ProductCategoriesListComponent } from './product-categories-list/product-categories-list.component';
import { PermissionGuard } from 'app/shared/permission/permission.guard';
import { DrugsListViewComponent } from './drugs-list-view/drugs-list-view.component';
import { CouponListViewComponent } from './coupon-list-view/coupon-list-view.component';
import {ClinicPackageGAViewComponent} from "./clinic-package-gaview/clinic-package-gaview.component";

const routes: Routes = [
  {
    path: '',
    redirectTo: 'view',
    pathMatch : 'full'
  },
  {
    path: 'view/Bundles',
    component : ProductListViewComponent,
    canActivate: [PermissionGuard],
    data: { permissions: ['product_view'],
      title : 'Packages',
     }
  },

  {
    path: 'view/BundlesClinic',
    component : ClinicPackageGAViewComponent,
    canActivate: [PermissionGuard],
    data: { permissions: ['product_view'],
      title : 'Packages',
    }
  },

    {
    path: 'view/Drugs',
    component : DrugsListViewComponent,
    canActivate: [PermissionGuard],
    data: { permissions: ['product_view'],
      title : 'Drugs Catalog',
     }
  },

  {
    path: 'category',
    component : ProductCategoriesListComponent,
    canActivate: [PermissionGuard],
    data: { permissions: ['product_category_view'],
      title : 'Product Category'
     }
  },
  {
    path: 'drug/:id',
    component : ProductDetailViewComponent,
    canActivate: [PermissionGuard],
    data: {
      permissions: ['product_view', 'product_edit'],
      title : 'Loading'
    }
  },
  {
    path: 'bundle/:id',
    component : ProductBundleDetailViewComponent,
    data: {
      title : 'Loading'
    }
  },
  {
    path: 'bundle/:id/categories',
    component : BundleCategoriesViewComponent,
    canActivate: [PermissionGuard],
    data: {
      permissions: ['product_view'],
      title : 'Package categories'
    }
  },
  {
    path: 'coupons',
    component : CouponListViewComponent,
    data: {
      title : 'Coupons'
    }
  }
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule]
})
export class ProductRoutingModule { }
