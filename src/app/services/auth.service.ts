import { Injectable, signal } from '@angular/core';

@Injectable({
    providedIn: 'root',
})
export class AuthService {
    isLoggedIn = signal(false);

    login(email: string, password: string): 'success' | 'invalid_email' | 'invalid_password' {
        const validEmail = 'admin@test.com';
        const validPassword = '123456';

        if (email !== validEmail) {
            return 'invalid_email';
        }

        if (password !== validPassword) {
            return 'invalid_password';
        }

        return 'success';
    }

    logout() {
        this.isLoggedIn.set(false);
    }

    isAuthenticated(): boolean {
        return this.isLoggedIn();
    }
}