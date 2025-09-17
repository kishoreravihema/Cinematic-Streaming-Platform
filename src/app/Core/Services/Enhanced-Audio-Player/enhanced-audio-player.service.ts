import { Injectable, OnDestroy } from '@angular/core';
import { BehaviorSubject, Observable, Subject, interval } from 'rxjs';
import { takeUntil, filter } from 'rxjs/operators';
import { Store } from '@ngrx/store';
import { AppState } from '../../Store/app.state';
import * as PlayerActions from '../../Store/player/player.actions';
import * as UserActions from '../../Store/user/user.actions';
import { Music } from '../../../Shared/Models/music.model';

export interface EnhancedAudioState {
  playing: boolean;
  loading: boolean;
  currentTime: number;
  duration: number;
  buffered: number;
  volume: number;
  muted: boolean;
  error: string | null;
  quality: 'auto' | 'high' | 'medium' | 'low';
  crossfadeEnabled: boolean;
  equalizerEnabled: boolean;
}

@Injectable({
  providedIn: 'root'
})
export class EnhancedAudioPlayerService implements OnDestroy {
  private audio = new Audio();
  private audioContext: AudioContext | null = null;
  private gainNode: GainNode | null = null;
  private analyserNode: AnalyserNode | null = null;
  private equalizerNodes: BiquadFilterNode[] = [];
  
  private currentBlobUrl: string | null = null;
  private playlist: Music[] = [];
  private currentIndex = -1;
  private crossfadeDuration = 3000; // 3 seconds
  private progressUpdateInterval = 250; // 250ms

  private _currentTrack$ = new BehaviorSubject<Music | null>(null);
  private _audioState$ = new BehaviorSubject<EnhancedAudioState>({
    playing: false,
    loading: false,
    currentTime: 0,
    duration: 0,
    buffered: 0,
    volume: 1,
    muted: false,
    error: null,
    quality: 'auto',
    crossfadeEnabled: false,
    equalizerEnabled: false
  });

  private destroy$ = new Subject<void>();

  currentTrack$ = this._currentTrack$.asObservable();
  audioState$ = this._audioState$.asObservable();

  constructor(private store: Store<AppState>) {
    this.initializeAudioContext();
    this.setupAudioEventListeners();
    this.setupProgressTracking();
    this.setupStoreSubscriptions();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
    this.cleanup();
  }

  private initializeAudioContext(): void {
    try {
      this.audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      this.setupAudioNodes();
    } catch (error) {
      console.warn('Web Audio API not supported:', error);
    }
  }

  private setupAudioNodes(): void {
    if (!this.audioContext) return;

    // Create gain node for volume control
    this.gainNode = this.audioContext.createGain();
    
    // Create analyser for visualizations
    this.analyserNode = this.audioContext.createAnalyser();
    this.analyserNode.fftSize = 256;

    // Create equalizer nodes (10-band)
    const frequencies = [32, 64, 125, 250, 500, 1000, 2000, 4000, 8000, 16000];
    this.equalizerNodes = frequencies.map(freq => {
      const filter = this.audioContext!.createBiquadFilter();
      filter.type = 'peaking';
      filter.frequency.value = freq;
      filter.Q.value = 1;
      filter.gain.value = 0;
      return filter;
    });

    // Connect nodes
    const source = this.audioContext.createMediaElementSource(this.audio);
    let currentNode: AudioNode = source;

    // Chain equalizer nodes
    this.equalizerNodes.forEach(node => {
      currentNode.connect(node);
      currentNode = node;
    });

    // Connect to gain and analyser
    currentNode.connect(this.gainNode);
    currentNode.connect(this.analyserNode);
    this.gainNode.connect(this.audioContext.destination);
  }

  private setupAudioEventListeners(): void {
    this.audio.addEventListener('loadstart', () => this.updateState({ loading: true, error: null }));
    this.audio.addEventListener('canplay', () => this.updateState({ loading: false }));
    this.audio.addEventListener('playing', () => this.updateState({ playing: true, loading: false }));
    this.audio.addEventListener('pause', () => this.updateState({ playing: false }));
    this.audio.addEventListener('ended', () => this.handleTrackEnded());
    this.audio.addEventListener('error', () => this.handleAudioError());
    this.audio.addEventListener('volumechange', () => {
      this.updateState({ 
        volume: this.audio.volume, 
        muted: this.audio.muted 
      });
    });
    this.audio.addEventListener('durationchange', () => {
      this.updateState({ duration: this.audio.duration || 0 });
    });
    this.audio.addEventListener('progress', () => this.updateBufferedProgress());
  }

  private setupProgressTracking(): void {
    interval(this.progressUpdateInterval)
      .pipe(
        takeUntil(this.destroy$),
        filter(() => !this.audio.paused && !this.audio.ended)
      )
      .subscribe(() => {
        const currentTime = this.audio.currentTime;
        this.updateState({ currentTime });
        
        // Update store with progress
        const currentTrack = this._currentTrack$.value;
        if (currentTrack && this.audio.duration) {
          this.store.dispatch(PlayerActions.updateProgress({
            currentTime,
            duration: this.audio.duration
          }));

          // Save progress to user profile
          this.store.dispatch(UserActions.updatePlaybackProgress({
            mediaId: currentTrack.id,
            progress: currentTime,
            duration: this.audio.duration
          }));
        }
      });
  }

  private setupStoreSubscriptions(): void {
    // Subscribe to player actions from store
    this.store.select(state => state.player)
      .pipe(takeUntil(this.destroy$))
      .subscribe(playerState => {
        if (playerState.currentMedia && 'artists' in playerState.currentMedia) {
          const music = playerState.currentMedia as Music;
          if (music.id !== this._currentTrack$.value?.id) {
            this.loadTrack(music);
          }
        }
      });
  }

  async playTrack(track: Music, url: string, index?: number): Promise<void> {
    if (!url?.trim()) {
      this.updateState({ error: 'Invalid track URL' });
      return;
    }

    if (index !== undefined) this.currentIndex = index;

    this.stop(false);
    this._currentTrack$.next(track);
    this.updateState({ loading: true, error: null });

    // Store dispatch
    this.store.dispatch(PlayerActions.playMedia({ 
      media: track, 
      playlist: this.playlist 
    }));

    this.cleanupBlobUrl();
    if (url.startsWith('blob:')) this.currentBlobUrl = url;

    try {
      // Resume audio context if suspended
      if (this.audioContext?.state === 'suspended') {
        await this.audioContext.resume();
      }

      this.audio.src = url;
      this.audio.load();
      await this.audio.play();

      // Add to watch history
      this.store.dispatch(UserActions.addToWatchHistory({ media: track }));
    } catch (err) {
      console.error('Error playing track:', err);
      this.updateState({ 
        loading: false, 
        playing: false, 
        error: 'Failed to play audio' 
      });
    }
  }

  private async loadTrack(track: Music): Promise<void> {
    // Implementation for loading track from various sources
    // This would integrate with your existing music service
  }

  togglePlayPause(): void {
    if (!this.audio.src) {
      if (this.playlist.length > 0) {
        this.playNext(true);
      }
      return;
    }

    if (this._audioState$.value.playing) {
      this.audio.pause();
      this.store.dispatch(PlayerActions.pauseMedia());
    } else {
      this.audio.play().catch(err => {
        console.error('Error resuming playback:', err);
        this.updateState({ 
          loading: false, 
          playing: false, 
          error: 'Failed to resume playback' 
        });
      });
      this.store.dispatch(PlayerActions.resumeMedia());
    }
  }

  stop(clearTrack: boolean = true): void {
    this.audio.pause();
    this.audio.removeAttribute('src');
    this.audio.load();
    
    this.updateState({
      playing: false,
      loading: false,
      currentTime: 0,
      duration: 0,
      error: null
    });

    if (clearTrack) {
      this._currentTrack$.next(null);
    }

    this.store.dispatch(PlayerActions.stopMedia());
  }

  seek(time: number): void {
    if (this.audio.duration && !isNaN(this.audio.duration)) {
      const seekTime = Math.max(0, Math.min(time, this.audio.duration));
      this.audio.currentTime = seekTime;
      this.updateState({ currentTime: seekTime });
      this.store.dispatch(PlayerActions.seekTo({ time: seekTime }));
    }
  }

  setVolume(volume: number): void {
    const newVolume = Math.max(0, Math.min(volume, 1));
    this.audio.volume = newVolume;
    
    if (this.gainNode) {
      this.gainNode.gain.value = newVolume;
    }
    
    this.store.dispatch(PlayerActions.setVolume({ volume: newVolume }));
  }

  toggleMute(): void {
    this.audio.muted = !this.audio.muted;
    this.store.dispatch(PlayerActions.setMuted({ muted: this.audio.muted }));
  }

  playNext(forceFirst = false): void {
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

    this.store.dispatch(PlayerActions.nextTrack());
  }

  playPrevious(): void {
    if (this.currentIndex > 0) {
      this.currentIndex--;
      const prevTrack = this.playlist[this.currentIndex];
      if (prevTrack?.streamUrl) {
        this.playTrack(prevTrack, prevTrack.streamUrl);
      }
    } else {
      this.seek(0);
    }

    this.store.dispatch(PlayerActions.previousTrack());
  }

  // Enhanced features
  setQuality(quality: 'auto' | 'high' | 'medium' | 'low'): void {
    this.updateState({ quality });
    // Implementation would switch to different quality streams
  }

  enableCrossfade(enabled: boolean): void {
    this.updateState({ crossfadeEnabled: enabled });
  }

  setEqualizerBand(bandIndex: number, gain: number): void {
    if (this.equalizerNodes[bandIndex]) {
      this.equalizerNodes[bandIndex].gain.value = gain;
    }
  }

  enableEqualizer(enabled: boolean): void {
    this.updateState({ equalizerEnabled: enabled });
    // Enable/disable equalizer processing
  }

  getFrequencyData(): Uint8Array | null {
    if (!this.analyserNode) return null;
    const dataArray = new Uint8Array(this.analyserNode.frequencyBinCount);
    this.analyserNode.getByteFrequencyData(dataArray);
    return dataArray;
  }

  private handleTrackEnded(): void {
    this.updateState({ playing: false });
    
    const state = this._audioState$.value;
    // Handle repeat modes and auto-play next
    this.playNext();
  }

  private handleAudioError(): void {
    let errorMessage = 'Audio error occurred';
    if (this.audio.error) {
      switch (this.audio.error.code) {
        case MediaError.MEDIA_ERR_ABORTED:
          errorMessage = 'Playback aborted';
          break;
        case MediaError.MEDIA_ERR_NETWORK:
          errorMessage = 'Network error';
          break;
        case MediaError.MEDIA_ERR_DECODE:
          errorMessage = 'Decode error';
          break;
        case MediaError.MEDIA_ERR_SRC_NOT_SUPPORTED:
          errorMessage = 'Source not supported';
          break;
      }
    }
    this.updateState({ 
      loading: false, 
      playing: false, 
      error: errorMessage 
    });
  }

  private updateBufferedProgress(): void {
    if (this.audio.buffered.length > 0 && this.audio.duration) {
      const buffered = this.audio.buffered.end(this.audio.buffered.length - 1) / this.audio.duration;
      this.updateState({ buffered });
    }
  }

  private updateState(partialState: Partial<EnhancedAudioState>): void {
    this._audioState$.next({ ...this._audioState$.value, ...partialState });
  }

  private cleanupBlobUrl(): void {
    if (this.currentBlobUrl) {
      URL.revokeObjectURL(this.currentBlobUrl);
      this.currentBlobUrl = null;
    }
  }

  private cleanup(): void {
    this.stop();
    this.cleanupBlobUrl();
    
    if (this.audioContext) {
      this.audioContext.close();
    }
  }

  // Playlist management
  setPlaylist(tracks: Music[], startIndex: number = -1): void {
    this.playlist = tracks;
    this.currentIndex = startIndex;
    this.store.dispatch(PlayerActions.setPlaylist({ playlist: tracks }));
  }

  addToQueue(track: Music): void {
    this.store.dispatch(PlayerActions.addToQueue({ media: track }));
  }

  removeFromQueue(index: number): void {
    this.store.dispatch(PlayerActions.removeFromQueue({ index }));
  }
}