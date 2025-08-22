import { HttpInterceptorFn, HttpResponse, HttpClient } from '@angular/common/http';
import { Observable, of, throwError } from 'rxjs';
import { delay, catchError, map, switchMap } from 'rxjs/operators';
import { inject } from '@angular/core';
import { API_CONFIG } from '../config/api.config';
import { LoginResponse, RefreshTokenResponse } from '../interfaces/api.interface';
import { User } from '../interfaces/user.interface';
import { TokenService } from '../services/token.service';

export const authMockInterceptor: HttpInterceptorFn = (req, next) => {
    console.log('🔍 Interceptor: Checking request', { url: req.url, method: req.method });

    const tokenService = inject(TokenService);
    const http = inject(HttpClient);

    if (!API_CONFIG.ENABLE_MOCK_DATA) {
        console.log('⚠️ Interceptor: Mock data disabled, passing through');
        return next(req);
    }

    const isAuthEndpoint = req.url.includes('/auth/');
    
    console.log('🎯 Interceptor: Auth endpoint check', { isAuthEndpoint, url: req.url });
    
    if (!isAuthEndpoint) {
        return next(req);
    }

    console.log('🚀 Interceptor: Processing auth request', { fallbackOnly: API_CONFIG.MOCK_AS_FALLBACK_ONLY });

    if (API_CONFIG.MOCK_AS_FALLBACK_ONLY) {
        return next(req).pipe(
            catchError(error => {
                console.log('💥 Interceptor: Real auth request failed, falling back to mock data:', error);
                return handleMockFallback(req, tokenService, http);
            })
        );
    }

    console.log('🎭 Interceptor: Using mock data immediately');
    return handleMockFallback(req, tokenService, http);
};

function handleMockFallback(req: any, tokenService: TokenService, http: HttpClient): Observable<HttpResponse<any>> {
    console.log('🎭 Mock Fallback: Handling request', { url: req.url, method: req.method });
    
    if (req.url.includes('/auth/login') && req.method === 'POST') {
        console.log('📋 Mock Fallback: Routing to mock login');
        return handleMockLogin(req, tokenService, http);
    }
    
    if (req.url.includes('/auth/refresh') && req.method === 'POST') {
        console.log('🔄 Mock Fallback: Routing to mock refresh');
        return handleMockRefresh(req, tokenService, http);
    }
    
    if (req.url.includes('/auth/logout') && req.method === 'POST') {
        console.log('👋 Mock Fallback: Routing to mock logout');
        return handleMockLogout(req);
    }
    
    if (req.url.includes('/auth/validate') && req.method === 'GET') {
        console.log('✅ Mock Fallback: Routing to mock validate');
        return handleMockValidate(req, http);
    }

    console.log('❓ Mock Fallback: Unknown endpoint, returning 404');
    return of(new HttpResponse({ status: 404, body: { error: 'Endpoint not found' } }));
}

let cachedUsers: User[] | null = null;

/**
 * Load user data from JSON file
 */
function loadMockUsers(http: HttpClient): Observable<User[]> {
    if (cachedUsers) {
        console.log('📋 Mock Data: Using cached users', cachedUsers.length, 'users');
        return of(cachedUsers);
    }
    
    console.log('📋 Mock Data: Loading users from JSON file...');
    console.log('📋 Mock Data: Attempting to GET /assets/users.json');
    
    return http.get<User[]>('/assets/users.json').pipe(
        map(users => {
            console.log('📋 Mock Data: HTTP request successful!');
            console.log('📋 Mock Data: Raw response:', users);
            console.log('📋 Mock Data: Response type:', typeof users);
            console.log('📋 Mock Data: Is array:', Array.isArray(users));
            
            if (!Array.isArray(users)) {
                throw new Error('Response is not an array');
            }
            
            cachedUsers = users;
            console.log('📋 Mock Data: Successfully loaded and cached', users.length, 'users');
            console.log('📋 Mock Data: First user email:', users[0]?.email);
            return users;
        }),
        catchError(error => {
            console.error('❌ Mock Data: HTTP request failed:', error);
            console.error('❌ Mock Data: Error status:', error.status);
            console.error('❌ Mock Data: Error message:', error.message);
            console.error('❌ Mock Data: Error url:', error.url);
            return throwError(() => new Error(`Failed to load mock user data from users.json: ${error.message || error.status || 'Unknown error'}`));
        })
    );
}

function handleMockLogin(req: any, tokenService: TokenService, http: HttpClient): Observable<HttpResponse<LoginResponse>> {
    const body = req.body as { email: string; password: string };
    const email = body?.email?.trim().toLowerCase();
    const password = body?.password;

    console.log('🎭 Mock Login: Processing login request');
    console.log('📧 Email received:', email);
    console.log('🔑 Password received:', password ? '[PROVIDED]' : '[MISSING]');
    console.log('🔧 Mock Login: About to load users...');

    return loadMockUsers(http).pipe(
        switchMap(users => {
            console.log('✅ Mock Login: Users loaded successfully, count:', users.length);
            console.log('👥 Available users:', users.map(u => ({ email: u.email, role: u.role })));

            const user = users.find(u => u.email.toLowerCase() === email);
            
            console.log('🔍 User found:', user ? `${user.name} (${user.role})` : 'NO USER FOUND');
            
            if (!user) {
                console.log('❌ Mock Login: Invalid email');
                const response: LoginResponse = { 
                    success: false, 
                    errorCode: 'invalid_email'
                };
                return of(new HttpResponse({ status: 401, body: response }));
            }
            
            if (user.password !== password) {
                console.log('❌ Mock Login: Invalid password');
                const response: LoginResponse = { 
                    success: false, 
                    errorCode: 'invalid_password'
                };
                return of(new HttpResponse({ status: 401, body: response }));
            }

            console.log('✅ Mock Login: Authentication successful');

            const expiresIn = tokenService.getTokenExpirationSeconds();
            console.log('⏰ Mock Login: Using expiration from TokenService:', expiresIn, 'seconds');
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

            console.log('🎭 Mock Login: Returning successful response', { user: user.email, role: user.role, expiresIn });
            return of(new HttpResponse({ status: 200, body: response }));
        }),
        catchError(error => {
            console.error('❌ Mock Login: ERROR occurred during user loading or processing:', error);
            console.error('❌ Mock Login: Error details:', {
                message: error.message,
                stack: error.stack,
                type: typeof error
            });
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
    console.log('⏰ Mock Refresh: Using expiration from TokenService:', expiresIn, 'seconds');

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

            console.log('🔄 Mock Refresh: Returning refreshed token', { expiresIn });
            return of(new HttpResponse({ status: 200, body: response }));
        }),
        catchError(error => {
            console.error('❌ Mock Refresh: Failed to load user data:', error);
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
                console.error('❌ Mock Validate: Failed to load user data:', error);
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
