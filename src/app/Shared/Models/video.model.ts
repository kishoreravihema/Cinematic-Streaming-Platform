import { PlaylistMusic } from "./music.model";

export interface Actor {
  id: number;
  name: string;
}

export interface Video {
  id: number;
  title: string;
  url: string;
  description: string;
  playlistId: number;
  categoryId: number;
  thumbnailUrl: string;
  rating: number;
  durationInSeconds: number;
  language: string;
  ageRating: string;
  genre: string;
  actors: Actor[];
  director: string;
  isPremium: boolean;
  releaseDate: Date;
  createdAt: Date;
  updatedAt: Date;
  userId: number | null;
  category?: Category;
  user?: User;
  playlistVideos?: PlaylistVideo[];


  // Streaming-specific (frontend use only)
  sourceType?: 'local' | 'youtube' | 'remote';
  streamUrl?: string;
}
export interface Category {
  id: number;
  name: string;
  description?: string;
  imageUrl?: string;
  createdAt: Date;
  updatedAt: Date;

  // Optional list of videos (only if you plan to use it)
  videos?: Video[]; // Make sure to import `Video` if needed
}
export interface User {
  id: number;
  userName?: string;
  userEmail?: string;
  password?: string;
  subscriptionType?: string; // e.g. Free, Prime, Premium
  profileImageUrl?: string;
  phoneNumber?: string;
  lastLogin?: Date;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;

  playlists?: Playlist[];
}
export interface Playlist {
  id: number;
  name?: string;
  description?: string;
  isPublic: boolean;
  coverImageUrl?: string;
  tags?: string[];
  createdAt: Date;
  updatedAt: Date;

  userId: number;
  user?: User;

  playlistVideos: PlaylistVideo[];
  playlistMusics: PlaylistMusic[];
}
export interface PlaylistVideo {
  playlistId: number;
  playlist?: Playlist;
  videoId: number;
  video?: Video;
}

