import { Injectable, signal } from '@angular/core';

@Injectable({
    providedIn: 'root',
})
export class AuthService {
    isLoggedIn = signal(false);

    login(email: string, password: string): boolean {
        if (email === 'admin@test.com' && password === '123456') {
            this.isLoggedIn.set(true);
            return true;
        }

        this.isLoggedIn.set(false);
        return false;
    }

    logout() {
        this.isLoggedIn.set(false);
    }

    isAuthenticated(): boolean {
        return this.isLoggedIn();
    }
}