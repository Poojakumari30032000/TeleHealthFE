export type MenuItem = {
  level: number;
  title: string;
  icon?: string;
  route?: string;
  open?: boolean;
  disabled: boolean;
  children?: MenuItem[];
};

export type SidebarMenu = {
  [key: string]: MenuItem[];
};

export const sidebarMenu: SidebarMenu = {

  'Global Admin': [

    {
      level: 1,
      title: 'Dashboard',
      icon: 'fa-solid fa-house',
      route: '/dashboard/admin',
      disabled: false,
    },

      {
        level: 1,
        title: 'Clinics',
        icon: 'fa-solid fa-building',
        route: '/clinic/view',
        disabled: false,
      },

    {
      level: 1,
      title: 'Scheduling',
      icon: 'fa-regular fa-calendar-days',
      disabled: false,
      children: [
        { level: 2, title: 'Calendar', route: '/schedule/calendar', disabled: false },
        { level: 2, title: 'Availability', route: '/schedule/availability', disabled: false },

      ],
    },

    {
      level: 1,
      title: 'Clinical',
      icon: 'fa-solid fa-stethoscope',
      disabled: false,
      children: [
        { level: 2, title: 'Patients', route: '/patient/view', disabled: false },
        { level: 2, title: 'Treatments', route: '/treatment/view', disabled: false },
        { level: 2, title: 'Prescriptions', route: '/prescription/view', disabled: false },
        { level: 2, title: 'Orders', route: '/order/view', disabled: false },
        { level: 2, title: 'Forms', route: '/forms', disabled: false },
      ],
    },

    {
      level: 1,
      title: 'Products',
      icon: 'fa-solid fa-pills',
      disabled: false,
      children: [
        { level: 2, title: 'Categories', route: '/product/category', disabled: false },
        { level: 2, title: 'Packages', route: '/product/view/Bundles', disabled: false },
        { level: 2, title: 'Clinic Packages', route: '/product/view/BundlesClinic', disabled: false },
        { level: 2, title: 'Rx Catalog', route: '/product/view/Drugs', disabled: false },
        { level: 2, title: 'Coupons', route: '/product/coupons', disabled: false },
      ],
    },

    {
      level: 1,
      title: 'Messages',
      icon: 'fa-solid fa-comments',
      route: '/chat',
      disabled: false,
    },

    {
      level: 1,
      title: 'Invoicing',
      icon: 'fa-solid fa-credit-card',
      disabled: false,
      children: [

        { level: 2, title: 'Clinic Invoices', route: '/billing/clinicBills', disabled: false },
        { level: 2, title: 'Invoice Payments', route: '/billing/payments', disabled: false },
        { level: 2, title: 'Patient Invoices', route: '/billing/clinicInvoices', disabled: false },
        { level: 2, title: 'Stripe', route: '/billing/gaPaymentDashboard', disabled: false },
      ],
    },

    {
      level: 1,
      title: 'Admin & Support',
      icon: 'fa-solid fa-gear',
      disabled: false,
      children: [
        { level: 2, title: 'User Management', route: '/user-management', disabled: false },

        { level: 2, title: 'Roles & Permissions', route: '/role/view', disabled: false },

        { level: 2, title: 'Tickets', route: '/globalAdminTickets', disabled: false },

        { level: 2, title: 'Activity Log', route: '/activity', disabled: false },

      ],
    },
  ],

  'Clinic Admin': [

    {
      level: 1,
      title: 'Dashboard',
      icon: 'fa-solid fa-house',
      route: '/dashboard/clinic',
      disabled: false,
    },

    {
      level: 1,
      title: 'Scheduling',
      icon: 'fa-regular fa-calendar-days',
      disabled: false,
      children: [
        { level: 2, title: 'Calendar', route: '/schedule/calendar', disabled: false },

      ],
    },

    {
      level: 1,
      title: 'Clinic Staff',
      icon: 'fa-solid fa-user-group',
      route: '/user/view',
      disabled: false,
    },

    {
      level: 1,
      title: 'Clinical',
      icon: 'fa-solid fa-stethoscope',
      disabled: false,
      children: [
        { level: 2, title: 'Patients', route: '/patient/view', disabled: false },
        { level: 2, title: 'Treatments', route: '/treatment/view', disabled: false },
        { level: 2, title: 'Prescriptions', route: '/prescription/view', disabled: false },
        { level: 2, title: 'Orders', route: '/order/view', disabled: false },
        { level: 2, title: 'Forms', route: '/forms', disabled: false },
      ],
    },

    {
      level: 1,
      title: 'Products',
      icon: 'fa-solid fa-pills',
      disabled: false,
      children: [
        { level: 2, title: 'Categories', route: '/product/category', disabled: false },
        { level: 2, title: 'Packages', route: '/product/view/Bundles', disabled: false },
        { level: 2, title: 'Rx Catalog', route: '/product/view/Drugs', disabled: false },
        { level: 2, title: 'Coupons', route: '/product/coupons', disabled: false },
      ],
    },

    {
      level: 1,
      title: 'Invoicing',
      icon: 'fa-solid fa-credit-card',
      disabled: false,
      children: [
        { level: 2, title: 'Invoices', route: '/billing/clinicInvoices', disabled: false },
        { level: 2, title: 'Payment Dashboard', route: '/billing/gaPaymentDashboard', disabled: false },

      ],
    },

    {
      level: 1,
      title: 'Billing',
      icon: 'fa-solid fa-credit-card',
      disabled: false,
      children: [
        { level: 2, title: 'Bills', route: '/billing/clinicBills', disabled: false },
        { level: 2, title: 'Bill Payments', route: '/billing/payments', disabled: false },
        { level: 2, title: 'Payment Methods', route: '/billing/payment-methods', disabled: false },

      ],
    },

    {
      level: 1,
      title: 'Messages',
      icon: 'fa-solid fa-comments',
      route: '/chat',
      disabled: false,
    },

    {
      level: 1,
      title: 'Settings',
      icon: 'fa-solid fa-gear',
      disabled: false,
      children: [
        { level: 2, title: 'Branding', route: '/brand', disabled: false },
        { level: 2, title: 'Integrations', route: '/integrate-getting-started', disabled: false },

        { level: 2, title: 'Clinic Settings', route: '/clinic/info', disabled: false },
      ],
    },

  ],

  'Provider': [
    {
      level: 1,
      title: 'Dashboard',
      icon: 'fa-solid fa-house',
      route: '/dashboard/provider',
      disabled: false,
    },
    {
      level: 1,
      title: 'My Profile',
      icon: 'fa-solid fa-user',
      route: '/provider-profile',
      disabled: false,
    },
    {
      level: 1,
      title: 'Scheduling',
      icon: 'fa-regular fa-calendar-days',
      disabled: false,
      children: [
        { level: 2, title: 'Calendar', route: '/schedule/calendar', disabled: false },
        { level: 2, title: 'Availability', route: '/schedule/availability', disabled: false },
      ],
    },

    {
      level: 1,
      title: 'Clinical',
      icon: 'fa-solid fa-stethoscope',
      route: '/patient/view',
      disabled: false
    },

    {
      level: 1,
      title: 'Messages',
      icon: 'fa-solid fa-comments',
      route: 'chat',
      disabled: false
    },

  ],

  'Patient': [
    {
      level: 1,
      title: 'Dashboard',
      icon: 'fa-solid fa-house',
      route: '/dashboard/patient',
      disabled: false,
    },
    {
      level: 1,
      title: 'My Profile',
      icon: 'fa-solid fa-user',
      route: '/patient/detail',
      disabled: false,
    },
    {
      level: 1,
      title: 'Appointments',
      icon: 'fa-regular fa-calendar-days',
      route: '/schedule/calendar',
      disabled: false,
    },

    {
      level: 1,
      title: 'My Treatments',
      icon: 'fa-solid fa-stethoscope',
      route: '/treatment/view',
      disabled: false
    },

    {
      level: 1,
      title: 'My Questionnaires',
      icon: 'fa-regular fa-file-lines',
      route: '/forms/my',
      disabled: false
    },

    {
      level: 1,
      title: 'Billing',
      icon: 'fa-solid fa-credit-card',
      disabled: false,
      children: [

        { level: 2, title: 'Bills', route: '/billing/patientBills', disabled: false },
        { level: 2, title: 'Payment Methods', route: '/billing/payment-methods', disabled: false },
      ],
    },
    {
      level: 1,
      title: 'Messages',
      icon: 'fa-solid fa-comments',
      route: 'chat',
      disabled: false
    },
    {
      level: 1,
      title: 'Buy New Treatment',
      icon: 'fa-solid fa-ticket',
      route: 'buy-new-treatment',
      disabled: false
    },

  ],

  'Tech Support' : [

    {
      level: 1,
      title: 'Tickets',
      icon: 'fa-solid fa-house',
      route: '/globalAdminTickets',
      disabled: false,
    },

  ]
};
