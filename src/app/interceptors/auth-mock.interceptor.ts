import { HttpInterceptorFn, HttpRequest, HttpResponse } from '@angular/common/http';
import { Observable, of } from 'rxjs';
import { delay } from 'rxjs/operators';
import { API_CONFIG } from '../config/api.config';

export const authMockInterceptor: HttpInterceptorFn = (req, next) => {
    const isAuthCall = req.url.includes(API_CONFIG.ENDPOINTS.AUTH) && req.method === 'POST';

    if (!API_CONFIG.ENABLE_MOCK_DATA || !isAuthCall) {
        return next(req);
    }

    const { email, password } = req.body as { email: string; password: string };

    let body: any;

    if (email !== 'admin@test.com') {
        body = { success: false, errorCode: 'invalid_email' };
    } else if (password !== '123456') {
        body = { success: false, errorCode: 'invalid_password' };
    } else {
        body = { success: true };
    }

    return of(new HttpResponse({ status: 200, body })).pipe(delay(500));
};
