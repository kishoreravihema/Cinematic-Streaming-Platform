import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';

@Injectable({
  providedIn: 'root'
})
export class YoutubeApiService {
  private apiKey='yout_API_Key'; // Replace with your actual YouTube API key
  private baseUrl  = 'https://www.googleapis.com/youtube/v3';
  constructor(private http:HttpClient) {}
  getChannelId(handle: string) {
    return this.http.get(`${this.baseUrl}/search`, {
      params: {
        part: 'snippet',
        type: 'channel',
        q: handle,
        key: this.apiKey
      }
    });
  }

  getChannelPlaylists(channelId: string) {
    return this.http.get(`${this.baseUrl}/playlists`, {
      params: {
        part: 'snippet',
        channelId: channelId,
        maxResults: '50',
        key: this.apiKey
      }
    });
  }

  searchVideos(query: string) {
    return this.http.get(`${this.baseUrl}/search`, {
      params: {
        part: 'snippet',
        maxResults: '10',
        q: query,
        type: 'video',
        key: this.apiKey
      }
    });
  }

  getPlaylistItems(playlistId: string) {
    return this.http.get(`${this.baseUrl}/playlistItems`, {
      params: {
        part: 'snippet',
        maxResults: '10',
        playlistId: playlistId,
        key: this.apiKey
      }
    });
  }
}
