import { ActionReducerMap } from '@ngrx/store';
import { AuthState, authReducer } from './auth/auth.reducer';
import { MediaState, mediaReducer } from './media/media.reducer';
import { PlayerState, playerReducer } from './player/player.reducer';
import { UserState, userReducer } from './user/user.reducer';

export interface AppState {
  auth: AuthState;
  media: MediaState;
  player: PlayerState;
  user: UserState;
}

export const appReducers: ActionReducerMap<AppState> = {
  auth: authReducer,
  media: mediaReducer,
  player: playerReducer,
  user: userReducer
};