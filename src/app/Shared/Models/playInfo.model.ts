export interface PlayInfo {
 
  url: string;
  playbackType: 'YOUTUBE' | 'REMOTE_URL' | 'LOCAL_STREAM'| 'YOUTUBE_CHANNEL_PLAYLISTS';
  data: string;
  thumbnailUrl?: string;
}