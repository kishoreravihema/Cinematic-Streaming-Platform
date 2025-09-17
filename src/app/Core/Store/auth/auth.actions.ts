import { createAction, props } from '@ngrx/store';
import { UserProfileDto } from '../../Models/User.dto';

export const loginStart = createAction('[Auth] Login Start');
export const loginSuccess = createAction(
  '[Auth] Login Success',
  props<{ user: UserProfileDto; token: string }>()
);
export const loginFailure = createAction(
  '[Auth] Login Failure',
  props<{ error: string }>()
);

export const logout = createAction('[Auth] Logout');
export const checkAuthStatus = createAction('[Auth] Check Auth Status');

export const refreshToken = createAction('[Auth] Refresh Token');
export const refreshTokenSuccess = createAction(
  '[Auth] Refresh Token Success',
  props<{ token: string }>()
);
export const refreshTokenFailure = createAction(
  '[Auth] Refresh Token Failure',
  props<{ error: string }>()
);