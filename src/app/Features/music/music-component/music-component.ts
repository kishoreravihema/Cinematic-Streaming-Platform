// src/app/Features/music/music-component/music-component.ts
import { Component, OnDestroy, OnInit } from '@angular/core';
import { Observable, of, Subject } from 'rxjs';
import { catchError, takeUntil } from 'rxjs/operators';

import { CommonModule } from '@angular/common';
import { SafeUrlPipe } from '../../../Shared/Pipes/safe-url.pipe';
import { Music } from '../../../Shared/Models/music.model';
import { AudioPlayer, AudioState } from '../../../Core/Services/Audio-Player-Service/audio-player';
import { MusicService } from '../../../Core/Services/Music-Service/music-service';
import { resolveRemoteUrl, resolveStreamUrl } from '../../../Shared/Utilities/api-url.util';
import { AlbumDto, ArtistDto, GenreDto } from '../../../Shared/Models/MusicResponseDto.dto';

type PlayableMusic = Music & {
  streamUrl?: string | null;
  originalPlaybackUrl?: string | null;
  sourceType?: 'audio' | 'youtube' | 'youtube-playlist' | 'remote' | 'local';
  __blobUrl__?: string;
};

@Component({
  selector: 'app-music',
  standalone: true,
  imports: [CommonModule, SafeUrlPipe],
  templateUrl: './music-component.html',
  styleUrls: ['./music-component.scss']
})
export class MusicComponent implements OnInit, OnDestroy {
  musicPage = 1;
  musicList: PlayableMusic[] = [];
  playlist: PlayableMusic[] = [];
  currentIndex = -1;

  albums: AlbumDto[] = [];
  artists: ArtistDto[] = [];
  genres: GenreDto[] = [];

  isLoading = false;
  error: string | null = null;

  currentTrack$!: Observable<Music | null>;
  audioState$!: Observable<AudioState>;

  // ---------- Inline YouTube ----------
  currentYouTubeUrl: string | null = null;

  private destroy$ = new Subject<void>();

  constructor(
    private musicService: MusicService,
    public audioPlayerService: AudioPlayer
  ) {
    this.currentTrack$ = this.audioPlayerService.currentTrack$;
    this.audioState$ = this.audioPlayerService.audioState$;
  }

  ngOnInit(): void {
    this.loadMusicPage(1);
    this.loadFilters();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  // ---------- Loads ----------
  private loadFilters(): void {
    this.musicService.getAlbums().pipe(takeUntil(this.destroy$)).subscribe(res => this.albums = res?.data ?? []);
    this.musicService.getArtists().pipe(takeUntil(this.destroy$)).subscribe(res => this.artists = res?.data ?? []);
    this.musicService.getGenres().pipe(takeUntil(this.destroy$)).subscribe(res => this.genres = res?.data ?? []);
  }

  loadMusicPage(page: number): void {
    this.isLoading = true;
    this.error = null;
    this.musicService.getMusic(page, 10).pipe(
      catchError(err => {
        console.error('Failed to load music page:', err);
        this.error = 'Failed to load music.';
        this.isLoading = false;
        return of([] as Music[]);
      }),
      takeUntil(this.destroy$)
    ).subscribe(data => {
      this.musicList = (data || []).map(d => d as PlayableMusic);
      this.playlist = [...this.musicList];
      this.audioPlayerService.setPlaylist(this.playlist);
      this.musicPage = page;
      this.isLoading = false;
    });
  }

  // ---------- Playback ----------
  play(index: number): void {
    if (index < 0 || index >= this.playlist.length) return;

    this.currentIndex = index;
    const track = this.playlist[index];
    this.error = null;

    if (track.streamUrl) {
      this.playOrEmbed(track, index);
      return;
    }

    this.musicService.getPlaybackInfo(track.id).pipe(takeUntil(this.destroy$)).subscribe({
      next: res => {
        if (!res.success || !res.data) {
          this.error = res.message || 'Could not get playback info.';
          return;
        }

        const playback = res.data;
        track.originalPlaybackUrl = playback.url ?? null;

        let resolvedUrl: string | null = null;

        switch (playback.playbackType) {
          case 'YOUTUBE':
            track.sourceType = 'youtube';
            resolvedUrl = this.toYouTubeEmbed(playback.url);
            break;

          case 'YOUTUBE_CHANNEL_PLAYLISTS':
            track.sourceType = 'youtube-playlist';
            resolvedUrl = this.toYouTubePlaylistEmbed(playback.url, playback.data);
            break;

          case 'REMOTE_URL':
            track.sourceType = 'remote';
            resolvedUrl = resolveRemoteUrl(playback.url);
            break;

          case 'LOCAL_STREAM':
            track.sourceType = 'local';
            resolvedUrl = resolveStreamUrl(`Features/music/stream/${track.id}`);
            break;
        }

      if (!resolvedUrl && (track.sourceType === 'youtube' || track.sourceType === 'youtube-playlist')) {
    resolvedUrl = track.originalPlaybackUrl ?? null;
}


        track.streamUrl = resolvedUrl ?? undefined;
        this.playOrEmbed(track, index);
      },
      error: err => {
        console.error('Failed to get playback info:', err);
        this.error = 'Unable to get information for this track.';
      }
    });
  }

  private playOrEmbed(track: PlayableMusic, index: number) {
    if (track.sourceType === 'youtube' || track.sourceType === 'youtube-playlist') {
      this.currentYouTubeUrl = track.streamUrl ?? null;
    } else {
      this.currentYouTubeUrl = null;
      this.audioPlayerService.playTrack(track, track.streamUrl!, index);
    }
  }

  toggleTrack(index: number): void {
    if (this.currentIndex === index) {
      this.audioPlayerService.togglePlayPause();
    } else {
      this.play(index);
    }
  }

  togglePlayPause(): void { this.audioPlayerService.togglePlayPause(); }
  mute(): void { this.audioPlayerService.toggleMute(); }

  onVolumeChange(event: Event): void {
    const v = Number((event.target as HTMLInputElement).value || 0);
    this.audioPlayerService.setVolume(v / 100);
  }

  onSeek(event: Event): void {
    const value = Number((event.target as HTMLInputElement).value || 0);
    this.audioPlayerService.seek(value);
  }

  nextPage() { this.loadMusicPage(this.musicPage + 1); }
  prevPage() { if (this.musicPage > 1) this.loadMusicPage(this.musicPage - 1); }
  next() { if (this.currentIndex < this.playlist.length - 1) this.play(this.currentIndex + 1); }
  previous() { if (this.currentIndex > 0) this.play(this.currentIndex - 1); }

  // ---------- Filters & Search ----------
  onSelectChange(event: Event, type: 'album' | 'artist' | 'genre'): void {
    const value = (event.target as HTMLSelectElement).value;
    if (!value) {
      this.playlist = [...this.musicList];
      this.audioPlayerService.setPlaylist(this.playlist);
      return;
    }
    switch (type) {
      case 'album': this.loadByAlbum(Number(value)); break;
      case 'artist': this.loadByArtist(Number(value)); break;
      case 'genre': this.loadByGenre(value); break;
    }
  }

  onSearchChange(event: Event): void {
    const q = (event.target as HTMLInputElement).value?.trim() ?? '';
    if (!q) {
      this.playlist = [...this.musicList];
      this.audioPlayerService.setPlaylist(this.playlist);
      return;
    }
    const lc = q.toLowerCase();
    this.playlist = this.musicList.filter(t =>
      (t.title ?? '').toLowerCase().includes(lc) ||
      (t.album?.title ?? '').toLowerCase().includes(lc) ||
      (t.artists?.map(a => a.name).join(' ') ?? '').toLowerCase().includes(lc)
    );
    this.audioPlayerService.setPlaylist(this.playlist);
  }

  loadByAlbum(albumId: number) {
    this.isLoading = true;
    this.musicService.getByAlbum(albumId).pipe(
      catchError(err => { console.error(err); this.isLoading = false; return of([] as Music[]); }),
      takeUntil(this.destroy$)
    ).subscribe(data => {
      this.musicList = (data || []).map(d => d as PlayableMusic);
      this.playlist = [...this.musicList];
      this.audioPlayerService.setPlaylist(this.playlist);
      this.isLoading = false;
    });
  }

  loadByArtist(artistId: number) {
    this.isLoading = true;
    this.musicService.getByArtist(artistId).pipe(
      catchError(err => { console.error(err); this.isLoading = false; return of([] as Music[]); }),
      takeUntil(this.destroy$)
    ).subscribe(data => {
      this.musicList = (data || []).map(d => d as PlayableMusic);
      this.playlist = [...this.musicList];
      this.audioPlayerService.setPlaylist(this.playlist);
      this.isLoading = false;
    });
  }

  loadByGenre(genre: string) {
    this.isLoading = true;
    this.musicService.getByGenre(genre).pipe(
      catchError(err => { console.error(err); this.isLoading = false; return of([] as Music[]); }),
      takeUntil(this.destroy$)
    ).subscribe(data => {
      this.musicList = (data || []).map(d => d as PlayableMusic);
      this.playlist = [...this.musicList];
      this.audioPlayerService.setPlaylist(this.playlist);
      this.isLoading = false;
    });
  }

  // ---------- YouTube Helpers ----------
  private toYouTubeEmbed(originalUrl: string | undefined | null): string | null {
    if (!originalUrl) return null;
    try {
      const s = originalUrl.trim();
      if (s.includes('/embed/')) return s;
      if (/^[a-zA-Z0-9_-]{11}$/.test(s)) return `https://www.youtube.com/embed/${s}?autoplay=1&rel=0`;
      const short = s.match(/youtu\.be\/([a-zA-Z0-9_-]{11})/);
      if (short && short[1]) return `https://www.youtube.com/embed/${short[1]}?autoplay=1&rel=0`;
      const urlObj = new URL(s, window.location.origin);
      if (urlObj.searchParams.has('v')) {
        const v = urlObj.searchParams.get('v');
        if (v) return `https://www.youtube.com/embed/${v}?autoplay=1&rel=0`;
      }
      const m = s.match(/watch\?v=([a-zA-Z0-9_-]{11})/);
      if (m && m[1]) return `https://www.youtube.com/embed/${m[1]}?autoplay=1&rel=0`;
    } catch {}
    return null;
  }

  private toYouTubePlaylistEmbed(originalUrl: string | undefined | null, playlistIdFromData?: string | null): string | null {
    if (!originalUrl && !playlistIdFromData) return null;
    try {
      const s = originalUrl ?? '';
      const m = s.match(/[?&]list=([a-zA-Z0-9_-]+)/);
      if (m && m[1]) return `https://www.youtube.com/embed/videoseries?list=${m[1]}&autoplay=1&rel=0`;
      if (playlistIdFromData) return `https://www.youtube.com/embed/videoseries?list=${playlistIdFromData}&autoplay=1&rel=0`;
    } catch {}
    return null;
  }
  // inside MusicComponent class

/** Returns a comma-separated list of artist names */
getArtistNames(track: PlayableMusic): string {
  return track.artists?.map(a => a.name).join(', ') ?? 'Unknown Artist';
}

/** Handles clicking the play button for a track */
onPlayButtonClick(track: PlayableMusic, index: number, event: Event): void {
  event.stopPropagation(); // prevent row click from firing
  if (track.sourceType === 'youtube' || track.sourceType === 'youtube-playlist') {
    this.currentYouTubeUrl = track.streamUrl ?? null;
    this.currentIndex = index;
  } else {
    this.toggleTrack(index);
  }
}

/** Row click to play the track */
playTrack(index: number): void {
  this.toggleTrack(index);
}

/** Helper to check if track is a YouTube track */
isYouTubeTrack(track: PlayableMusic): boolean {
  return track.sourceType === 'youtube' || track.sourceType === 'youtube-playlist';
}

}


// // src/app/Features/music/music-component/music-component.ts
// import { Component, OnDestroy, OnInit } from '@angular/core';
// import { Observable, of, Subject } from 'rxjs';
// import { catchError, takeUntil } from 'rxjs/operators';

// import { CommonModule } from '@angular/common';
// import { RouterModule } from '@angular/router';
// import { SafeUrlPipe } from '../../../Shared/Pipes/safe-url.pipe';
// import { Music } from '../../../Shared/Models/music.model';
// import { AudioPlayer, AudioState } from '../../../Core/Services/Audio-Player-Service/audio-player';
// import { MusicService } from '../../../Core/Services/Music-Service/music-service';
// import { resolveRemoteUrl, resolveStreamUrl } from '../../../Shared/Utilities/api-url.util';
// import { AlbumDto, ArtistDto, GenreDto } from '../../../Shared/Models/MusicResponseDto.dto';

// type PlayableMusic = Music & {
//   streamUrl?: string | null;         // resolved embed/stream url used by iframe or audio
//   originalPlaybackUrl?: string | null; // raw backend playback url (for fallback)
//   sourceType?: 'audio' | 'youtube' | 'youtube-playlist' | 'remote' | 'local';
//   __blobUrl__?: string;
// };

// @Component({
//   selector: 'app-music',
//   standalone: true,
//   imports: [CommonModule, RouterModule, SafeUrlPipe],
//   templateUrl: './music-component.html',
//   styleUrls: ['./music-component.scss']
// })
// export class MusicComponent implements OnInit, OnDestroy {
//   musicPage = 1;
//   musicList: PlayableMusic[] = [];
//   playlist: PlayableMusic[] = [];
//   currentIndex = -1;
//   isLoading = true;
//   error: string | null = null;

//   currentTrack$!: Observable<Music | null>;
//   audioState$!: Observable<AudioState>;

//   albums: AlbumDto[] = [];
//   artists: ArtistDto[] = [];
//   genres: GenreDto[] = [];

//   private destroy$ = new Subject<void>();

//   constructor(
//     private musicService: MusicService,
//     public audioPlayerService: AudioPlayer
//   ) {
//     // assign observables after injection to avoid "used before initialization" error
//     this.currentTrack$ = this.audioPlayerService.currentTrack$;
//     this.audioState$ = this.audioPlayerService.audioState$;
//   }

//   ngOnInit(): void {
//     this.loadMusicPage(1);
//     this.loadFilters();
//   }

//   ngOnDestroy(): void {
//     this.destroy$.next();
//     this.destroy$.complete();
//   }

//   // ----------------- loading -----------------
//   loadFilters(): void {
//     this.musicService.getAlbums().pipe(takeUntil(this.destroy$)).subscribe(res => this.albums = res?.data ?? []);
//     this.musicService.getArtists().pipe(takeUntil(this.destroy$)).subscribe(res => this.artists = res?.data ?? []);
//     this.musicService.getGenres().pipe(takeUntil(this.destroy$)).subscribe(res => this.genres = res?.data ?? []);
//   }

//   loadMusicPage(page: number): void {
//     this.isLoading = true;
//     this.error = null;

//     this.musicService.getMusic(page, 10).pipe(
//       catchError(err => {
//         console.error('Failed to load music page:', err);
//         this.error = 'Failed to load music.';
//         this.isLoading = false;
//         return of([] as Music[]);
//       }),
//       takeUntil(this.destroy$)
//     ).subscribe(data => {
//       this.musicList = (data || []).map(d => d as PlayableMusic);
//       this.playlist = this.musicList;
//       this.audioPlayerService.setPlaylist(this.playlist);
//       this.musicPage = page;
//       this.isLoading = false;
//     });
//   }

//   // ----------------- play logic -----------------
//   playTrack(index: number): void { this.play(index); }

//   play(index: number): void {
//     if (index < 0 || index >= this.playlist.length) return;
//     this.currentIndex = index;
//     const track = this.playlist[index];
//     this.error = null;

//     if (track.streamUrl) {
//       // If it's YouTube, iframe handles it. If not, hand to AudioPlayer.
//       if (track.sourceType === 'youtube' || track.sourceType === 'youtube-playlist') {
//         return;
//       }
//       this.audioPlayerService.playTrack(track, track.streamUrl, index);
//       return;
//     }

//     // fetch playback info
//     this.musicService.getPlaybackInfo(track.id).pipe(takeUntil(this.destroy$)).subscribe({
//       next: res => {
//         if (!res.success || !res.data) {
//           this.error = res.message || 'Could not get info for this track.';
//           return;
//         }

//         const playback = res.data;
//         // store original backend-provided URL for fallback/open-in-youtube
//         track.originalPlaybackUrl = playback.url ?? null;

//         let resolvedUrl: string | null = null;

//         switch (playback.playbackType) {
//           case 'YOUTUBE':
//             track.sourceType = 'youtube';
//             resolvedUrl = this.toYouTubeEmbed(playback.url);
//             // if embed cannot be built, resolvedUrl will be null — fallback handled below
//             break;

//           case 'YOUTUBE_CHANNEL_PLAYLISTS':
//             track.sourceType = 'youtube-playlist';
//             resolvedUrl = this.toYouTubePlaylistEmbed(playback.url, playback.data);
//             break;

//           case 'REMOTE_URL':
//             track.sourceType = 'remote';
//             resolvedUrl = resolveRemoteUrl(playback.url);
//             break;

//           case 'LOCAL_STREAM':
//             track.sourceType = 'local';
//             resolvedUrl = resolveStreamUrl(`Features/music/stream/${track.id}`);
//             break;

//           default:
//             console.warn('Unknown playback type:', playback.playbackType);
//             break;
//         }

//         // If embed couldn't be generated for YouTube, do NOT fail — keep original URL so user can open it in YouTube
//         if (!resolvedUrl && (track.sourceType === 'youtube' || track.sourceType === 'youtube-playlist')) {
//           // keep originalPlaybackUrl and return — UI will show "Open in YouTube" button
//           track.streamUrl = undefined;
//           return;
//         }

//         if (!resolvedUrl) {
//           this.error = 'Unsupported or missing playback URL.';
//           return;
//         }

//         track.streamUrl = resolvedUrl;

//         if (track.sourceType === 'youtube' || track.sourceType === 'youtube-playlist') {
//           // iframe will display
//           return;
//         }

//         // Non-YouTube -> use the AudioPlayer
//         this.audioPlayerService.playTrack(track, resolvedUrl, index);
//       },
//       error: err => {
//         console.error('Failed to get playback info:', err);
//         this.error = 'Unable to get information for this track.';
//       }
//     });
//   }

//   toggleTrack(index: number): void {
//     if (this.currentIndex === index) this.togglePlayPause();
//     else this.play(index);
//   }

//   togglePlayPause(): void { this.audioPlayerService.togglePlayPause(); }
//   mute(): void { this.audioPlayerService.toggleMute(); }

//   onVolumeChange(event: Event): void {
//     const v = Number((event.target as HTMLInputElement).value || 0);
//     this.audioPlayerService.setVolume(v / 100);
//   }

//   onSeek(event: Event): void {
//     const value = Number((event.target as HTMLInputElement).value || 0);
//     this.audioPlayerService.seek(value);
//   }

//   nextPage() { this.loadMusicPage(this.musicPage + 1); }
//   prevPage() { if (this.musicPage > 1) this.loadMusicPage(this.musicPage - 1); }
//   next() { if (this.currentIndex < this.playlist.length - 1) this.play(this.currentIndex + 1); }
//   previous() { if (this.currentIndex > 0) this.play(this.currentIndex - 1); }

//   // ----------------- filters & search -----------------
//   onSelectChange(event: Event, type: 'album' | 'artist' | 'genre'): void {
//     const value = (event.target as HTMLSelectElement).value;
//     if (!value) {
//       this.playlist = [...this.musicList];
//       this.audioPlayerService.setPlaylist(this.playlist);
//       return;
//     }
//     switch (type) {
//       case 'album': this.loadByAlbum(Number(value)); break;
//       case 'artist': this.loadByArtist(Number(value)); break;
//       case 'genre': this.loadByGenre(value); break;
//     }
//   }

//   onSearchChange(event: Event): void {
//     const q = (event.target as HTMLInputElement).value?.trim() ?? '';
//     if (!q) {
//       this.playlist = [...this.musicList];
//       this.audioPlayerService.setPlaylist(this.playlist);
//       return;
//     }
//     const lc = q.toLowerCase();
//     this.playlist = this.musicList.filter(t =>
//       (t.title ?? '').toLowerCase().includes(lc) ||
//       (t.album?.title ?? '').toLowerCase().includes(lc) ||
//       (t.artists?.map(a => a.name).join(' ') ?? '').toLowerCase().includes(lc)
//     );
//     this.audioPlayerService.setPlaylist(this.playlist);
//   }

//   loadByAlbum(albumId: number) {
//     this.isLoading = true;
//     this.musicService.getByAlbum(albumId).pipe(
//       catchError(err => { console.error(err); this.isLoading = false; return of([] as Music[]); }),
//       takeUntil(this.destroy$)
//     ).subscribe(data => {
//       this.musicList = (data || []).map(d => d as PlayableMusic);
//       this.playlist = [...this.musicList];
//       this.audioPlayerService.setPlaylist(this.playlist);
//       this.isLoading = false;
//     });
//   }

//   loadByArtist(artistId: number) {
//     this.isLoading = true;
//     this.musicService.getByArtist(artistId).pipe(
//       catchError(err => { console.error(err); this.isLoading = false; return of([] as Music[]); }),
//       takeUntil(this.destroy$)
//     ).subscribe(data => {
//       this.musicList = (data || []).map(d => d as PlayableMusic);
//       this.playlist = [...this.musicList];
//       this.audioPlayerService.setPlaylist(this.playlist);
//       this.isLoading = false;
//     });
//   }

//   loadByGenre(genre: string) {
//     this.isLoading = true;
//     this.musicService.getByGenre(genre).pipe(
//       catchError(err => { console.error(err); this.isLoading = false; return of([] as Music[]); }),
//       takeUntil(this.destroy$)
//     ).subscribe(data => {
//       this.musicList = (data || []).map(d => d as PlayableMusic);
//       this.playlist = [...this.musicList];
//       this.audioPlayerService.setPlaylist(this.playlist);
//       this.isLoading = false;
//     });
//   }

//   // ----------------- helpers -----------------
//   getArtistNames(track: PlayableMusic | null) {
//     return track?.artists?.map(a => a.name).join(', ') || 'Unknown Artist';
//   }

//   isYouTubeTrack(track: PlayableMusic | null) {
//     return !!(track && (track.sourceType === 'youtube' || track.sourceType === 'youtube-playlist'));
//   }

//   /**
//    * If user wants to open the track in YouTube (fallback or preference),
//    * this opens a new tab pointing to the appropriate watch / playlist URL.
//    */
//   openInYouTube(track: PlayableMusic): void {
//     // prefer a watch URL if we can derive a videoId
//     if (track.streamUrl && track.streamUrl.includes('/embed/')) {
//       const vid = this.extractVideoIdFromEmbed(track.streamUrl);
//       const list = this.extractPlaylistIdFromEmbed(track.streamUrl);
//       if (vid && list) {
//         window.open(`https://www.youtube.com/watch?v=${vid}&list=${list}`, '_blank', 'noopener');
//         return;
//       }
//       if (vid) {
//         window.open(`https://www.youtube.com/watch?v=${vid}`, '_blank', 'noopener');
//         return;
//       }
//     }

//     // if originalPlaybackUrl available, open it (it might be music.youtube.com/watch?v=...)
//     if (track.originalPlaybackUrl) {
//       // convert music.youtube.com to youtube.com watch page for compatibility
//       const watchUrl = this.normalizeToYouTubeWatch(track.originalPlaybackUrl);
//       window.open(watchUrl, '_blank', 'noopener');
//       return;
//     }

//     // fallback: open embed or playlist url if present
//     if (track.streamUrl) {
//       window.open(track.streamUrl, '_blank', 'noopener');
//       return;
//     }

//     // nothing to open
//     console.warn('No YouTube URL available to open for track:', track);
//   }

//   // ----------------- YouTube parsing helpers -----------------
//   private normalizeToYouTubeWatch(url: string): string {
//     try {
//       // if already youtube.com/watch, return
//       if (url.includes('youtube.com/watch') || url.includes('youtu.be/')) return url;
//       // handle music.youtube.com/watch?v=...
//       const u = new URL(url, window.location.origin);
//       if (u.hostname.includes('music.youtube.com') && u.searchParams.has('v')) {
//         const vid = u.searchParams.get('v');
//         const list = u.searchParams.get('list');
//         return list ? `https://www.youtube.com/watch?v=${vid}&list=${list}` : `https://www.youtube.com/watch?v=${vid}`;
//       }
//     } catch (e) {
//       // ignore
//     }
//     return url;
//   }

//   private extractVideoIdFromEmbed(embedUrl: string): string | null {
//     // embedUrl example: https://www.youtube.com/embed/ID?autoplay=1&rel=0
//     const m = embedUrl.match(/\/embed\/([a-zA-Z0-9_-]{11})/);
//     return m ? m[1] : null;
//   }

//   private extractPlaylistIdFromEmbed(embedUrl: string): string | null {
//     try {
//       const u = new URL(embedUrl);
//       return u.searchParams.get('list');
//     } catch {
//       const m = embedUrl.match(/[?&]list=([a-zA-Z0-9_-]+)/);
//       return m ? m[1] : null;
//     }
//   }

//   // robust embed builder (handles music.youtube.com, youtu.be, typical watch links and playlist cases)
//   private toYouTubeEmbed(originalUrl: string | undefined | null): string | null {
//     if (!originalUrl) return null;
//     try {
//       const s = originalUrl.trim();

//       // already an embed url -> return
//       if (s.includes('/embed/')) return s;

//       // direct id (11 chars)
//       if (/^[a-zA-Z0-9_-]{11}$/.test(s)) {
//         return `https://www.youtube.com/embed/${s}?autoplay=1&rel=0`;
//       }

//       // youtu.be short link
//       const short = s.match(/youtu\.be\/([a-zA-Z0-9_-]{11})/);
//       if (short && short[1]) return `https://www.youtube.com/embed/${short[1]}?autoplay=1&rel=0`;

//       // standard watch?v= or music.youtube.com/watch?v=
//       const urlObj = new URL(s, window.location.origin);
//       // if list present but also v -> embed single video
//       if (urlObj.searchParams.has('v')) {
//         const v = urlObj.searchParams.get('v');
//         if (v) return `https://www.youtube.com/embed/${v}?autoplay=1&rel=0`;
//       }

//       // fallback regex for watch?v=...
//       const m = s.match(/watch\?v=([a-zA-Z0-9_-]{11})/);
//       if (m && m[1]) return `https://www.youtube.com/embed/${m[1]}?autoplay=1&rel=0`;

//       return null;
//     } catch (e) {
//       console.warn('toYouTubeEmbed parse error for', originalUrl, e);
//       return null;
//     }
//   }

//   private toYouTubePlaylistEmbed(originalUrl: string | undefined | null, playlistIdFromData?: string | null): string | null {
//     if (!originalUrl && !playlistIdFromData) return null;
//     try {
//       const s = originalUrl ?? '';
//       // if already an embed playlist
//       if (s.includes('embed/videoseries?list=')) return s;
//       // try to parse list= from URL
//       try {
//         const u = new URL(s, window.location.origin);
//         const list = u.searchParams.get('list');
//         if (list) return `https://www.youtube.com/embed/videoseries?list=${list}&autoplay=1&rel=0`;
//       } catch { /* ignore */ }

//       // fallback regex
//       const m = s.match(/[?&]list=([a-zA-Z0-9_-]+)/);
//       if (m && m[1]) return `https://www.youtube.com/embed/videoseries?list=${m[1]}&autoplay=1&rel=0`;

//       if (playlistIdFromData) return `https://www.youtube.com/embed/videoseries?list=${playlistIdFromData}&autoplay=1&rel=0`;
//       return null;
//     } catch (e) {
//       console.warn('toYouTubePlaylistEmbed parse error', originalUrl, e);
//       if (playlistIdFromData) return `https://www.youtube.com/embed/videoseries?list=${playlistIdFromData}&autoplay=1&rel=0`;
//       return null;
//     }
//   }
// }


// import { Component, OnDestroy, OnInit } from '@angular/core';
// import { of, Subject } from 'rxjs';
// import { catchError, takeUntil } from 'rxjs/operators';

// import { CommonModule } from '@angular/common';
// import { RouterModule } from '@angular/router';
// import { FormsModule } from '@angular/forms';
// import { SafeUrlPipe } from '../../../Shared/Pipes/safe-url.pipe';
// import { Music } from '../../../Shared/Models/music.model';
// import { AudioPlayer, AudioState } from '../../../Core/Services/Audio-Player-Service/audio-player';
// import { MusicService } from '../../../Core/Services/Music-Service/music-service';
// import { resolveRemoteUrl, resolveStreamUrl } from '../../../Shared/Utilities/api-url.util';
// import { AlbumDto, ArtistDto, GenreDto } from '../../../Shared/Models/MusicResponseDto.dto';

// // ── music-component.ts ──
// type PlayableMusic = Music & {
//   coverUrl?: string;           // ← added this line
//   streamUrl?: string;
//   sourceType?: 'youtube' | 'remote' | 'local' | 'audio';
//   __blobUrl__?: string;
// };

// // Simple normalization
// function normalizeMusic(track: any): PlayableMusic {
//   return {
//     ...track,
//     releaseDate: track.releaseDate ? new Date(track.releaseDate) : new Date(),
//     createdAt: track.createdAt ? new Date(track.createdAt) : new Date(),
//     updatedAt: track.updatedAt ? new Date(track.updatedAt) : new Date(),
//   };
// }

// @Component({
//   selector: 'app-music',
//   standalone: true,
//   imports: [CommonModule, RouterModule, SafeUrlPipe, FormsModule],
//   templateUrl: './music-component.html',
//   styleUrls: ['./music-component.scss']
// })
// export class MusicComponent implements OnInit, OnDestroy {
//   musicPage = 1;
//   pageSize = 10;
//   musicList: PlayableMusic[] = [];
//   playlist: PlayableMusic[] = [];
//   currentIndex = -1;

//   albums: AlbumDto[] = [];
//   artists: ArtistDto[] = [];
//   genres: GenreDto[] = [];

//   isLoading = false;
//   error: string | null = null;

//   private destroy$ = new Subject<void>();

//   constructor(
//     private musicService: MusicService,
//     public audioPlayerService: AudioPlayer
//   ) {}

//   ngOnInit(): void {
//     this.loadMusicPage(1);
//     this.loadFilters();
//   }

//   ngOnDestroy(): void {
//     this.destroy$.next();
//     this.destroy$.complete();

//     // Cleanup blob URLs
//     this.musicList.forEach(t => {
//       if ((t as PlayableMusic).__blobUrl__) {
//         URL.revokeObjectURL((t as PlayableMusic).__blobUrl__!);
//         delete (t as PlayableMusic).__blobUrl__;
//       }
//     });
//   }

//   private loadFilters(): void {
//     this.musicService.getAlbums().pipe(takeUntil(this.destroy$)).subscribe(res => this.albums = res.data ?? []);
//     this.musicService.getArtists().pipe(takeUntil(this.destroy$)).subscribe(res => this.artists = res.data ?? []);
//     this.musicService.getGenres().pipe(takeUntil(this.destroy$)).subscribe(res => this.genres = res.data ?? []);
//   }

//   loadMusicPage(page: number): void {
//     this.isLoading = true;
//     this.error = null;
//     this.musicService.getMusic(page, this.pageSize).pipe(
//       catchError(err => {
//         console.error(err);
//         this.error = 'Failed to load music.';
//         this.isLoading = false;
//         return of([] as Music[]);
//       }),
//       takeUntil(this.destroy$)
//     ).subscribe(data => {
//       this.musicList = data.map(normalizeMusic);
//       this.playlist = this.musicList;
//       this.audioPlayerService.setPlaylist(this.playlist as any);
//       this.musicPage = page;
//       this.isLoading = false;
//     });
//   }

//   play(index: number): void {
//     if (index < 0 || index >= this.playlist.length) return;
//     this.currentIndex = index;
//     const track = this.playlist[index];
//     this.error = null;

//     if (track.streamUrl) {
//       this.audioPlayerService.playTrack(track as any, track.streamUrl, index);
//       return;
//     }

//     this.musicService.getPlaybackInfo(track.id).pipe(takeUntil(this.destroy$)).subscribe({
//       next: res => {
//         if (!res.success || !res.data) {
//           this.error = res.message || 'Could not get playback info.';
//           return;
//         }
//         const playback = res.data;
//         let resolvedUrl: string | null = null;

//         switch (playback.playbackType) {
//           case 'YOUTUBE':
//             track.sourceType = 'youtube';
//             resolvedUrl = playback.url;
//             break;
//           case 'REMOTE_URL':
//             track.sourceType = 'remote';
//             resolvedUrl = resolveRemoteUrl(playback.url);
//             break;
//           case 'LOCAL_STREAM':
//             track.sourceType = 'local';
//             resolvedUrl = resolveStreamUrl(`Features/music/stream/${track.id}`);
//             break;
//         }

//         if (!resolvedUrl) {
//           this.error = 'Unsupported or missing playback URL.';
//           return;
//         }

//         track.streamUrl = resolvedUrl;
//         this.audioPlayerService.playTrack(track as any, resolvedUrl, index);
//       },
//       error: err => {
//         console.error(err);
//         this.error = 'Unable to play this track.';
//       }
//     });
//   }

//   nextPage() { this.loadMusicPage(this.musicPage + 1); }
//   prevPage() { if (this.musicPage > 1) this.loadMusicPage(this.musicPage - 1); }
//   next() { if (this.currentIndex < this.playlist.length - 1) this.play(this.currentIndex + 1); }
//   previous() { if (this.currentIndex > 0) this.play(this.currentIndex - 1); }
//   onSeek(event: Event) { this.audioPlayerService.seek(Number((event.target as HTMLInputElement).value)); }
//   getArtistNames(track: PlayableMusic | null) { return track?.artists?.map(a => a.name).join(', ') || 'Unknown Artist'; }

//   // Filters
//   onSelectChange(event: Event, type: 'album' | 'artist' | 'genre'): void {
//     const value = (event.target as HTMLSelectElement).value;
//     if (!value) return;
//     switch (type) {
//       case 'album': this.loadByAlbum(Number(value)); break;
//       case 'artist': this.loadByArtist(Number(value)); break;
//       case 'genre': this.loadByGenre(value); break;
//     }
//   }

//   loadByAlbum(albumId: number): void {
//     this.isLoading = true;
//     this.musicService.getByAlbum(albumId).pipe(
//       catchError(err => { console.error(err); this.isLoading = false; return of([] as Music[]); }),
//       takeUntil(this.destroy$)
//     ).subscribe(data => {
//       this.musicList = data.map(normalizeMusic);
//       this.audioPlayerService.setPlaylist(this.musicList as any);
//       this.isLoading = false;
//     });
//   }

//   loadByArtist(artistId: number): void {
//     this.isLoading = true;
//     this.musicService.getByArtist(artistId).pipe(
//       catchError(err => { console.error(err); this.isLoading = false; return of([] as Music[]); }),
//       takeUntil(this.destroy$)
//     ).subscribe(data => {
//       this.musicList = data.map(normalizeMusic);
//       this.audioPlayerService.setPlaylist(this.musicList as any);
//       this.isLoading = false;
//     });
//   }

//   loadByGenre(genre: string): void {
//     this.isLoading = true;
//     this.musicService.getByGenre(genre).pipe(
//       catchError(err => { console.error(err); this.isLoading = false; return of([] as Music[]); }),
//       takeUntil(this.destroy$)
//     ).subscribe(data => {
//       this.musicList = data.map(normalizeMusic);
//       this.audioPlayerService.setPlaylist(this.musicList as any);
//       this.isLoading = false;
//     });
//   }

// }


// export class MusicComponent implements OnInit {
//   musicPage = 1;
//   musicList: Music[] = [];
//   playlist: Music[] = [];
//   currentIndex = -1;
//   isLoading = true;
//   error: string | null = null;

//   currentTrack$: Observable<Music | null>;
//   audioState$: Observable<AudioState>;

//   constructor(
//     private musicService: MusicService,
//     public audioPlayerService: AudioPlayer
//   ) {
//     this.currentTrack$ = this.audioPlayerService.currentTrack$;
//     this.audioState$ = this.audioPlayerService.audioState$;
//   }

//   ngOnInit(): void {
//     this.loadMusicPage(1);

//   }

//   loadMusicPage(page: number): void {
//     this.isLoading = true;
//     this.musicService.getMusic(page, 10).pipe(
//       catchError(err => {
//         console.error('Failed to load music page:', err);
//         this.error = "Failed to load music.";
//         this.isLoading = false;
//         return of([]);
//       })
//     ).subscribe(data => {
//       this.musicList = data;
//       this.playlist = data;
//       this.audioPlayerService.setPlaylist(data);
//       this.musicPage = page;
//       this.isLoading = false;
//     });
//   }

//   play(index: number): void {
//     if (index < 0 || index >= this.playlist.length) return;
//     this.currentIndex = index;
//     const track = this.playlist[index];
//     this.error = null;

//     if (track.streamUrl) {
//       this.audioPlayerService.playTrack(track, track.streamUrl, index);
//       return;
//     }

//     this.musicService.getPlaybackInfo(track.id).subscribe({
//       next: (res) => {
//         if (!res.success || !res.data) {
//           this.error = res.message || "Could not get info for this track.";
//           return;
//         }
//         const playback = res.data;
//         let resolvedUrl: string | null = null;

//         switch (playback.playbackType) {
//           case 'YOUTUBE':
//             track.sourceType = 'youtube';
//             resolvedUrl = playback.url;
//             break;
//           case 'REMOTE_URL':
//             track.sourceType = 'remote';
//             resolvedUrl = resolveRemoteUrl(playback.url);
//             break;
//           case 'LOCAL_STREAM':
//             track.sourceType = 'local';
//             resolvedUrl = resolveStreamUrl(`Features/music/stream/${track.id}`);
//             break;
//         }

//         if (!resolvedUrl) {
//           this.error = 'Unsupported or missing playback URL.';
//           return;
//         }

//         track.streamUrl = resolvedUrl;
//         this.audioPlayerService.playTrack(track, resolvedUrl, index);
//       },
//       error: (err) => {
//         console.error('Failed to get playback info:', err);
//         this.error = 'Unable to get information for this track.';
//       }
//     });
//   }

//   nextPage() { this.loadMusicPage(this.musicPage + 1); }
//   prevPage() { if (this.musicPage > 1) this.loadMusicPage(this.musicPage - 1); }
//   next() { if (this.currentIndex < this.playlist.length - 1) this.play(this.currentIndex + 1); }
//   previous() { if (this.currentIndex > 0) this.play(this.currentIndex - 1); }
//   onSeek(event: Event) { this.audioPlayerService.seek(Number((event.target as HTMLInputElement).value)); }
//   getArtistNames(track: Music | null) { return track?.artists?.map(a => a.name).join(', ') || 'Unknown Artist'; }
//   isYouTubeTrack(track: Music | null) { return track?.sourceType === 'youtube' && !!track.streamUrl; }
// }

// export class MusicComponent implements OnInit {
  
//   public musicPage = 1;
//   public musicList: Music[] = [];
  
  
//   playlist: Music[] = [];
//   currentTrack$: Observable<Music | null>;
//   audioState$: Observable<AudioState>;

//   currentIndex: number = -1;
//   isLoading = true;
//   error: string | null = null;

 

//   constructor(
//     private musicService: MusicService,
//     public audioPlayerService: AudioPlayer
//   ) {
//     this.currentTrack$ = this.audioPlayerService.currentTrack$;
//     this.audioState$ = this.audioPlayerService.audioState$;
//   } ngOnInit(): void {
//     this.loadMusicPage(1); // ✅ Initial page load
//   }

//   // ✅ Load music by page
//   loadMusicPage(page: number): void {
//     this.isLoading = true;
//     this.musicService.getMusic(page, 10).pipe(
//       catchError(err => {
//         console.error('Failed to load music page:', err);
//         this.error = "Failed to load music.";
//         this.isLoading = false;
//         return of([]);
//       })
//     ).subscribe(data => {
//       this.musicList = data;
//       this.musicPage = page;
//       this.playlist = data;
//       this.audioPlayerService.setPlaylist(data);
//       this.isLoading = false;
//     });
//   }

//   // ✅ Pagination controls
//   nextPage(): void {
//     this.loadMusicPage(this.musicPage + 1);
//   }

//   prevPage(): void {
//     if (this.musicPage > 1) {
//       this.loadMusicPage(this.musicPage - 1);
//     }
//   }

//   // ✅ Play selected track
//   play(index: number): void {
//     if (index < 0 || index >= this.playlist.length) return;

//     this.currentIndex = index;
//     const trackToPlay = this.playlist[index];
//     this.error = null;

//     if (trackToPlay.streamUrl) {
//       console.log('Using cached stream URL:', trackToPlay.streamUrl);
//       this.audioPlayerService.playTrack(trackToPlay, trackToPlay.streamUrl);
//       return;
//     }

//     this.musicService.getPlaybackInfo(trackToPlay.id).subscribe({
//       next: (response) => {
//         console.log('Playback response:', response);

//         if (!response.success || !response.data) {
//           this.error = response.message || "Could not get info for this track.";
//           return;
//         }

//         const playback = response.data;
//         const rawUrl = playback.url || playback.data;

//         if (!rawUrl || typeof rawUrl !== 'string' || rawUrl.trim() === '') {
//           this.error = 'Stream URL is missing or invalid for this track.';
//           console.warn('Invalid playback URL:', playback);
//           return;
//         }

   

//         switch (playback.playbackType) {
//           case 'YOUTUBE':
//             trackToPlay.sourceType = 'youtube';
//             trackToPlay.streamUrl = rawUrl;
//             this.audioPlayerService.setCurrentTrack(trackToPlay);
//             return;

//          case 'REMOTE_URL':
//          trackToPlay.sourceType = 'remote';
//          trackToPlay.streamUrl = resolveRemoteUrl(rawUrl);
//          break;


//           case 'LOCAL_STREAM':
//             trackToPlay.sourceType = 'local';
//             trackToPlay.streamUrl = resolveStreamUrl(`Features/music/stream/${trackToPlay.id}`);
//             break;

//           default:
//             this.error = 'Unsupported playback type.';
//             console.warn('Unsupported playback type:', playback.playbackType);
//             return;
//         }

//         console.log('Resolved stream URL:', trackToPlay.streamUrl);
//         this.audioPlayerService.playTrack(trackToPlay, trackToPlay.streamUrl!);
//       },
//       error: (err) => {
//         console.error('Failed to get playback info:', err);
//         this.error = 'Unable to get information for this track.';
//       }
//     });
//   }

//   next(): void {
//     if (this.currentIndex < this.playlist.length - 1) {
//       this.play(this.currentIndex + 1);
//     }
//   }

//   previous(): void {
//     if (this.currentIndex > 0) {
//       this.play(this.currentIndex - 1);
//     }
//   }

//   onSeek(event: Event): void {
//     const target = event.target as HTMLInputElement;
//     this.audioPlayerService.seek(Number(target.value));
//   }

//   getArtistNames(track: Music | null): string {
//     if (!track?.artists?.length) return 'Unknown Artist';
//     return track.artists.map(a => a.name).join(', ');
//   }

//   isYouTubeTrack(track: Music | null): boolean {
//     return track?.sourceType === 'youtube' && !!track.streamUrl;
//   }
// } 