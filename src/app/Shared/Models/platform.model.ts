// src/app/core/models/platform.model.ts
export type SupportedPlatform =
  | 'youtube'
  | 'terabox'
  | 'instagram'
  | 'facebook'
  | 'x' // twitter / x
  | 'reddit'
  | 'pinterest'
  | 'tiktok'
  | 'twitch'
  | 'google-drive'
  | 'dropbox'
  | 'onedrive'
  | 'mega'
  | 'unknown';

export interface PlatformDetection {
  platform: SupportedPlatform;
  id?: string | null; // e.g., video id or file id if we can extract it
  rawUrl: string;
  canEmbed: boolean;
  embedUrl?: string | null; // sanitized embed-able URL (not sanitized yet)
}
