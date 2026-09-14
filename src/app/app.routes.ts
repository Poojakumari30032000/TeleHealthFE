import { Routes } from '@angular/router';

import { FullLayoutComponent } from './layout/full-layout/full-layout.component';
import { ContentLayoutComponent } from './layout/content-layout/content-layout.component';

import { Full_ROUTES } from './shared/routes/full-layout.routes';
import { CONTENT_ROUTES } from './shared/routes/content-layout.routes';
import { AuthGuard } from './shared/Auth/auth.guard';

export const routes: Routes = [
    {
        path: '',
        redirectTo: 'login',
        pathMatch: 'full',
    },
    { path: '', component: FullLayoutComponent, data: { title: 'full Views' }, canActivate: [AuthGuard] , children: Full_ROUTES },
    { path: '', component: ContentLayoutComponent, data: { title: 'content Views' }, children: CONTENT_ROUTES },
    {
        path: '**',
        redirectTo: 'error'
    }
];
