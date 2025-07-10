import { Injectable } from '@angular/core';

@Injectable({
    providedIn: 'root',
})
export class AuthService {
    private isAuthenticated = false; // mock logic

    login() {
        this.isAuthenticated = true;
    }

    logout() {
        this.isAuthenticated = false;
    }

    isLoggedIn(): boolean {
        return this.isAuthenticated;
    }
}