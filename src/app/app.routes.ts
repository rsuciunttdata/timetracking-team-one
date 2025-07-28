import { Routes } from '@angular/router';

export const routes: Routes = [
  {
    path: '',
    loadComponent: () => import('./components/coming-soon/coming-soon.component').then(m => m.ComingSoonComponent),
  },
  // {
  //   path: '**',
  //   redirectTo: ''
  // }
  {
    path:'login',
    loadComponent: () =>import('./components/login/login').then(m=>m.Login),
  },

  {
    path: 'timesheet',
    loadComponent: () => import('./pages/timesheet-page.component').then(m => m.TimesheetPageComponent),
  },
  {
    path: 'coming-soon',
    loadComponent: () => import('./components/coming-soon/coming-soon.component').then(m => m.ComingSoonComponent),
  },
  {
    path:'employer-dashboard',
    loadComponent: () =>import('./pages/employer-dashboard/employer-dashboard').then(m=>m.EmployerDashboard),

  },
  {
    path: '**',
    loadComponent: () => import('./components/not-found/not-found').then(m => m.NotFound)
  }
];
