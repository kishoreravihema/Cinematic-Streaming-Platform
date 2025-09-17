import { createReducer, on } from '@ngrx/store';
import { Music } from '../../../Shared/Models/music.model';
import { Video } from '../../../Shared/Models/video.model';
import * as UserActions from './user.actions';

export interface UserState {
  profile: any | null;
  watchHistory: (Music | Video)[];
  favorites: (Music | Video)[];
  playbackProgress: { [mediaId: number]: { progress: number; duration: number } };
  isLoading: boolean;
  error: string | null;
}

export const initialState: UserState = {
  profile: null,
  watchHistory: [],
  favorites: [],
  playbackProgress: {},
  isLoading: false,
  error: null
};

export const userReducer = createReducer(
  initialState,
  on(UserActions.loadUserProfile, (state) => ({
    ...state,
    isLoading: true
  })),
  on(UserActions.loadUserProfileSuccess, (state, { profile }) => ({
    ...state,
    profile,
    isLoading: false
  })),
  on(UserActions.loadWatchHistorySuccess, (state, { history }) => ({
    ...state,
    watchHistory: history
  })),
  on(UserActions.addToWatchHistory, (state, { media }) => ({
    ...state,
    watchHistory: [media, ...state.watchHistory.filter(h => h.id !== media.id)].slice(0, 100)
  })),
  on(UserActions.loadFavoritesSuccess, (state, { favorites }) => ({
    ...state,
    favorites
  })),
  on(UserActions.addToFavorites, (state, { media }) => ({
    ...state,
    favorites: [...state.favorites, media]
  })),
  on(UserActions.removeFromFavorites, (state, { mediaId }) => ({
    ...state,
    favorites: state.favorites.filter(f => f.id !== mediaId)
  })),
  on(UserActions.updatePlaybackProgress, (state, { mediaId, progress, duration }) => ({
    ...state,
    playbackProgress: {
      ...state.playbackProgress,
      [mediaId]: { progress, duration }
    }
  }))
);