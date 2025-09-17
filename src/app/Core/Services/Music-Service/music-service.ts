//music-service.ts
import { HttpClient, HttpParams, HttpResponse } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable, catchError, map, switchMap, of, from } from 'rxjs';
import { BaseResponse } from '../../../Shared/Models/BaseResponse';
import { PlayInfo } from '../../../Shared/Models/playInfo.model';
import { buildApiUrl } from '../../../Shared/Utilities/api-url.util';
import { AlbumDto, ArtistDto, GenreDto, MusicDto, MusicResponseDto, PlaylistMusicDto, PlaylistVideoDto } from '../../../Shared/Models/MusicResponseDto.dto';
import { Music } from '../../../Shared/Models/music.model';


@Injectable({
  providedIn: 'root'
})
export class MusicService {
  private musicApiUrl = buildApiUrl('/music');
  private streamApiUrl = buildApiUrl('/Features');
  private baseUrl = buildApiUrl('/media');
  constructor(private http: HttpClient) {}

getMusic(page: number = 1, pageSize: number = 10): Observable<Music[]> {
    const params = new HttpParams()
      .set('page', page.toString())
      .set('pageSize', pageSize.toString());

    return this.http.get<BaseResponse<Music[]>>(this.musicApiUrl, { params }).pipe(
      map(response => {
        // Use a Set for unique IDs to ensure true uniqueness across potential duplicates
        // if titles/artists might not be unique but IDs are.
        const uniqueMusic: Music[] = [];
        const seenIds = new Set<number>();
        response.data.forEach(music => {
          if (!seenIds.has(music.id)) { // Assuming 'id' is a unique identifier
            uniqueMusic.push(music);
            seenIds.add(music.id);
          }
        });
        return uniqueMusic;
      }),
      catchError(err => {
        console.error('Error fetching music list:', err);
        return of([]); // Return an empty array on error
      })
    );
  }

  getMusicById(id: number): Observable<Music> {
    return this.http.get<BaseResponse<Music>>(`${this.musicApiUrl}/${id}`).pipe(
      map(response => response.data),
      catchError(err => {
        console.error(`Error fetching music by ID ${id}:`, err);
        throw err; // Re-throw or return a default/error object as appropriate for your error handling strategy
      })
    );
  }

  getPlaybackInfo(id: number): Observable<BaseResponse<PlayInfo>> {
    const url = `${this.streamApiUrl}/music/${id}`;
    return this.http.get<BaseResponse<PlayInfo>>(url).pipe(
      catchError(err => {
        console.error(`Error fetching playback info for ID ${id}:`, err);
        throw err;
      })
    );
  }

  // NOTE: For large-scale streaming, this endpoint would ideally return a
  // signed CDN URL (e.g., S3 pre-signed URL, CloudFront signed URL)
  // rather than streaming the blob directly from your backend.
  getStreamBlob(id: number): Observable<Blob> {
    const url = `${this.streamApiUrl}/music/stream/${id}`;
    return this.http.get(url, { responseType: 'blob' }).pipe(
      catchError(err => {
        console.error(`Error fetching stream blob for ID ${id}:`, err);
        throw err;
      })
    );
  }

  getMusicDtoById(id: number): Observable<MusicResponseDto> {
    return this.http.get<BaseResponse<MusicResponseDto>>(`${this.musicApiUrl}/${id}`).pipe(
      map(response => response.data),
      catchError(err => {
        console.error(`Error fetching music DTO by ID ${id}:`, err);
        throw err;
      })
    );
  }

  getByAlbum(albumId: number): Observable<MusicResponseDto[]> {
    return this.http.get<BaseResponse<MusicResponseDto[]>>(`${this.musicApiUrl}/albums/${albumId}`).pipe(
      map(response => response.data ?? []),
      catchError(err => {
        console.error(`Error fetching music by album ID ${albumId}:`, err);
        return of([]);
      })
    );
  }

  getByGenre(genre: string): Observable<MusicResponseDto[]> {
    return this.http.get<BaseResponse<MusicResponseDto[]>>(`${this.musicApiUrl}/genres/${genre}`).pipe(
      map(response => response.data ?? []),
      catchError(err => {
        console.error(`Error fetching music by genre ${genre}:`, err);
        return of([]);
      })
    );
  }

  getByArtist(artistId: number): Observable<MusicResponseDto[]> {
    return this.http.get<BaseResponse<MusicResponseDto[]>>(`${this.musicApiUrl}/artists/${artistId}`).pipe(
      map(response => response.data ?? []),
      catchError(err => {
        console.error(`Error fetching music by artist ID ${artistId}:`, err);
        return of([]);
      })
    );
  }

  exists(id: number): Observable<boolean> {
    return this.http.get<BaseResponse<boolean>>(`${this.musicApiUrl}/${id}/exists`).pipe(
      map(response => response.data),
      catchError(err => {
        console.error(`Error checking if music ID ${id} exists:`, err);
        return of(false); // Assume it doesn't exist on error
      })
    );
  }

  addMusic(dto: MusicDto): Observable<MusicResponseDto> {
    return this.http.post<BaseResponse<MusicResponseDto>>(this.musicApiUrl, dto).pipe(
      map(response => response.data),
      catchError(err => {
        console.error('Error adding music:', err);
        throw err;
      })
    );
  }

  addMusicManual(dto: MusicResponseDto): Observable<MusicResponseDto> {
    return this.http.post<BaseResponse<MusicResponseDto>>(`${this.musicApiUrl}/manual`, dto).pipe(
      map(response => response.data),
      catchError(err => {
        console.error('Error adding music manually:', err);
        throw err;
      })
    );
  }

  updateMusic(id: number, dto: MusicDto): Observable<MusicResponseDto> {
    return this.http.put<BaseResponse<MusicResponseDto>>(`${this.musicApiUrl}/${id}`, dto).pipe(
      map(response => response.data),
      catchError(err => {
        console.error(`Error updating music ID ${id}:`, err);
        throw err;
      })
    );
  }

  deleteMusic(id: number): Observable<boolean> {
    return this.http.delete<BaseResponse<boolean>>(`${this.musicApiUrl}/${id}`).pipe(
      map(response => response.data),
      catchError(err => {
        console.error(`Error deleting music ID ${id}:`, err);
        return of(false);
      })
    );
  }

  getAlbums(): Observable<BaseResponse<AlbumDto[]>> {
    return this.http.get<BaseResponse<AlbumDto[]>>(`${this.baseUrl}/albums`).pipe(
      catchError(err => {
        console.error('Error fetching albums', err);
        return of({ success: false, message: 'Error', code: 500, data: [] });
      })
    );
  }

  getArtists(): Observable<BaseResponse<ArtistDto[]>> {
    return this.http.get<BaseResponse<ArtistDto[]>>(`${this.baseUrl}/artists`).pipe(
      catchError(err => {
        console.error('Error fetching artists', err);
        return of({ success: false, message: 'Error', code: 500, data: [] });
      })
    );
  }

  getGenres(): Observable<BaseResponse<GenreDto[]>> {
    return this.http.get<BaseResponse<GenreDto[]>>(`${this.baseUrl}/genres`).pipe(
      catchError(err => {
        console.error('Error fetching genres', err);
        return of({ success: false, message: 'Error', code: 500, data: [] });
      })
    );
  }
getFilteredContent(filterType: 'albums' | 'artists' | 'genres', searchTerm?: string): Observable<BaseResponse<any[]>> {
    let params = new HttpParams();
    if (searchTerm) params = params.set('q', searchTerm);
    const url = `${this.baseUrl}/${filterType}`;
    return this.http.get<BaseResponse<any[]>>(url, { params }).pipe(
      catchError(err => {
        console.error(`Error fetching ${filterType}`, err);
        return of({ success: false, message: 'Error', code: 500, data: [] });
      })
    );
  }

  // Parse youtube URL -> return video or playlist id
  parseYouTubeUrl(url: string | undefined | null): { videoId?: string; playlistId?: string } {
    if (!url) return {};
    // video id (watch?v=) or short (youtu.be/)
    const vid = (url.match(/(?:v=|v\/|youtu\.be\/|embed\/)([a-zA-Z0-9_-]{11})/) || [])[1];
    const list = (url.match(/[?&]list=([a-zA-Z0-9_-]+)/) || [])[1];
    return { videoId: vid, playlistId: list };
  }

  // Return embed url for single video
  embedYouTubeUrl(videoId?: string, playlistId?: string): string | null {
    if (!videoId && !playlistId) return null;
    if (playlistId && !videoId) {
      return `https://www.youtube.com/embed/videoseries?list=${playlistId}&autoplay=1&rel=0`;
    }
    if (videoId) {
      return `https://www.youtube.com/embed/${videoId}?autoplay=1&rel=0`;
    }
    return null;
  }

  // Basic playlist helpers (local)
  createPlaylist(items: any[], type: 'local' | 'youtube' = 'local') {
    return items.map((it, idx) => ({ ...it, _queueIndex: idx, _type: type }));
  }

  // manageQueue stubs — you can implement persistent queue/DB persistence as needed
  managePlaybackQueue(playlist: any[], action: 'add' | 'remove' | 'move', payload?: any) {
    // minimal local queue management placeholder
    return playlist;
  }

  


  // getPlaylistMusic(): Observable<BaseResponse<PlaylistMusicDto[]>> {
  //   return this.http.get<BaseResponse<PlaylistMusicDto[]>>(`${this.baseUrl}/playlist-music`).pipe(
  //     catchError(err => {
  //       console.error('Error fetching playlist music', err);
  //       return of({ success: false, message: 'Error', code: 500, data: [] });
  //     })
  //   );
  // }

  // getPlaylistVideos(): Observable<BaseResponse<PlaylistVideoDto[]>> {
  //   return this.http.get<BaseResponse<PlaylistVideoDto[]>>(`${this.baseUrl}/playlist-videos`).pipe(
  //     catchError(err => {
  //       console.error('Error fetching playlist videos', err);
  //       return of({ success: false, message: 'Error', code: 500, data: [] });
  //     })
  //   );
  // }

}

//old method
//   /**
//    * Fetches a paginated list of music tracks.
//    */
//  getMusic(page: number = 1, pageSize: number = 10): Observable<Music[]> {
//   const params = new HttpParams()
//     .set('page', page.toString())
//     .set('pageSize', pageSize.toString());

//   return this.http.get<BaseResponse<Music[]>>(this.musicApiUrl, { params }).pipe(
//     map(response => {
//       const unique = new Map();
//       response.data.forEach(music => {
//         const key = `${music.title}-${music.artists}`;
//         if (!unique.has(key)) unique.set(key, music);
//       });
//       return Array.from(unique.values());
//     })
//   );
// }


//   /**
//    * Fetches a single music track by its ID.
//    */
//   getMusicById(id: number): Observable<Music> {
//     return this.http.get<BaseResponse<Music>>(`${this.apiUrl}/${id}`).pipe(
//       map(response => response.data)
//     );
//   }
//   /**
//    * Gets the actual streaming URL for a music track from the backend.
//    * The backend's Features/stream/music/{id} endpoint provides the secure and final URL.
//    */
//    getStreamUrl(id: number): Observable<string> {
//        const url = `${this.apiBase}/music/${id}`;
//         return this.http.get<BaseResponse<string>>(url).pipe(
//           switchMap(response => {
//             const streamUrl = response.data;
//             if (!streamUrl) {
//               return of(''); // Return an empty string if no URL is provided
//             }
//             //Detect YouTube ID or external audio URL
//             const isYouTubeId = /^[a-zA-Z0-9_-]{11}$/.test(streamUrl);
//             const isHttpUrl = /^https?:\/\//.test(streamUrl);
//             if (isYouTubeId || isHttpUrl) {
//               return of(streamUrl); // Return YouTube ID directly
//             }
//             return this.streamLocalAudio(id);
//             }),
//       catchError(err => {
//         console.error('Error fetching stream info:', err);
//         throw err;
//       })
//     );
//   }
//   /**
//    * Streams local audio file as a Blob URL.
//    * This is used for local audio files that are not hosted externally.
//    */
//   private streamLocalAudio(id: number): Observable<string> {
//     const url = `${this.apiBase}/audio/${id}`;
//     return this.http.get(url, { responseType: 'blob', observe: 'response' }).pipe(
//       switchMap((response: HttpResponse<Blob>) => {
//         const contentType = response.headers.get('Content-Type');
//         if (contentType?.startsWith('audio/')) {
//           const blobUrl = URL.createObjectURL(response.body!);
//           return of(blobUrl);
//         } else {
//           throw new Error('Unsupported media type: ' + contentType);
//         }
//       }),
//       catchError(err => {
//         console.error('Error streaming local audio:', err);
//         throw err;
//       })
//     );
//   }
// }