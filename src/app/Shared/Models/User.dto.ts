export interface AuthResponseDto {
  isSuccess: string;
  token: string;
  message: string;
}

export interface UserProfileDto {
  id: string;
  username: string;
  email: string;
  roles: string[];
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
  
  // Enhanced user profile
  firstName?: string;
  lastName?: string;
  avatar?: string;
  preferences: UserPreferences;
  subscription: SubscriptionInfo;
  stats: UserStats;
}

export interface UserPreferences {
  theme: 'dark' | 'light' | 'auto';
  language: string;
  autoplay: boolean;
  quality: 'auto' | 'high' | 'medium' | 'low';
  notifications: NotificationSettings;
  privacy: PrivacySettings;
}

export interface NotificationSettings {
  email: boolean;
  push: boolean;
  newReleases: boolean;
  recommendations: boolean;
  playlistUpdates: boolean;
}

export interface PrivacySettings {
  profileVisibility: 'public' | 'friends' | 'private';
  showListeningHistory: boolean;
  showFavorites: boolean;
  allowRecommendations: boolean;
}

export interface SubscriptionInfo {
  type: 'free' | 'premium' | 'family' | 'student';
  status: 'active' | 'expired' | 'cancelled';
  expiresAt?: Date;
  features: string[];
}

export interface UserStats {
  totalListeningTime: number; // in minutes
  totalTracks: number;
  totalVideos: number;
  favoriteGenres: string[];
  topArtists: string[];
  joinedAt: Date;
  lastActive: Date;
}