import { createAction, props } from '@ngrx/store';
import { Music } from '../../../Shared/Models/music.model';
import { Video } from '../../../Shared/Models/video.model';

export const loadUserProfile = createAction(
  '[User] Load User Profile',
  props<{ userId: string }>()
);

export const loadUserProfileSuccess = createAction(
  '[User] Load User Profile Success',
  props<{ profile: any }>()
);

export const updateUserProfile = createAction(
  '[User] Update User Profile',
  props<{ profile: any }>()
);

export const loadWatchHistory = createAction('[User] Load Watch History');
export const loadWatchHistorySuccess = createAction(
  '[User] Load Watch History Success',
  props<{ history: (Music | Video)[] }>()
);

export const addToWatchHistory = createAction(
  '[User] Add To Watch History',
  props<{ media: Music | Video }>()
);

export const loadFavorites = createAction('[User] Load Favorites');
export const loadFavoritesSuccess = createAction(
  '[User] Load Favorites Success',
  props<{ favorites: (Music | Video)[] }>()
);

export const addToFavorites = createAction(
  '[User] Add To Favorites',
  props<{ media: Music | Video }>()
);

export const removeFromFavorites = createAction(
  '[User] Remove From Favorites',
  props<{ mediaId: number }>()
);

export const updatePlaybackProgress = createAction(
  '[User] Update Playback Progress',
  props<{ mediaId: number; progress: number; duration: number }>()
);