import { Injectable, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { API_CONFIG, getApiUrl } from '../config/api.config';
import { Observable, map } from 'rxjs';
import { LoginResponse } from '../interfaces/api.interface';
import { of } from 'rxjs';
import { switchMap } from 'rxjs';
import { User } from '../interfaces/user.interface';

@Injectable({
  providedIn: 'root',
})
export class AuthService {
  isLoggedIn = signal(false);
  username = signal<string | null>(null);

  constructor(private http: HttpClient) {
    const savedLogin = localStorage.getItem('isLoggedIn');
    const savedUsername = localStorage.getItem('username');

    if (savedLogin === 'true' && savedUsername) {
      this.isLoggedIn.set(true);
      this.username.set(savedUsername);
    }
  }

  login(email: string, password: string): Observable<'admin' | 'user' | 'invalid_email' | 'invalid_password'> {
    return this.http.get<User[]>('/assets/users.json').pipe(
      switchMap(users => {
        const user = users.find(u => u.email === email);
        if (!user) return of('invalid_email' as const);
        if (user.password !== password) return of('invalid_password' as const);

        this.isLoggedIn.set(true);
        this.username.set(user.name);

        localStorage.setItem('isLoggedIn', 'true');
        localStorage.setItem('username', user.name);
        localStorage.setItem('role', user.role);

        return of(user.role as 'admin' | 'user');
      })
    );
  }



  logout() {
    this.isLoggedIn.set(false);
    this.username.set(null);

    localStorage.removeItem('isLoggedIn');
    localStorage.removeItem('username');
    localStorage.removeItem('role');
  }

  isAuthenticated(): boolean {
    return this.isLoggedIn();
  }
}