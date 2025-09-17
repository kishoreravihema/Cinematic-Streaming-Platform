import { createReducer, on } from '@ngrx/store';
import { Music } from '../../../Shared/Models/music.model';
import { Video } from '../../../Shared/Models/video.model';
import * as PlayerActions from './player.actions';

export interface PlayerState {
  currentMedia: Music | Video | null;
  playlist: (Music | Video)[];
  queue: (Music | Video)[];
  currentIndex: number;
  isPlaying: boolean;
  isPaused: boolean;
  volume: number;
  isMuted: boolean;
  currentTime: number;
  duration: number;
  repeatMode: 'none' | 'one' | 'all';
  isShuffled: boolean;
  isLoading: boolean;
  error: string | null;
}

export const initialState: PlayerState = {
  currentMedia: null,
  playlist: [],
  queue: [],
  currentIndex: -1,
  isPlaying: false,
  isPaused: false,
  volume: 1,
  isMuted: false,
  currentTime: 0,
  duration: 0,
  repeatMode: 'none',
  isShuffled: false,
  isLoading: false,
  error: null
};

export const playerReducer = createReducer(
  initialState,
  on(PlayerActions.playMedia, (state, { media, playlist }) => ({
    ...state,
    currentMedia: media,
    playlist: playlist || [media],
    currentIndex: playlist ? playlist.findIndex(m => m.id === media.id) : 0,
    isPlaying: true,
    isPaused: false,
    isLoading: true
  })),
  on(PlayerActions.pauseMedia, (state) => ({
    ...state,
    isPlaying: false,
    isPaused: true
  })),
  on(PlayerActions.resumeMedia, (state) => ({
    ...state,
    isPlaying: true,
    isPaused: false
  })),
  on(PlayerActions.stopMedia, (state) => ({
    ...state,
    isPlaying: false,
    isPaused: false,
    currentTime: 0
  })),
  on(PlayerActions.setVolume, (state, { volume }) => ({
    ...state,
    volume: Math.max(0, Math.min(1, volume))
  })),
  on(PlayerActions.setMuted, (state, { muted }) => ({
    ...state,
    isMuted: muted
  })),
  on(PlayerActions.updateProgress, (state, { currentTime, duration }) => ({
    ...state,
    currentTime,
    duration,
    isLoading: false
  })),
  on(PlayerActions.nextTrack, (state) => {
    const nextIndex = state.currentIndex + 1;
    if (nextIndex < state.playlist.length) {
      return {
        ...state,
        currentIndex: nextIndex,
        currentMedia: state.playlist[nextIndex],
        isLoading: true
      };
    }
    return state;
  }),
  on(PlayerActions.previousTrack, (state) => {
    const prevIndex = state.currentIndex - 1;
    if (prevIndex >= 0) {
      return {
        ...state,
        currentIndex: prevIndex,
        currentMedia: state.playlist[prevIndex],
        isLoading: true
      };
    }
    return state;
  }),
  on(PlayerActions.setRepeatMode, (state, { mode }) => ({
    ...state,
    repeatMode: mode
  })),
  on(PlayerActions.setShuffle, (state, { shuffle }) => ({
    ...state,
    isShuffled: shuffle
  })),
  on(PlayerActions.setPlaylist, (state, { playlist }) => ({
    ...state,
    playlist
  })),
  on(PlayerActions.addToQueue, (state, { media }) => ({
    ...state,
    queue: [...state.queue, media]
  })),
  on(PlayerActions.removeFromQueue, (state, { index }) => ({
    ...state,
    queue: state.queue.filter((_, i) => i !== index)
  }))
);