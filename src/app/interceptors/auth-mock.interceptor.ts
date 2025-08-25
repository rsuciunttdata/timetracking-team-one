import { HttpInterceptorFn, HttpResponse, HttpClient } from '@angular/common/http';
import { Observable, of, throwError } from 'rxjs';
import { delay, catchError, map, switchMap } from 'rxjs/operators';
import { inject } from '@angular/core';
import { API_CONFIG } from '../config/api.config';
import { LoginResponse, RefreshTokenResponse } from '../interfaces/api.interface';
import { User } from '../interfaces/user.interface';
import { TokenService } from '../services/token.service';

export const authMockInterceptor: HttpInterceptorFn = (req, next) => {
    const tokenService = inject(TokenService);
    const http = inject(HttpClient);

    if (!API_CONFIG.ENABLE_MOCK_DATA) {
        return next(req);
    }

    const isAuthEndpoint = req.url.includes('/auth/');
    
    if (!isAuthEndpoint) {
        return next(req);
    }

    if (API_CONFIG.MOCK_AS_FALLBACK_ONLY) {
        return next(req).pipe(
            catchError(error => {
                return handleMockFallback(req, tokenService, http);
            })
        );
    }

    return handleMockFallback(req, tokenService, http);
};

function handleMockFallback(req: any, tokenService: TokenService, http: HttpClient): Observable<HttpResponse<any>> {
    
    if (req.url.includes('/auth/login') && req.method === 'POST') {
        return handleMockLogin(req, tokenService, http);
    }
    
    if (req.url.includes('/auth/refresh') && req.method === 'POST') {
        return handleMockRefresh(req, tokenService, http);
    }
    
    if (req.url.includes('/auth/logout') && req.method === 'POST') {
        return handleMockLogout(req);
    }
    
    if (req.url.includes('/auth/validate') && req.method === 'GET') {
        return handleMockValidate(req, http);
    }

    return of(new HttpResponse({ status: 404, body: { error: 'Endpoint not found' } }));
}

let cachedUsers: User[] | null = null;

/**
 * Load user data from JSON file
 */
function loadMockUsers(http: HttpClient): Observable<User[]> {
    if (cachedUsers) {
        return of(cachedUsers);
    }
    
    return http.get<User[]>('/assets/users.json').pipe(
        map(users => {
            if (!Array.isArray(users)) {
                throw new Error('Response is not an array');
            }
            
            cachedUsers = users;
            return users;
        }),
        catchError(error => {
            return throwError(() => new Error(`Failed to load mock user data from users.json: ${error.message || error.status || 'Unknown error'}`));
        })
    );
}

function handleMockLogin(req: any, tokenService: TokenService, http: HttpClient): Observable<HttpResponse<LoginResponse>> {
    const body = req.body as { email: string; password: string };
    const email = body?.email?.trim().toLowerCase();
    const password = body?.password;

    return loadMockUsers(http).pipe(
        switchMap(users => {
            const user = users.find(u => u.email.toLowerCase() === email);
            
            if (!user) {
                const response: LoginResponse = { 
                    success: false, 
                    errorCode: 'invalid_email'
                };
                return of(new HttpResponse({ status: 401, body: response }));
            }
            
            if (user.password !== password) {
                const response: LoginResponse = { 
                    success: false, 
                    errorCode: 'invalid_password'
                };
                return of(new HttpResponse({ status: 401, body: response }));
            }

            const expiresIn = tokenService.getTokenExpirationSeconds();
            const now = Math.floor(Date.now() / 1000);
            
            const tokenPayload = {
                sub: user.id,
                email: user.email,
                role: user.role,
                iat: now,
                exp: now + expiresIn
            };

            const header = btoa(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
            const payloadEncoded = btoa(JSON.stringify(tokenPayload));
            const signature = btoa('mock-signature');
            
            const accessToken = `${header}.${payloadEncoded}.${signature}`;
            const refreshToken = `refresh_${btoa(user.id + Date.now())}`;

            const response: LoginResponse = {
                success: true,
                accessToken,
                refreshToken,
                user: {
                    id: user.id,
                    name: user.name,
                    email: user.email,
                    role: user.role
                },
                expiresIn
            };

            return of(new HttpResponse({ status: 200, body: response }));
        }),
        catchError(error => {
            const response: LoginResponse = { 
                success: false, 
                errorCode: 'invalid_email'
            };
            return of(new HttpResponse({ status: 503, body: response }));
        }),
        delay(500)
    );
}

function handleMockRefresh(req: any, tokenService: TokenService, http: HttpClient): Observable<HttpResponse<RefreshTokenResponse>> {
    const body = req.body as { refreshToken: string };
    const refreshToken = body?.refreshToken;

    if (!refreshToken || !refreshToken.startsWith('refresh_')) {
        const response: RefreshTokenResponse = {
            success: false,
            accessToken: '',
            expiresIn: 0,
            errorCode: 'invalid_token'
        };
        return of(new HttpResponse({ status: 401, body: response })).pipe(delay(300));
    }

    const expiresIn = tokenService.getTokenExpirationSeconds();

    return loadMockUsers(http).pipe(
        switchMap(users => {
           
            const userId = users[0]?.id;
            const user = users.find(u => u.id === userId);
            
            if (!user) {
                const response: RefreshTokenResponse = {
                    success: false,
                    accessToken: '',
                    expiresIn: 0,
                    errorCode: 'invalid_token'
                };
                return of(new HttpResponse({ status: 401, body: response }));
            }

            const now = Math.floor(Date.now() / 1000);
            
            const tokenPayload = {
                sub: user.id,
                email: user.email,
                role: user.role,
                iat: now,
                exp: now + expiresIn
            };

            const header = btoa(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
            const payloadEncoded = btoa(JSON.stringify(tokenPayload));
            const signature = btoa('mock-signature-refreshed');
            
            const accessToken = `${header}.${payloadEncoded}.${signature}`;

            const response: RefreshTokenResponse = {
                success: true,
                accessToken,
                expiresIn
            };

            return of(new HttpResponse({ status: 200, body: response }));
        }),
        catchError(error => {
            const response: RefreshTokenResponse = {
                success: false,
                accessToken: '',
                expiresIn: 0,
                errorCode: 'invalid_token'
            };
            return of(new HttpResponse({ status: 503, body: response }));
        }),
        delay(300)
    );
}

function handleMockLogout(req: any): Observable<HttpResponse<void>> {
    return of(new HttpResponse({ status: 200, body: undefined })).pipe(delay(200));
}

function handleMockValidate(req: any, http: HttpClient): Observable<HttpResponse<{ valid: boolean; user?: User }>> {
    const authHeader = req.headers.get('Authorization');
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        const response = { valid: false };
        return of(new HttpResponse({ status: 401, body: response })).pipe(delay(200));
    }

    const token = authHeader.replace('Bearer ', '');
    
    try {
        const parts = token.split('.');
        if (parts.length !== 3) {
            const response = { valid: false };
            return of(new HttpResponse({ status: 401, body: response })).pipe(delay(200));
        }

        const payload = JSON.parse(atob(parts[1]));
        const now = Math.floor(Date.now() / 1000);

        if (payload.exp < now) {
            const response = { valid: false };
            return of(new HttpResponse({ status: 401, body: response })).pipe(delay(200));
        }

        return loadMockUsers(http).pipe(
            switchMap(users => {
                const user = users.find(u => u.id === payload.sub);
                if (!user) {
                    const response = { valid: false };
                    return of(new HttpResponse({ status: 401, body: response }));
                }

                const response = { 
                    valid: true, 
                    user: {
                        id: user.id,
                        name: user.name,
                        email: user.email,
                        password: user.password,
                        role: user.role
                    }
                };
                return of(new HttpResponse({ status: 200, body: response }));
            }),
            catchError(error => {
                const response = { valid: false };
                return of(new HttpResponse({ status: 503, body: response }));
            }),
            delay(200)
        );
        
    } catch (error) {
        const response = { valid: false };
        return of(new HttpResponse({ status: 401, body: response })).pipe(delay(200));
    }
}
