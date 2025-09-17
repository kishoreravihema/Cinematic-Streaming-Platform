import { createReducer, on } from '@ngrx/store';
import { UserProfileDto } from '../../Models/User.dto';
import * as AuthActions from './auth.actions';

export interface AuthState {
  user: UserProfileDto | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;
}

export const initialState: AuthState = {
  user: null,
  token: null,
  isAuthenticated: false,
  isLoading: false,
  error: null
};

export const authReducer = createReducer(
  initialState,
  on(AuthActions.loginStart, (state) => ({
    ...state,
    isLoading: true,
    error: null
  })),
  on(AuthActions.loginSuccess, (state, { user, token }) => ({
    ...state,
    user,
    token,
    isAuthenticated: true,
    isLoading: false,
    error: null
  })),
  on(AuthActions.loginFailure, (state, { error }) => ({
    ...state,
    user: null,
    token: null,
    isAuthenticated: false,
    isLoading: false,
    error
  })),
  on(AuthActions.logout, () => initialState),
  on(AuthActions.refreshTokenSuccess, (state, { token }) => ({
    ...state,
    token
  })),
  on(AuthActions.refreshTokenFailure, (state, { error }) => ({
    ...state,
    error,
    isAuthenticated: false
  }))
);