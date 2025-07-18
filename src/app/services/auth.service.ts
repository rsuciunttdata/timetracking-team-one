import { Injectable, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { API_CONFIG, getApiUrl } from '../config/api.config';
import { Observable, map } from 'rxjs';
import { LoginResponse } from '../interfaces/api.interface';

@Injectable({
  providedIn: 'root',
})
export class AuthService {
  isLoggedIn = signal(false);
  private username = signal<string | null>(null);

  setUsername(email: string) {
    const name = email.split('@')[0];
    this.username.set(name);
  }

  getUsername(): string | null {
    return this.username();
  }

  constructor(private http: HttpClient) {
    const savedLogin = localStorage.getItem('isLoggedIn');
    const savedUsername = localStorage.getItem('username');

    if (savedLogin === 'true' && savedUsername) {
      this.isLoggedIn.set(true);
      this.username.set(savedUsername);
    }
  }

  login(email: string, password: string): Observable<'success' | 'invalid_email' | 'invalid_password'> {
    return this.http.post<LoginResponse>(getApiUrl('AUTH'), { email, password }).pipe(
      map(response => {
        if (response.success) {
          this.isLoggedIn.set(true);
          this.setUsername(email);

          localStorage.setItem('isLoggedIn', 'true');
          localStorage.setItem('username', email.split('@')[0]);

          return 'success';
        }
        return response.errorCode || 'invalid_email';
      })
    );
  }



  logout() {
    this.isLoggedIn.set(false);
    this.username.set(null);

    localStorage.removeItem('isLoggedIn');
    localStorage.removeItem('username');
  }

  isAuthenticated(): boolean {
    return this.isLoggedIn();
  }
}