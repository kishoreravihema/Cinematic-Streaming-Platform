import { createAction, props } from '@ngrx/store';
import { Music } from '../../../Shared/Models/music.model';
import { Video } from '../../../Shared/Models/video.model';

export const playMedia = createAction(
  '[Player] Play Media',
  props<{ media: Music | Video; playlist?: (Music | Video)[] }>()
);

export const pauseMedia = createAction('[Player] Pause Media');
export const resumeMedia = createAction('[Player] Resume Media');
export const stopMedia = createAction('[Player] Stop Media');

export const setVolume = createAction(
  '[Player] Set Volume',
  props<{ volume: number }>()
);

export const setMuted = createAction(
  '[Player] Set Muted',
  props<{ muted: boolean }>()
);

export const seekTo = createAction(
  '[Player] Seek To',
  props<{ time: number }>()
);

export const updateProgress = createAction(
  '[Player] Update Progress',
  props<{ currentTime: number; duration: number }>()
);

export const nextTrack = createAction('[Player] Next Track');
export const previousTrack = createAction('[Player] Previous Track');

export const setRepeatMode = createAction(
  '[Player] Set Repeat Mode',
  props<{ mode: 'none' | 'one' | 'all' }>()
);

export const setShuffle = createAction(
  '[Player] Set Shuffle',
  props<{ shuffle: boolean }>()
);

export const setPlaylist = createAction(
  '[Player] Set Playlist',
  props<{ playlist: (Music | Video)[] }>()
);

export const addToQueue = createAction(
  '[Player] Add To Queue',
  props<{ media: Music | Video }>()
);

export const removeFromQueue = createAction(
  '[Player] Remove From Queue',
  props<{ index: number }>()
);