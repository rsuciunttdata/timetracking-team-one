import { HttpInterceptorFn, HttpResponse } from '@angular/common/http';
import { Observable, of } from 'rxjs';
import { delay } from 'rxjs/operators';
import { API_CONFIG } from '../config/api.config';

export const authMockInterceptor: HttpInterceptorFn = (req, next) => {
    const isAuthCall = req.url.includes(API_CONFIG.ENDPOINTS.AUTH) && req.method === 'POST';

    if (!API_CONFIG.ENABLE_MOCK_DATA || !isAuthCall) {
        return next(req);
    }

    const body = req.body as { email: string; password: string };
    const email = body?.email?.trim().toLowerCase();
    const password = body?.password;

    let responseBody: any;

    if (email !== 'admin@test.com') {
        responseBody = { success: false, errorCode: 'invalid_email' };
    } else if (password !== '123456') {
        responseBody = { success: false, errorCode: 'invalid_password' };
    } else {
        responseBody = { success: true };
    }

    return of(new HttpResponse({ status: 200, body: responseBody })).pipe(delay(500));
};
