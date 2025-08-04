import { CanActivateFn, Router } from '@angular/router';
import { inject } from '@angular/core';

export const authGuard: CanActivateFn = (route, state) => {
    const isLoggedIn = localStorage.getItem('isLoggedIn') === 'true';
    const role = localStorage.getItem('role');

    if (!isLoggedIn) {
        return redirectToLogin(state.url);
    }

    const expectedRole = route.data['role'];
    if (expectedRole) {
        if (Array.isArray(expectedRole)) {
            if (!expectedRole.includes(role)) {
                return redirectToLogin('/');
            }
        } else {
            if (role !== expectedRole) {
                return redirectToLogin('/');
            }
        }
    }

    return true;
};

function redirectToLogin(path: string) {
    const router = inject(Router);
    router.navigate(['/login']);
    return false;
}
