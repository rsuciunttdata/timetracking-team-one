import { Routes } from '@angular/router';

export const routes: Routes = [
// {
//     path: '',
//     loadComponent: () => import('./pages/home.page').then(m => m.HomePage),
//   },
//   {
//     path: 'pontaje',
//     loadComponent: () => import('./pages/pontaje.page').then(m => m.PontajePage),
//   },
  {
    path: '**',
    redirectTo: ''
  }
];
