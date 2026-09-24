import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { QuestionnaireListViewComponent } from './questionnaire-list-view/questionnaire-list-view.component';
import { QuestionnaireDetailViewComponent } from './questionnaire-detail-view/questionnaire-detail-view.component';
import { MyQuestionnairesComponent } from './my-questionnaires/my-questionnaires.component';
import { PermissionGuard } from 'app/shared/permission/permission.guard';

const routes: Routes = [
  {
    path : '',
    component: QuestionnaireListViewComponent,
    canActivate: [PermissionGuard],
    data: { permissions: ['questionnaier_view'],
      title: 'Forms'
     }
  },
  // Must stay above ':id', which would otherwise match 'my'.
  {
    path: 'my',
    component: MyQuestionnairesComponent,
    canActivate: [PermissionGuard],
    data: { permissions: ['pt_view'],
      title: 'My Questionnaires'
     }
  },
  {
    path:':id',
    component: QuestionnaireDetailViewComponent,
    canActivate: [PermissionGuard],
    data: { permissions: ['questionnaier_view'],
      title : 'Loading'
     }
  }
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule]
})
export class QuestionnaireRoutingModule { }
