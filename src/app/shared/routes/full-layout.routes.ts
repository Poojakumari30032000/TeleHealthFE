import { Routes } from '@angular/router';
import { PermissionGuard } from '../permission/permission.guard';

export const Full_ROUTES: Routes = [
  {
    path: 'dashboard',
    loadChildren: () => import('../../dashboard/dashboard.module').then(m => m.DashboardModule),
    canActivate: [PermissionGuard],
    data: { permissions: ['dashboard_admin', 'dashboard_clinic', 'dashboard_provider', 'dashboard_customer', 'dashboard_patient'] }
  },
  {
    path: 'schedule',
    loadChildren: () => import('../../schedule/schedule.module').then(m => m.ScheduleModule),
    canActivate: [PermissionGuard],
    data: { permissions: ['calendar_view', 'appointment_view', 'appointment_delete', 'appointment_edit', 'avilability_view', 'avilability_add', 'avilability_edit', 'avilability_delete', 'avilability_slot_view', 'avilability_slot_edit', 'avilability_slot_delete'] }
  },
  {
    path: 'clinic',
    loadChildren: () => import('../../facility/facility.module').then(m => m.FacilityModule),
    canActivate: [PermissionGuard],
    data: { permissions: ['facility_view', 'facility_add', 'facility_edit', 'facility_delete','f_view'] }
  },
  {
    path: 'patient',
    loadChildren: () => import('../../patient/patient.module').then(m => m.PatientModule),
    canActivate: [PermissionGuard],
    data: { permissions: ['patient_view', 'patient_add', 'patient_edit', 'patient_delete','pt_view'] }
  },
  {
    path: 'user',
    loadChildren: () => import('../../user/user.module').then(m => m.UserModule),
    canActivate: [PermissionGuard],
    data: { permissions: ['user_view', 'user_add', 'user_edit', 'user_delete'] }
  },
  {
    path: 'treatment',
    loadChildren: () => import('../../treatment/treatment.module').then(m => m.TreatmentModule),
    canActivate: [PermissionGuard],
    data: { permissions: ['treatment_view', 'treatment_update', 'treatment_patient_view',  'treatment_patient_edit', 'treatment_more_button'] }
  },
  {
    path: 'order',
    loadChildren: () => import('../../order/order.module').then(m => m.OrderModule),
    canActivate: [PermissionGuard],
    data: { permissions: ['order_view', 'order_edit', 'order_more_button'] }
  },
  {
    path: 'payment',
    loadChildren: () => import('../../payment/payment.module').then(m => m.PaymentModule),
    canActivate: [PermissionGuard],
    data: { permissions: ['payment_view'] }
  },
  {
    path: 'prescription',
    loadChildren: () => import('../../prescription/prescription.module').then(m => m.PrescriptionModule),
    canActivate: [PermissionGuard],
    data: { permissions: ['prescription_view','prescription_edit','prescription_refill_button', 'prescription_timeLine_comment'] }
  },
  {
    path: 'product',
    loadChildren: () => import('../../product/product.module').then(m => m.ProductModule),
    canActivate: [PermissionGuard],
    data: { permissions: ['product_view','product_add','product_edit','product_category_view', 'product_varient_edit'] }
  },
  {
    path: 'billing',
    loadChildren: () => import('../../billing/billing.module').then(m => m.BillingModule)
  },
  {
    path: 'analytics',
    loadChildren: () => import('../../analytics/analytics.module').then(m=> m.AnalyticsModule)
  },
  {
    path: 'support',
    loadChildren: () => import('../../support/support.module').then(m => m.SupportModule),
    canActivate: [PermissionGuard],
    data: { permissions: ['supportTicket_view', 'supportTicket_add', 'supportTicket_edit', 'supportTicket_delete'] }
  },
  {
    path: 'activity',
    loadComponent: () => import('../../activity/activity.component').then(m => m.ActivityComponent),
    data: {
      title: 'Activity Log'
    }
  },
  {
    path: 'chat',
    loadComponent: () => import('../../chat/chat.component').then(m => m.ChatComponent),
    data: {
      title: 'Messages'
    }
  },

  {
    path: 'globalAdminTickets',
    loadComponent: () => import('../../global-admin-tickets/global-admin-tickets.component').then(m => m.GlobalAdminTicketsComponent),
    data: {
      title: 'Tickets'
    }
  },

  {
    path: 'globalAdminTicketsDetail/:id',
    loadComponent: () => import('../../global-admin-tickets-detailed-view/global-admin-tickets-detailed-view.component').then(m => m.GlobalAdminTicketsDetailedViewComponent),
    data: {
      title: 'Ticket Detail'
    }
  },

  {
    path: 'supportDocs',
    loadComponent: () => import('../../support-docs/doctor-portal-docs/doctor-portal-docs.component').then(m => m.DoctorPortalDocsComponent),
    data: {
      title: 'Support Documents'
    }
  },

  {
    path: 'buy-new-treatment',
    loadComponent: () => import('../../buy-new-treatment/buy-new-treatment.component').then(m => m.BuyNewTreatmentComponent),
    data: {
      title: 'Buy New Treatment'
    }
  },

  {
    path: 'user-management',
    loadComponent: () => import('../../user-management/user-management.component').then(m => m.UserManagementComponent),
    canActivate: [PermissionGuard],
    data: {
      title: 'User Management',
      permissions: ['user_management']
    }
  },

  {
    // Roles & permissions admin. Gated on the same permission the RolesController
    // endpoints require, so the route guard and the API agree - and the API refuses
    // regardless of whether this guard was bypassed.
    path: 'role',
    loadChildren: () => import('../../role/role.module').then(m => m.RoleModule),
    canActivate: [PermissionGuard],
    data: {
      title: 'Roles & Permissions',
      permissions: ['user_management']
    }
  },

  {
    path: 'provider-profile',
    loadComponent: () => import('../../provider-user-profile.component/provider-user-profile.component.component').then(m => m.ProviderUserProfileComponent),
    data: {
      title: 'Provider Profile'
    }
  },

  {
    path: 'fullscript-platform',
    loadComponent: () => import('../../fullscript-platform/fullscript-platform.component').then(m => m.FullscriptPlatformComponent),
    data: {
      title: 'Provider Profile'
    }
  },

  {
    path: 'brand',
    loadComponent: () => import('../../branding/branding.component').then(m => m.BrandingComponent),
    canActivate: [PermissionGuard],
    data: {
      title: 'Brand Customization',
      permissions: ['branding-view']
    }
  },
  {
    path: 'forms',
    loadChildren: () => import('../../questionnaire/questionnaire.module').then(m => m.QuestionnaireModule),
    canActivate: [PermissionGuard],
    // PermissionGuard grants on ANY of these. 'pt_view' lets a patient reach
    // 'forms/my'; the child routes still gate the admin screens on
    // 'questionnaier_view', which a patient does not hold.
    data: { permissions: ['questionnaier_view', 'pt_view'] }
  },
  {
    path: 'pharmacy',
    loadChildren: () => import('../../pharmacy/pharmacy.module').then(m => m.PharmacyModule),
    canActivate: [PermissionGuard],
    data: { permissions: ['pharmacy_view', 'pharmacy_add', 'pharmacy_edit', 'pharmacy_delete'] }
  },
  {
    path: 'video-call/:id',
    loadComponent: () => import('../../telehealth-video-call/telehealth-video-call.component').then(m => m.TelehealthVideoCallComponent),
    data: {
      title: 'Telehealth'
    }
  },
  {
    path: 'integrate-getting-started',
    loadComponent: () => import('../../integrate-getting-started/integrate-getting-started.component').then(m => m.IntegrateGettingStartedComponent),
    data: {
      title: 'Integrations'
    }
  },
  {
    path: 'integrations',
    loadComponent: () => import('../../fullscript-integrations/fullscript-integrations.component').then(m => m.FullscriptIntegrationsComponent),
    data: {
      title: 'Fullscript Integrations'
    }
  }
];
