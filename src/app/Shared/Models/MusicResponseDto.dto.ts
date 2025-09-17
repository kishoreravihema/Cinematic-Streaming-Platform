// music-response-dto.model.ts
export interface MusicResponseDto {
  id: number;

  // Core Info
  title: string;
  url?: string;
  description?: string;
  lyrics?: string;
  thumbnailUrl?: string;
  language?: string;

  // Media Info
  durationInSeconds: number;
  isExplicit: boolean;
  isPremium: boolean;
  playCount: number;

  // Dates
  releaseDate: string; // ISO date string
  createdAt: string;
  updatedAt: string;

  // Foreign Keys
  albumId: number;
  genreId: number;
  userId?: number;

  // Navigation
  artists: ArtistResponseDto[];
}



export interface ArtistResponseDto {
  id: number;
  name: string;
 
}
// music-dto.model.ts
export interface MusicDto {
  // Core Info
  title?: string;
  url?: string;
  description?: string;
  lyrics?: string;
  thumbnailUrl?: string;
  language?: string;

  // Media Info
  durationInSeconds?: number;
  isExplicit?: boolean;
  isPremium?: boolean;
  playCount?: number;

  // Dates
  releaseDate: string; // ISO date string
  createdAt?: string;
  updatedAt?: string;

  // Foreign Keys
  albumId: number;
  genreId: number;
  userId?: number;

  // Navigation
  artists: ArtistResponseDto[];
}
export interface AlbumDto {
  
  id: number;
  title: string;
  description?: string;
  releaseDate: string;
  coverImagePath?: string;
  userName?: string;
  musicTracks: MusicDto[];
}

export interface ArtistDto {
  id: number;
  name: string;
  musicTracks: MusicDto[];
}

export interface GenreDto {
  id: number;
  name: string;
  musicTracks: MusicDto[];
}

export interface PlaylistMusicDto {
  playlistId: number;
  playlistName: string;
  musicId: number;
  musicTitle: string;
  albumTitle?: string;
  coverImagePath?: string;
  isPremium: boolean;
  artists: ArtistResponseDto[];
}

export interface PlaylistVideoDto {
  playlistId: number;
  playlistName: string;
  videoId: number;
  videoTitle: string;
  thumbnailUrl?: string;
  isPremium: boolean;
}
