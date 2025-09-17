import { Component, OnInit, OnDestroy, ViewChild, ElementRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatSliderModule } from '@angular/material/slider';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatMenuModule } from '@angular/material/menu';
import { MatTooltipModule } from '@angular/material/tooltip';
import { Store } from '@ngrx/store';
import { Observable, Subject, interval } from 'rxjs';
import { takeUntil, filter } from 'rxjs/operators';

import { AppState } from '../../Core/Store/app.state';
import { EnhancedAudioPlayerService, EnhancedAudioState } from '../../Core/Services/Enhanced-Audio-Player/enhanced-audio-player.service';
import { Music } from '../../Shared/Models/music.model';
import * as PlayerActions from '../../Core/Store/player/player.actions';

@Component({
  selector: 'app-enhanced-player',
  standalone: true,
  imports: [
    CommonModule,
    MatSliderModule,
    MatButtonModule,
    MatIconModule,
    MatMenuModule,
    MatTooltipModule
  ],
  template: `
    <div class="enhanced-player" [class.expanded]="isExpanded">
      <!-- Mini Player Bar -->
      <div class="mini-player" *ngIf="!isExpanded && (currentTrack$ | async)">
        <div class="track-info">
          <img 
            [src]="(currentTrack$ | async)?.thumbnailUrl || 'assets/default-music.png'" 
            alt="Album art"
            class="album-art-mini"
          />
          <div class="track-details">
            <div class="track-title">{{ (currentTrack$ | async)?.title }}</div>
            <div class="track-artist">{{ getArtistNames(currentTrack$ | async) }}</div>
          </div>
        </div>

        <div class="mini-controls">
          <button mat-icon-button (click)="previousTrack()" matTooltip="Previous">
            <mat-icon>skip_previous</mat-icon>
          </button>
          <button mat-icon-button (click)="togglePlayPause()" class="play-pause-btn">
            <mat-icon>{{ (audioState$ | async)?.playing ? 'pause' : 'play_arrow' }}</mat-icon>
          </button>
          <button mat-icon-button (click)="nextTrack()" matTooltip="Next">
            <mat-icon>skip_next</mat-icon>
          </button>
        </div>

        <div class="mini-progress">
          <mat-slider
            [value]="(audioState$ | async)?.currentTime || 0"
            [max]="(audioState$ | async)?.duration || 0"
            (input)="onSeek($event)"
            class="progress-slider"
          ></mat-slider>
        </div>

        <div class="mini-actions">
          <button mat-icon-button (click)="toggleExpanded()" matTooltip="Expand Player">
            <mat-icon>keyboard_arrow_up</mat-icon>
          </button>
        </div>
      </div>

      <!-- Expanded Player -->
      <div class="expanded-player" *ngIf="isExpanded">
        <div class="player-header">
          <button mat-icon-button (click)="toggleExpanded()" matTooltip="Minimize">
            <mat-icon>keyboard_arrow_down</mat-icon>
          </button>
          <h2>Now Playing</h2>
          <div class="header-actions">
            <button mat-icon-button [matMenuTriggerFor]="qualityMenu" matTooltip="Quality">
              <mat-icon>high_quality</mat-icon>
            </button>
            <button mat-icon-button (click)="toggleEqualizer()" matTooltip="Equalizer">
              <mat-icon>equalizer</mat-icon>
            </button>
          </div>
        </div>

        <div class="player-content">
          <!-- Album Art & Visualizer -->
          <div class="album-section">
            <div class="album-art-container">
              <img 
                [src]="(currentTrack$ | async)?.thumbnailUrl || 'assets/default-music.png'" 
                alt="Album art"
                class="album-art-large"
              />
              <canvas 
                #visualizerCanvas 
                class="visualizer" 
                [class.active]="showVisualizer"
                width="300" 
                height="150"
              ></canvas>
            </div>
            
            <div class="track-info-expanded">
              <h3 class="track-title-large">{{ (currentTrack$ | async)?.title }}</h3>
              <p class="track-artist-large">{{ getArtistNames(currentTrack$ | async) }}</p>
              <p class="track-album">{{ (currentTrack$ | async)?.album?.title }}</p>
            </div>
          </div>

          <!-- Controls Section -->
          <div class="controls-section">
            <!-- Progress Bar -->
            <div class="progress-section">
              <span class="time-current">{{ formatTime((audioState$ | async)?.currentTime || 0) }}</span>
              <mat-slider
                [value]="(audioState$ | async)?.currentTime || 0"
                [max]="(audioState$ | async)?.duration || 0"
                (input)="onSeek($event)"
                class="progress-slider-large"
              ></mat-slider>
              <span class="time-total">{{ formatTime((audioState$ | async)?.duration || 0) }}</span>
            </div>

            <!-- Main Controls -->
            <div class="main-controls">
              <button mat-icon-button (click)="toggleShuffle()" 
                      [class.active]="isShuffled"
                      matTooltip="Shuffle">
                <mat-icon>shuffle</mat-icon>
              </button>
              
              <button mat-icon-button (click)="previousTrack()" matTooltip="Previous">
                <mat-icon>skip_previous</mat-icon>
              </button>
              
              <button mat-fab 
                      (click)="togglePlayPause()" 
                      class="play-pause-fab"
                      [disabled]="(audioState$ | async)?.loading">
                <mat-icon *ngIf="!(audioState$ | async)?.loading">
                  {{ (audioState$ | async)?.playing ? 'pause' : 'play_arrow' }}
                </mat-icon>
                <mat-icon *ngIf="(audioState$ | async)?.loading" class="loading-icon">
                  hourglass_empty
                </mat-icon>
              </button>
              
              <button mat-icon-button (click)="nextTrack()" matTooltip="Next">
                <mat-icon>skip_next</mat-icon>
              </button>
              
              <button mat-icon-button (click)="toggleRepeat()" 
                      [class.active]="repeatMode !== 'none'"
                      matTooltip="Repeat">
                <mat-icon>{{ getRepeatIcon() }}</mat-icon>
              </button>
            </div>

            <!-- Volume Controls -->
            <div class="volume-section">
              <button mat-icon-button (click)="toggleMute()" matTooltip="Mute">
                <mat-icon>{{ getVolumeIcon() }}</mat-icon>
              </button>
              <mat-slider
                [value]="(audioState$ | async)?.volume || 0"
                [max]="1"
                [step]="0.01"
                (input)="onVolumeChange($event)"
                class="volume-slider"
              ></mat-slider>
            </div>
          </div>

          <!-- Equalizer -->
          <div class="equalizer-section" *ngIf="showEqualizer">
            <h4>Equalizer</h4>
            <div class="eq-bands">
              <div class="eq-band" *ngFor="let band of equalizerBands; let i = index">
                <mat-slider
                  [value]="band.gain"
                  [min]="-12"
                  [max]="12"
                  [step]="0.5"
                  (input)="onEqualizerChange(i, $event)"
                  vertical
                  class="eq-slider"
                ></mat-slider>
                <label>{{ band.frequency }}Hz</label>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Quality Menu -->
      <mat-menu #qualityMenu="matMenu">
        <button mat-menu-item (click)="setQuality('auto')">
          <mat-icon>auto_awesome</mat-icon>
          Auto
        </button>
        <button mat-menu-item (click)="setQuality('high')">
          <mat-icon>high_quality</mat-icon>
          High (320kbps)
        </button>
        <button mat-menu-item (click)="setQuality('medium')">
          <mat-icon>standard_quality</mat-icon>
          Medium (192kbps)
        </button>
        <button mat-menu-item (click)="setQuality('low')">
          <mat-icon>low_quality</mat-icon>
          Low (128kbps)
        </button>
      </mat-menu>
    </div>
  `,
  styleUrls: ['./enhanced-player.component.scss']
})
export class EnhancedPlayerComponent implements OnInit, OnDestroy {
  @ViewChild('visualizerCanvas', { static: false }) visualizerCanvas!: ElementRef<HTMLCanvasElement>;

  currentTrack$: Observable<Music | null>;
  audioState$: Observable<EnhancedAudioState>;
  
  isExpanded = false;
  showVisualizer = false;
  showEqualizer = false;
  isShuffled = false;
  repeatMode: 'none' | 'one' | 'all' = 'none';

  equalizerBands = [
    { frequency: 32, gain: 0 },
    { frequency: 64, gain: 0 },
    { frequency: 125, gain: 0 },
    { frequency: 250, gain: 0 },
    { frequency: 500, gain: 0 },
    { frequency: 1000, gain: 0 },
    { frequency: 2000, gain: 0 },
    { frequency: 4000, gain: 0 },
    { frequency: 8000, gain: 0 },
    { frequency: 16000, gain: 0 }
  ];

  private destroy$ = new Subject<void>();
  private animationId: number | null = null;

  constructor(
    private store: Store<AppState>,
    private audioPlayerService: EnhancedAudioPlayerService
  ) {
    this.currentTrack$ = this.audioPlayerService.currentTrack$;
    this.audioState$ = this.audioPlayerService.audioState$;
  }

  ngOnInit(): void {
    this.setupVisualizerAnimation();
    this.subscribeToPlayerState();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
    
    if (this.animationId) {
      cancelAnimationFrame(this.animationId);
    }
  }

  private setupVisualizerAnimation(): void {
    const animate = () => {
      if (this.showVisualizer && this.visualizerCanvas) {
        this.drawVisualizer();
      }
      this.animationId = requestAnimationFrame(animate);
    };
    animate();
  }

  private subscribeToPlayerState(): void {
    this.store.select(state => state.player)
      .pipe(takeUntil(this.destroy$))
      .subscribe(playerState => {
        this.isShuffled = playerState.isShuffled;
        this.repeatMode = playerState.repeatMode;
      });
  }

  private drawVisualizer(): void {
    const canvas = this.visualizerCanvas.nativeElement;
    const ctx = canvas.getContext('2d');
    const frequencyData = this.audioPlayerService.getFrequencyData();
    
    if (!ctx || !frequencyData) return;

    const width = canvas.width;
    const height = canvas.height;
    const barWidth = width / frequencyData.length;

    ctx.clearRect(0, 0, width, height);
    
    // Create gradient
    const gradient = ctx.createLinearGradient(0, height, 0, 0);
    gradient.addColorStop(0, '#00D4FF');
    gradient.addColorStop(0.5, '#39FF14');
    gradient.addColorStop(1, '#FF6B6B');
    
    ctx.fillStyle = gradient;

    for (let i = 0; i < frequencyData.length; i++) {
      const barHeight = (frequencyData[i] / 255) * height;
      const x = i * barWidth;
      const y = height - barHeight;
      
      ctx.fillRect(x, y, barWidth - 1, barHeight);
    }
  }

  toggleExpanded(): void {
    this.isExpanded = !this.isExpanded;
  }

  togglePlayPause(): void {
    this.audioPlayerService.togglePlayPause();
  }

  nextTrack(): void {
    this.audioPlayerService.playNext();
  }

  previousTrack(): void {
    this.audioPlayerService.playPrevious();
  }

  onSeek(event: any): void {
    const time = event.value || event.target.value;
    this.audioPlayerService.seek(time);
  }

  onVolumeChange(event: any): void {
    const volume = event.value || event.target.value;
    this.audioPlayerService.setVolume(volume);
  }

  toggleMute(): void {
    this.audioPlayerService.toggleMute();
  }

  toggleShuffle(): void {
    this.store.dispatch(PlayerActions.setShuffle({ shuffle: !this.isShuffled }));
  }

  toggleRepeat(): void {
    const modes: ('none' | 'one' | 'all')[] = ['none', 'one', 'all'];
    const currentIndex = modes.indexOf(this.repeatMode);
    const nextMode = modes[(currentIndex + 1) % modes.length];
    this.store.dispatch(PlayerActions.setRepeatMode({ mode: nextMode }));
  }

  toggleEqualizer(): void {
    this.showEqualizer = !this.showEqualizer;
    this.audioPlayerService.enableEqualizer(this.showEqualizer);
  }

  onEqualizerChange(bandIndex: number, event: any): void {
    const gain = event.value || event.target.value;
    this.equalizerBands[bandIndex].gain = gain;
    this.audioPlayerService.setEqualizerBand(bandIndex, gain);
  }

  setQuality(quality: 'auto' | 'high' | 'medium' | 'low'): void {
    this.audioPlayerService.setQuality(quality);
  }

  getArtistNames(track: Music | null): string {
    return track?.artists?.map(a => a.name).join(', ') || 'Unknown Artist';
  }

  formatTime(seconds: number): string {
    if (isNaN(seconds) || !isFinite(seconds)) return '0:00';
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = Math.floor(seconds % 60);
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
  }

  getVolumeIcon(): string {
    const state = this.audioState$.value;
    if (state?.muted || (state?.volume || 0) === 0) return 'volume_off';
    if ((state?.volume || 0) < 0.5) return 'volume_down';
    return 'volume_up';
  }

  getRepeatIcon(): string {
    switch (this.repeatMode) {
      case 'one': return 'repeat_one';
      case 'all': return 'repeat';
      default: return 'repeat';
    }
  }
}