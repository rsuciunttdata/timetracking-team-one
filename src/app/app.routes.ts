import { Routes } from '@angular/router';

export const routes: Routes = [
  {
    path: '',
    loadComponent: () => import('./components/coming-soon/coming-soon.component').then(m => m.ComingSoonComponent),
  },
  {
    path: '**',
    redirectTo: ''
  }
];
