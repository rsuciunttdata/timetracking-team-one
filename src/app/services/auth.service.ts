import { Injectable, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { API_CONFIG, getApiUrl } from '../config/api.config';
import { Observable, map } from 'rxjs';

@Injectable({
  providedIn: 'root',
})
export class AuthService {
  isLoggedIn = signal(false);

  constructor(private http: HttpClient) {}

  login(email: string, password: string): Observable<'success' | 'invalid_email' | 'invalid_password'> {
    return this.http.post<any>(getApiUrl('AUTH'), { email, password }).pipe(
      map(response => {
        if (response.success) {
          this.isLoggedIn.set(true);
          return 'success';
        }
        return response.errorCode as 'invalid_email' | 'invalid_password';
      })
    );
  }

  logout() {
    this.isLoggedIn.set(false);
  }

  isAuthenticated(): boolean {
    return this.isLoggedIn();
  }
}