import { createAction, props } from '@ngrx/store';
import { Music } from '../../../Shared/Models/music.model';
import { Video } from '../../../Shared/Models/video.model';

// Load Media Actions
export const loadTrendingMedia = createAction('[Media] Load Trending Media');
export const loadTrendingMediaSuccess = createAction(
  '[Media] Load Trending Media Success',
  props<{ music: Music[]; videos: Video[] }>()
);
export const loadTrendingMediaFailure = createAction(
  '[Media] Load Trending Media Failure',
  props<{ error: string }>()
);

// Search Actions
export const searchMedia = createAction(
  '[Media] Search Media',
  props<{ query: string; filters?: any }>()
);
export const searchMediaSuccess = createAction(
  '[Media] Search Media Success',
  props<{ results: (Music | Video)[] }>()
);
export const searchMediaFailure = createAction(
  '[Media] Search Media Failure',
  props<{ error: string }>()
);

// Recommendations
export const loadRecommendations = createAction(
  '[Media] Load Recommendations',
  props<{ userId: string }>()
);
export const loadRecommendationsSuccess = createAction(
  '[Media] Load Recommendations Success',
  props<{ recommendations: (Music | Video)[] }>()
);

// Categories
export const loadCategories = createAction('[Media] Load Categories');
export const loadCategoriesSuccess = createAction(
  '[Media] Load Categories Success',
  props<{ categories: any[] }>()
);

// Clear Search
export const clearSearch = createAction('[Media] Clear Search');