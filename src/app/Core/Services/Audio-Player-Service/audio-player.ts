// audio-player.ts
import { Injectable, OnDestroy } from '@angular/core';
import { BehaviorSubject } from 'rxjs';
import { Music } from '../../../Shared/Models/music.model';

export interface AudioState {
  playing: boolean;
  loading: boolean;
  currentTime: number;
  duration: number;
  readableCurrentTime: string;
  readableDuration: string;
  volume: number;
  muted: boolean;
  error: string | null;
}

@Injectable({
  providedIn: 'root'
})
export class AudioPlayer implements OnDestroy {
  private audio = new Audio();
  private currentBlobUrl: string | null = null;
  private playlist: Music[] = [];
  private currentIndex = -1;

  private _currentTrack$ = new BehaviorSubject<Music | null>(null);
  private _audioState$ = new BehaviorSubject<AudioState>({
    playing: false,
    loading: false,
    currentTime: 0,
    duration: 0,
    readableCurrentTime: '00:00',
    readableDuration: '00:00',
    volume: 1,
    muted: false,
    error: null
  });

  currentTrack$ = this._currentTrack$.asObservable();
  audioState$ = this._audioState$.asObservable();

  constructor() {
    this.audio.volume = this._audioState$.value.volume;
    this.addAudioEventListeners();
  }

  ngOnDestroy(): void {
    this.stop();
    if (this.currentBlobUrl) {
      URL.revokeObjectURL(this.currentBlobUrl);
      this.currentBlobUrl = null;
    }
  }

  setPlaylist(tracks: Music[], startIndex: number = -1) {
    this.playlist = tracks;
    this.currentIndex = startIndex;
  }

  async playTrack(track: Music, url: string, index?: number): Promise<void> {
    if (!url?.trim()) {
      console.error('Invalid URL provided to playTrack:', url);
      this.updateState({ error: 'Invalid track URL.' });
      return;
    }

    if (index !== undefined) {
      this.currentIndex = index;
    } else {
      const foundIndex = this.playlist.findIndex(t => t.id === track.id);
      if (foundIndex !== -1) this.currentIndex = foundIndex;
    }

    this.stop(false); // don’t clear current track
    this._currentTrack$.next(track);
    this.updateState({ loading: true, error: null });

    if (this.currentBlobUrl) {
      URL.revokeObjectURL(this.currentBlobUrl);
      this.currentBlobUrl = null;
    }
    if (url.startsWith('blob:')) this.currentBlobUrl = url;

    try {
      this.audio.src = url;
      this.audio.load();
      await this.audio.play();
    } catch (err) {
      console.error(`Error in audio.play() for src: ${url}`, err);
      this.updateState({ loading: false, playing: false, error: 'Failed to play audio.' });
    }
  }

  togglePlayPause(): void {
    if (!this.audio.src) {
      if (this.playlist.length > 0) {
        this.playNext(true);
      }
      return;
    }
    this._audioState$.value.playing
      ? this.audio.pause()
      : this.audio.play().catch(err => {
          console.error('Error resuming playback:', err);
          this.updateState({ loading: false, playing: false, error: 'Failed to resume playback.' });
        });
  }

  stop(clearTrack: boolean = true) {
    this.audio.pause();
    this.audio.removeAttribute('src');
    this.audio.load();
    this.updateState({
      playing: false,
      loading: false,
      currentTime: 0,
      duration: 0,
      readableCurrentTime: '00:00',
      readableDuration: '00:00',
      error: null
    });
    if (clearTrack) this._currentTrack$.next(null);
  }

  seek(time: number) {
    if (this.audio.duration && !isNaN(this.audio.duration)) {
      this.audio.currentTime = Math.max(0, Math.min(time, this.audio.duration));
      this.updateState({
        currentTime: this.audio.currentTime,
        readableCurrentTime: this.formatTime(this.audio.currentTime)
      });
    }
  }

  setVolume(volume: number) {
    const newVolume = Math.max(0, Math.min(volume, 1));
    this.audio.volume = newVolume;
    this.updateState({ volume: newVolume, muted: this.audio.muted });
  }

  toggleMute() {
    this.audio.muted = !this.audio.muted;
    this.updateState({ muted: this.audio.muted });
  }

  playNext(forceFirst = false) {
    if (forceFirst && this.playlist.length > 0) {
      this.currentIndex = 0;
    } else if (this.currentIndex < this.playlist.length - 1) {
      this.currentIndex++;
    } else {
      this.stop();
      return;
    }

    const nextTrack = this.playlist[this.currentIndex];
    if (nextTrack?.streamUrl) {
      this.playTrack(nextTrack, nextTrack.streamUrl);
    }
  }

  playPrevious() {
    if (this.currentIndex > 0) {
      this.currentIndex--;
      const prevTrack = this.playlist[this.currentIndex];
      if (prevTrack?.streamUrl) {
        this.playTrack(prevTrack, prevTrack.streamUrl);
      }
    } else {
      this.seek(0);
    }
  }

  private addAudioEventListeners() {
    this.audio.addEventListener('playing', () => this.updateState({ playing: true, loading: false }));
    this.audio.addEventListener('pause', () => this.updateState({ playing: false }));
    this.audio.addEventListener('loadstart', () => this.updateState({ loading: true, error: null }));
    this.audio.addEventListener('canplay', () => this.updateState({ loading: false }));
    this.audio.addEventListener('error', () => {
      let errorMessage = 'Audio error occurred.';
      if (this.audio.error) {
        switch (this.audio.error.code) {
          case MediaError.MEDIA_ERR_ABORTED: errorMessage = 'Playback aborted.'; break;
          case MediaError.MEDIA_ERR_NETWORK: errorMessage = 'Network error.'; break;
          case MediaError.MEDIA_ERR_DECODE: errorMessage = 'Decode error.'; break;
          case MediaError.MEDIA_ERR_SRC_NOT_SUPPORTED: errorMessage = 'Source not supported.'; break;
        }
      }
      this.updateState({ loading: false, playing: false, error: errorMessage });
    });
    this.audio.addEventListener('ended', () => {
      this.updateState({ playing: false });
      this.playNext();
    });
    this.audio.addEventListener('timeupdate', () => {
      this.updateState({
        currentTime: this.audio.currentTime,
        readableCurrentTime: this.formatTime(this.audio.currentTime)
      });
    });
    this.audio.addEventListener('durationchange', () => {
      this.updateState({
        duration: this.audio.duration,
        readableDuration: this.formatTime(this.audio.duration)
      });
    });
    this.audio.addEventListener('volumechange', () => {
      this.updateState({ volume: this.audio.volume, muted: this.audio.muted });
    });
  }

  private updateState(partialState: Partial<AudioState>) {
    this._audioState$.next({ ...this._audioState$.value, ...partialState });
  }

  private formatTime(time: number): string {
    if (isNaN(time) || !isFinite(time)) return '00:00';
    const minutes = Math.floor(time / 60);
    const seconds = Math.floor(time % 60);
    return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  }
}

// export class AudioPlayer {
//   private audio = new Audio();
//   private currentBlobUrl: string | null = null;
//   private playlist: Music[] = [];
//   private currentIndex = -1;

//   private _currentTrack$ = new BehaviorSubject<Music | null>(null);
//   private _audioState$ = new BehaviorSubject<AudioState>({
//     playing: false,
//     loading: false,
//     currentTime: 0,
//     duration: 0,
//     readableCurrentTime: '00:00',
//     readableDuration: '00:00'
//   });

//   currentTrack$ = this._currentTrack$.asObservable();
//   audioState$ = this._audioState$.asObservable();

//   constructor() {
//     this.addAudioEventListeners();
//   }

//   setPlaylist(tracks: Music[]) {
//     this.playlist = tracks;
//     this.currentIndex = -1;
//   }

//   setCurrentTrack(track: Music) {
//     this._currentTrack$.next(track);
//     if (this._audioState$.value.playing) this.stop();
//   }

//   async playTrack(track: Music, url: string, index?: number): Promise<void> {
//     if (!url?.trim()) {
//       console.error('Invalid URL provided to playTrack:', url);
//       return;
//     }
//     if (index !== undefined) this.currentIndex = index;

//     this.stop();
//     this._currentTrack$.next(track);
//     this.updateState({ loading: true });

//     if (this.currentBlobUrl) {
//       URL.revokeObjectURL(this.currentBlobUrl);
//       this.currentBlobUrl = null;
//     }
//     if (url.startsWith('blob:')) this.currentBlobUrl = url;

//     try {
//       this.audio.src = url;
//       this.audio.load();
//       await this.audio.play();
//     } catch (err) {
//       console.error(`Error in audio.play() for src: ${url}`, err);
//       this.updateState({ loading: false, playing: false });
//     }
//   }

//   togglePlayPause(): void {
//     if (!this.audio.src) return;
//     this._audioState$.value.playing
//       ? this.audio.pause()
//       : this.audio.play().catch(err => {
//           console.error('Error during audio.play():', err);
//           this.updateState({ loading: false, playing: false });
//         });
//   }

//   stop() {
//     this.audio.pause();
//     this.audio.removeAttribute('src');
//     this.audio.load();
//     this.updateState({
//       playing: false,
//       loading: false,
//       currentTime: 0,
//       duration: 0,
//       readableCurrentTime: '00:00',
//       readableDuration: '00:00'
//     });
//   }

//   seek(time: number) {
//     this.audio.currentTime = time;
//   }

//   private addAudioEventListeners() {
//     this.audio.addEventListener('playing', () => this.updateState({ playing: true, loading: false }));
//     this.audio.addEventListener('pause', () => this.updateState({ playing: false }));
//     this.audio.addEventListener('loadstart', () => this.updateState({ loading: true }));
//     this.audio.addEventListener('canplay', () => this.updateState({ loading: false }));
//     this.audio.addEventListener('error', () => {
//       console.error('HTMLAudioElement Error:', this.audio.error);
//       this.updateState({ loading: false, playing: false });
//     });
//     this.audio.addEventListener('ended', () => {
//       this.updateState({ playing: false });
//       this.playNext();
//     });
//     this.audio.addEventListener('timeupdate', () => {
//       this.updateState({
//         currentTime: this.audio.currentTime,
//         readableCurrentTime: this.formatTime(this.audio.currentTime)
//       });
//     });
//     this.audio.addEventListener('durationchange', () => {
//       this.updateState({
//         duration: this.audio.duration,
//         readableDuration: this.formatTime(this.audio.duration)
//       });
//     });
//   }

//   private playNext() {
//     if (this.currentIndex < this.playlist.length - 1) {
//       const nextTrack = this.playlist[++this.currentIndex];
//       if (nextTrack?.streamUrl) {
//         this.playTrack(nextTrack, nextTrack.streamUrl);
//       }
//     }
//   }

//   private updateState(partialState: Partial<AudioState>) {
//     this._audioState$.next({ ...this._audioState$.value, ...partialState });
//   }

//   private formatTime(time: number = 0): string {
//     if (isNaN(time)) return '00:00';
//     const minutes = Math.floor(time / 60);
//     const seconds = Math.floor(time % 60);
//     return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
//   }
// }

// export class AudioPlayer {
//   private audio = new Audio();
//   private currentBlobUrl: string | null = null;

//   private playlist: Music[] = [];
//   private currentIndex = -1;

//   private _currentTrack$ = new BehaviorSubject<Music | null>(null);
//   private _audioState$ = new BehaviorSubject<AudioState>({
//     playing: false,
//     loading: false,
//     currentTime: 0,
//     duration: 0,
//     readableCurrentTime: '00:00',
//     readableDuration: '00:00'
//   });

//   public currentTrack$ = this._currentTrack$.asObservable();
//   public audioState$ = this._audioState$.asObservable();

  
//   constructor() {
//     this.addAudioEventListeners();
//   }

//   // ✅ Set playlist for navigation
//   setPlaylist(tracks: Music[]) {
//     this.playlist = tracks;
//     this.currentIndex = -1;
//   }

//   // ✅ Set current track without playing
//   setCurrentTrack(track: Music) {
//     this._currentTrack$.next(track);
//     if (this._audioState$.value.playing) {
//       this.stop();
//     }
//   }

//   // ✅ Play a track with a valid stream URL
//   async playTrack(track: Music, url: string): Promise<void> {
//     if (!url || typeof url !== 'string') {
//       console.error('Invalid URL provided to playTrack:', url);
//       return;
//     }

//     this.stop();
//     this._currentTrack$.next(track);
//     this.updateState({ loading: true });

//     if (this.currentBlobUrl) {
//       URL.revokeObjectURL(this.currentBlobUrl);
//       this.currentBlobUrl = null;
//     }

//     if (url.startsWith('blob:')) {
//       this.currentBlobUrl = url;
//     }

//     try {
//       console.log('Playing audio from URL:', url);
//       this.audio.src = url;
//       this.audio.load();
//       await this.audio.play();
//     } catch (err) {
//       console.error(`Error in audio.play() for src: ${url}`, err);
//       this.updateState({ loading: false, playing: false });
//     }
//   }
//  // ✅ Toggle play/pause
//   togglePlayPause(): void {
//     if (!this.audio.src) {
//       console.warn('No audio source set. Cannot toggle playback.');
//       return;
//     }

//     if (this._audioState$.value.playing) {
//       this.audio.pause();
//     } else {
//       this.audio.play().catch(err => {
//         console.error('Error during audio.play():', err);
//         this.updateState({ loading: false, playing: false });
//       });
//     }
//   }
//   // ✅ Stop playback and reset state
//   stop() {
//     this.audio.pause();
//     this.audio.removeAttribute('src');
//     this.audio.load();
//     this.updateState({
//       playing: false,
//       loading: false,
//       currentTime: 0,
//       duration: 0,
//       readableCurrentTime: '00:00',
//       readableDuration: '00:00'
//     });
//   }

//   // ✅ Seek to a specific time
//   seek(time: number) {
//     this.audio.currentTime = time;
//   }

//   // ✅ Attach audio event listeners
//   private addAudioEventListeners() {
//     this.audio.addEventListener('playing', () => this.updateState({ playing: true, loading: false }));
//     this.audio.addEventListener('pause', () => this.updateState({ playing: false }));
//     this.audio.addEventListener('loadstart', () => this.updateState({ loading: true }));
//     this.audio.addEventListener('canplay', () => this.updateState({ loading: false }));
//     this.audio.addEventListener('error', () => {
//       console.error('HTMLAudioElement Error:', this.audio.error);
//       this.updateState({ loading: false, playing: false });
//     });
//     this.audio.addEventListener('ended', () => this.updateState({ playing: false }));
//     this.audio.addEventListener('timeupdate', () => {
//       this.updateState({
//         currentTime: this.audio.currentTime,
//         readableCurrentTime: this.formatTime(this.audio.currentTime)
//       });
//     });
//     this.audio.addEventListener('durationchange', () => {
//       this.updateState({
//         duration: this.audio.duration,
//         readableDuration: this.formatTime(this.audio.duration)
//       });
//     });
//   }

//   // ✅ Update audio state
//   private updateState(partialState: Partial<AudioState>) {
//     const currentState = this._audioState$.value;
//     this._audioState$.next({ ...currentState, ...partialState });
//   }

//   // ✅ Format time as MM:SS
//   private formatTime(time: number = 0): string {
//     if (isNaN(time)) return '00:00';
//     const minutes = Math.floor(time / 60);
//     const seconds = Math.floor(time % 60);
//     return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
//   }
// }









// export interface AudioState {
//   playing: boolean;
//   loading: boolean;
//   currentTime: number;
//   duration: number;
//   readableCurrentTime: string;
//   readableDuration: string;
// }

// @Injectable({
//   providedIn: 'root'
// })
// export class AudioPlayer {
//   private audio = new Audio();
//   private _currentTrack$ = new BehaviorSubject<Music | null>(null);
//   private _audioState$ = new BehaviorSubject<AudioState>({
//     playing: false,
//     loading: false,
//     currentTime: 0,
//     duration: 0,
//     readableCurrentTime: '00:00',
//     readableDuration: '00:00'
//   });

//   private playlist: Music[] = [];
//   private currentIndex = -1;
//   private currentBlobUrl: string | null = null;

//   public currentTrack$ = this._currentTrack$.asObservable();
//   public audioState$ = this._audioState$.asObservable();

//   constructor() {
//     this.addAudioEventListeners();
//   }

//   setPlaylist(tracks: Music[]) {
//     this.playlist = tracks;
//     this.currentIndex = -1;
//   }
  

//   async playTrackByIndex(index: number, streamUrl: string): Promise<void> {
//     if (index < 0 || index >= this.playlist.length) return;

//     const track = this.playlist[index];
//     if (!streamUrl || typeof streamUrl !== 'string') {
//       console.warn('Missing or invalid stream URL for track:', track.title);
//       return;
//     }

//     this.currentIndex = index;
//     await this.playTrack(track, streamUrl);
//   }

//   async playTrack(track: Music, streamUrl: string): Promise<void> {
//     if (!streamUrl || typeof streamUrl !== 'string') {
//       console.error('Invalid stream URL:', streamUrl);
//       return;
//     }

//     const isYouTubeId = /^[a-zA-Z0-9_-]{11}$/.test(streamUrl);
//     const isExternalVideo = /^https?:\/\//.test(streamUrl) && !streamUrl.endsWith('.mp3') && !streamUrl.endsWith('.m4a');

//     if (isYouTubeId || isExternalVideo) {
//       console.warn('Stream URL is not compatible with <audio>: ', streamUrl);
//       return;
//     }

//     if (this._currentTrack$.value?.id === track.id && this._audioState$.value.playing) {
//       return;
//     }

//     this._currentTrack$.next(track);
//     this.stop();
//     this.updateState({ loading: true });

//     try {
//       this.audio.src = streamUrl;
//       this.audio.load();
//       await this.audio.play(); // ✅ Always returns Promise<void>
//     } catch (err) {
//       console.error('Error playing audio:', err);
//       this.updateState({ loading: false, playing: false });
//     }
//   }

//   setCurrentTrack(track: Music) {
//     this._currentTrack$.next(track);
//     this.updateState({ playing: false, loading: false });
//   }

//   togglePlayPause() {
//     if (this._audioState$.value.playing) {
//       this.audio.pause();
//     } else {
//       this.audio.play();
//     }
//   }

//   seek(time: number) {
//     this.audio.currentTime = time;
//     this.updateState({
//       currentTime: time,
//       readableCurrentTime: this.formatTime(time)
//     });
//   }

//   stop() {
//     this.audio.pause();
//     this.audio.currentTime = 0;
//     this.updateState({
//       playing: false,
//       currentTime: 0,
//       readableCurrentTime: '00:00'
//     });
//   }

//   async playNext(): Promise<void> {
//     if (this.currentIndex + 1 < this.playlist.length) {
//       const nextTrack = this.playlist[this.currentIndex + 1];
//       if (nextTrack.streamUrl) {
//         await this.playTrackByIndex(this.currentIndex + 1, nextTrack.streamUrl);
//       }
//     }
//   }

//   async playPrevious(): Promise<void> {
//     if (this.currentIndex > 0) {
//       const prevTrack = this.playlist[this.currentIndex - 1];
//       if (prevTrack.streamUrl) {
//         await this.playTrackByIndex(this.currentIndex - 1, prevTrack.streamUrl);
//       }
//     }
//   }

//   getAudioElement(): HTMLAudioElement {
//     return this.audio;
//   }

//   private addAudioEventListeners() {
//     this.audio.addEventListener('playing', () =>
//       this.updateState({ playing: true, loading: false })
//     );
//     this.audio.addEventListener('pause', () =>
//       this.updateState({ playing: false })
//     );
//     this.audio.addEventListener('loadstart', () =>
//       this.updateState({ loading: true })
//     );
//     this.audio.addEventListener('canplay', () =>
//       this.updateState({ loading: false })
//     );
//     this.audio.addEventListener('timeupdate', () =>
//       this.updateState({
//         currentTime: this.audio.currentTime,
//         readableCurrentTime: this.formatTime(this.audio.currentTime)
//       })
//     );
//     this.audio.addEventListener('durationchange', () =>
//       this.updateState({
//         duration: this.audio.duration,
//         readableDuration: this.formatTime(this.audio.duration)
//       })
//     );
//     this.audio.addEventListener('error', () =>
//       this.updateState({ loading: false })
//     );
//     this.audio.addEventListener('ended', () => {
//       this.updateState({ playing: false });
//       this.playNext(); // Auto-play next track
//     });
//   }

//   private updateState(partialState: Partial<AudioState>) {
//     const currentState = this._audioState$.value;
//     this._audioState$.next({ ...currentState, ...partialState });
//   }

//   private formatTime(time: number = 0): string {
//     const minutes = Math.floor(time / 60);
//     const seconds = Math.floor(time % 60);
//     return `${minutes.toString().padStart(2, '0')}:${seconds
//       .toString()
//       .padStart(2, '0')}`;
//   }
// }