// src/app/features/music/music.model.ts

import { Playlist, User } from "./video.model";

export interface Artist {
  id: number;
  name: string;
}

export interface Music {
  id: number;
  title: string;
  url: string | null;
  description: string | null;
  lyrics: string | null;
  thumbnailUrl: string | null;
  language: string | null;
  durationInSeconds: number;
  isExplicit: boolean;
  isPremium: boolean;
  playCount: number;
  releaseDate: Date;
  createdAt: Date;
  updatedAt: Date;

  albumId: number;
  genreId: number;
  userId?: number | null;

  album: Album;
  genre?: Genre;
  user?: User;
  artists: Artist[];
  playlistMusics?: PlaylistMusic[];

 
   sourceType?: 'audio' | 'youtube' | 'remote' | 'local' | 'youtube-playlist';
  streamUrl?: string; // Can be a YouTube ID or blob/local/remote URL
   __blobUrl__?: string;
}
export interface PlaylistMusic {
  playlistId: number;
  playlist?: Playlist;
  musicId: number;
  music?: Music;
}
export interface Album {
  id: number;
  title: string;
  description?: string;
  releaseDate: string; // ISO date string from API
  createdAt: string;
  updatedAt: string;
  userId?: number;
  user?: User;
  coverImagePath?: string;
  musicTracks: Music[];
}

// genre.model.ts
export interface Genre {
  id: number;
  name: string;
  musicTracks: Music[];
}





