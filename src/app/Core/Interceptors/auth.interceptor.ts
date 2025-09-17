import { Injectable } from '@angular/core';
import { HttpInterceptor, HttpRequest, HttpHandler, HttpEvent } from '@angular/common/http';
import { Observable } from 'rxjs';

@Injectable()
export class AuthInterceptor implements HttpInterceptor{
    intercept(req: HttpRequest<any>, next: HttpHandler): Observable<HttpEvent<any>> {
        // Get the token from local storage or any other source
        const token = localStorage.getItem('api_token');

        // Clone the request and set the new header in one step
        if (token) {
            const cloned = req.clone({
                headers: req.headers.set('Authorization', `Bearer ${token}`)
            });
            return next.handle(cloned);
        } else {
            // If no token, just pass the request through
            return next.handle(req);
        }
    }
}