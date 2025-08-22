import { CanActivateFn, Router } from '@angular/router';
import { inject } from '@angular/core';
import { AuthService } from '../services/auth.service';

export const authGuard: CanActivateFn = (route, state) => {
    const authService = inject(AuthService);
    const router = inject(Router);

    const isAuthenticated = authService.isAuthenticated();
    console.log('🛡️ AuthGuard: Checking authentication', { isAuthenticated, url: state.url });

    if (!isAuthenticated) {
        console.log('🚫 AuthGuard: User not authenticated, redirecting to login');
        router.navigate(['/login']);
        return false;
    }

    const expectedRole = route.data['role'];
    if (expectedRole) {
        const userRole = authService.getUserRole();
        console.log('🔐 AuthGuard: Checking role access', { userRole, expectedRole });

        if (Array.isArray(expectedRole)) {
            if (!expectedRole.includes(userRole)) {
                console.log('❌ AuthGuard: Role not in allowed list, redirecting');
                router.navigate(['/login']);
                return false;
            }
        } else {
            if (userRole !== expectedRole) {
                console.log('❌ AuthGuard: Role mismatch, redirecting');
                router.navigate(['/login']);
                return false;
            }
        }
    }

    console.log('✅ AuthGuard: Access granted');
    return true;
};
