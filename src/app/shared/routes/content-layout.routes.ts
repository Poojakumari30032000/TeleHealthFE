import { Routes } from '@angular/router';

export const CONTENT_ROUTES: Routes = [
    {
        path: '',
        loadChildren: () => import('../../pages/content-page/content-page.module').then(m => m.ContentPageModule)
    }
];
