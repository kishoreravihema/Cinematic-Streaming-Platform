import { HttpClient } from "@angular/common/http";
import { Injectable } from '@angular/core';
import { OAuthService, AuthConfig } from 'angular-oauth2-oidc';
import { BehaviorSubject, Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { environment } from "../../../environments/environment";
import { AuthResponseDto } from "../../Shared/Models/User.dto";
import { buildApiUrl } from "../../Shared/Utilities/api-url.util";


export const authCodeFlowConfig:AuthConfig={
    //issuer: 'https://localhost:7058',
    issuer: 'https://accounts.google.com',
    loginUrl: 'https://localhost:7058/auth/login',
    redirectUri: window.location.origin,
    //clientId: 'angular-app',
    clientId: 'YOUR_GOOGLE_CLIENT_ID.apps.googleusercontent.com', // Replace with your Google Client ID
    responseType: 'code',
    scope: 'openid profile email api',
    postLogoutRedirectUri: window.location.origin,
    silentRefreshRedirectUri: window.location.origin + '/silent-refresh.html',
    useSilentRefresh: true,
    timeoutFactor: 0.75,
    showDebugInformation: true,
   // logLevel: LogLevel.Debug
}

@Injectable({
    providedIn:'root'
})
export class AuthService{
    private apiBaseUrl=environment.apiBaseUrl;
    private authState=new BehaviorSubject<boolean>(this.hasValidToken());
    authState$=this.authState.asObservable();
    constructor(private oauthService:OAuthService, private http:HttpClient){
        this.oauthService.configure(authCodeFlowConfig);
        this.oauthService.loadDiscoveryDocumentAndTryLogin().then(() => {
            if (this.oauthService.hasValidAccessToken()) {
                this.authState.next(true);
            } else {
                this.authState.next(false);
            }
        });
    }
    login(){
        this.oauthService.initCodeFlow();

    }
    logout(){
        this.oauthService.logOut();
        localStorage.removeItem('userProfile');
        this.authState.next(false);
    }
    hasValidToken():boolean{
        return !!localStorage.getItem('api_token') && this.oauthService.hasValidAccessToken();
    }
     // Call this after Google login is successful to get API token
   
     exchangeGoogleTokenForApiToken(): Observable<AuthResponseDto> {
         const idToken = this.oauthService.getIdToken();
         return this.http.post<AuthResponseDto>(buildApiUrl('/auth/google-signin'), { idToken })

        .pipe(
            tap(response => {
                if(response.isSuccess && response.token){
                localStorage.setItem('api_token', response.token);
                this.authState.next(true);
                }
            })
        );   
}
}
