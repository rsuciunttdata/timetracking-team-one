import { CanActivateFn, Router } from '@angular/router';
import { inject } from '@angular/core';
import { AuthService } from '../services/auth.service';

export const authGuard: CanActivateFn = (route, state) => {
    const authService = inject(AuthService);
    const router = inject(Router);

    const isAuthenticated = authService.isAuthenticated();

    if (!isAuthenticated) {
        router.navigate(['/login']);
        return false;
    }

    const expectedRole = route.data['role'];
    if (expectedRole) {
        const userRole = authService.getUserRole();

        if (Array.isArray(expectedRole)) {
            if (!expectedRole.includes(userRole)) {
                router.navigate(['/login']);
                return false;
            }
        } else {
            if (userRole !== expectedRole) {
                router.navigate(['/login']);
                return false;
            }
        }
    }

    return true;
};
