import { createReducer, on } from '@ngrx/store';
import { Music } from '../../../Shared/Models/music.model';
import { Video } from '../../../Shared/Models/video.model';
import * as MediaActions from './media.actions';

export interface MediaState {
  trendingMusic: Music[];
  trendingVideos: Video[];
  searchResults: (Music | Video)[];
  recommendations: (Music | Video)[];
  categories: any[];
  isLoading: boolean;
  searchLoading: boolean;
  error: string | null;
  searchQuery: string;
}

export const initialState: MediaState = {
  trendingMusic: [],
  trendingVideos: [],
  searchResults: [],
  recommendations: [],
  categories: [],
  isLoading: false,
  searchLoading: false,
  error: null,
  searchQuery: ''
};

export const mediaReducer = createReducer(
  initialState,
  on(MediaActions.loadTrendingMedia, (state) => ({
    ...state,
    isLoading: true,
    error: null
  })),
  on(MediaActions.loadTrendingMediaSuccess, (state, { music, videos }) => ({
    ...state,
    trendingMusic: music,
    trendingVideos: videos,
    isLoading: false
  })),
  on(MediaActions.loadTrendingMediaFailure, (state, { error }) => ({
    ...state,
    error,
    isLoading: false
  })),
  on(MediaActions.searchMedia, (state, { query }) => ({
    ...state,
    searchLoading: true,
    searchQuery: query,
    error: null
  })),
  on(MediaActions.searchMediaSuccess, (state, { results }) => ({
    ...state,
    searchResults: results,
    searchLoading: false
  })),
  on(MediaActions.searchMediaFailure, (state, { error }) => ({
    ...state,
    error,
    searchLoading: false
  })),
  on(MediaActions.loadRecommendationsSuccess, (state, { recommendations }) => ({
    ...state,
    recommendations
  })),
  on(MediaActions.loadCategoriesSuccess, (state, { categories }) => ({
    ...state,
    categories
  })),
  on(MediaActions.clearSearch, (state) => ({
    ...state,
    searchResults: [],
    searchQuery: '',
    searchLoading: false
  }))
);