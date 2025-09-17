import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatTabsModule } from '@angular/material/tabs';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { Store } from '@ngrx/store';
import { Observable, Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';

import { AppState } from '../../Core/Store/app.state';
import { Music } from '../../Shared/Models/music.model';
import { Video } from '../../Shared/Models/video.model';
import * as MediaActions from '../../Core/Store/media/media.actions';
import * as UserActions from '../../Core/Store/user/user.actions';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [
    CommonModule,
    MatCardModule,
    MatButtonModule,
    MatIconModule,
    MatTabsModule,
    MatProgressBarModule
  ],
  template: `
    <div class="dashboard">
      <!-- Hero Section -->
      <section class="hero-section">
        <div class="hero-content">
          <h1>Welcome back to KStream</h1>
          <p>Discover your next favorite song or movie</p>
          <div class="hero-stats">
            <div class="stat-item">
              <span class="stat-number">{{ (userStats$ | async)?.totalTracks || 0 }}</span>
              <span class="stat-label">Songs Played</span>
            </div>
            <div class="stat-item">
              <span class="stat-number">{{ (userStats$ | async)?.totalVideos || 0 }}</span>
              <span class="stat-label">Videos Watched</span>
            </div>
            <div class="stat-item">
              <span class="stat-number">{{ formatTime((userStats$ | async)?.totalListeningTime || 0) }}</span>
              <span class="stat-label">Hours Streamed</span>
            </div>
          </div>
        </div>
        <div class="hero-visual">
          <div class="floating-cards">
            <div class="card-item" *ngFor="let item of featuredContent.slice(0, 3)">
              <img [src]="item.thumbnailUrl" [alt]="item.title" />
            </div>
          </div>
        </div>
      </section>

      <!-- Quick Actions -->
      <section class="quick-actions">
        <h2>Quick Actions</h2>
        <div class="actions-grid">
          <button mat-raised-button class="action-btn" (click)="resumeLastPlayed()">
            <mat-icon>play_circle</mat-icon>
            <span>Resume Playing</span>
          </button>
          <button mat-raised-button class="action-btn" (click)="shuffleAll()">
            <mat-icon>shuffle</mat-icon>
            <span>Shuffle All</span>
          </button>
          <button mat-raised-button class="action-btn" (click)="discoverNew()">
            <mat-icon>explore</mat-icon>
            <span>Discover</span>
          </button>
          <button mat-raised-button class="action-btn" (click)="viewFavorites()">
            <mat-icon>favorite</mat-icon>
            <span>My Favorites</span>
          </button>
        </div>
      </section>

      <!-- Content Sections -->
      <mat-tab-group class="content-tabs" animationDuration="300ms">
        <!-- Trending -->
        <mat-tab label="🔥 Trending">
          <div class="content-section">
            <div class="section-header">
              <h3>Trending Now</h3>
              <button mat-button (click)="viewAllTrending()">View All</button>
            </div>
            <div class="media-grid">
              <div 
                class="media-card trending-card"
                *ngFor="let item of trendingContent; let i = index"
                (click)="playMedia(item)"
                [class.music]="isMusic(item)"
                [class.video]="!isMusic(item)"
              >
                <div class="card-image">
                  <img [src]="getMediaImage(item)" [alt]="item.title" />
                  <div class="play-overlay">
                    <mat-icon>play_arrow</mat-icon>
                  </div>
                  <div class="trending-badge">#{{ i + 1 }}</div>
                </div>
                <div class="card-content">
                  <h4>{{ item.title }}</h4>
                  <p>{{ getMediaSubtitle(item) }}</p>
                  <div class="card-meta">
                    <span class="type">{{ isMusic(item) ? 'Music' : 'Video' }}</span>
                    <span class="duration">{{ formatDuration(item.durationInSeconds) }}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </mat-tab>

        <!-- Recommendations -->
        <mat-tab label="✨ For You">
          <div class="content-section">
            <div class="section-header">
              <h3>Recommended for You</h3>
              <button mat-button (click)="refreshRecommendations()">Refresh</button>
            </div>
            <div class="media-grid">
              <div 
                class="media-card recommendation-card"
                *ngFor="let item of recommendations"
                (click)="playMedia(item)"
              >
                <div class="card-image">
                  <img [src]="getMediaImage(item)" [alt]="item.title" />
                  <div class="play-overlay">
                    <mat-icon>play_arrow</mat-icon>
                  </div>
                  <div class="recommendation-score">
                    {{ getRecommendationScore(item) }}% Match
                  </div>
                </div>
                <div class="card-content">
                  <h4>{{ item.title }}</h4>
                  <p>{{ getMediaSubtitle(item) }}</p>
                  <div class="recommendation-reason">
                    Because you liked {{ getRecommendationReason(item) }}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </mat-tab>

        <!-- Recently Played -->
        <mat-tab label="🕒 Recent">
          <div class="content-section">
            <div class="section-header">
              <h3>Recently Played</h3>
              <button mat-button (click)="clearHistory()">Clear History</button>
            </div>
            <div class="recent-list">
              <div 
                class="recent-item"
                *ngFor="let item of recentlyPlayed"
                (click)="playMedia(item)"
              >
                <div class="recent-image">
                  <img [src]="getMediaImage(item)" [alt]="item.title" />
                  <div class="play-btn">
                    <mat-icon>play_arrow</mat-icon>
                  </div>
                </div>
                <div class="recent-info">
                  <h4>{{ item.title }}</h4>
                  <p>{{ getMediaSubtitle(item) }}</p>
                  <small>{{ getRelativeTime(item.lastPlayed) }}</small>
                </div>
                <div class="recent-progress">
                  <mat-progress-bar 
                    mode="determinate" 
                    [value]="getPlaybackProgress(item)"
                  ></mat-progress-bar>
                  <span class="progress-text">
                    {{ formatTime(getPlaybackTime(item)) }} / {{ formatDuration(item.durationInSeconds) }}
                  </span>
                </div>
                <button mat-icon-button (click)="removeFromHistory(item, $event)">
                  <mat-icon>close</mat-icon>
                </button>
              </div>
            </div>
          </div>
        </mat-tab>

        <!-- Favorites -->
        <mat-tab label="❤️ Favorites">
          <div class="content-section">
            <div class="section-header">
              <h3>Your Favorites</h3>
              <button mat-button (click)="shuffleFavorites()">Shuffle Play</button>
            </div>
            <div class="media-grid">
              <div 
                class="media-card favorite-card"
                *ngFor="let item of favorites"
                (click)="playMedia(item)"
              >
                <div class="card-image">
                  <img [src]="getMediaImage(item)" [alt]="item.title" />
                  <div class="play-overlay">
                    <mat-icon>play_arrow</mat-icon>
                  </div>
                  <button 
                    mat-icon-button 
                    class="favorite-btn active"
                    (click)="toggleFavorite(item, $event)"
                  >
                    <mat-icon>favorite</mat-icon>
                  </button>
                </div>
                <div class="card-content">
                  <h4>{{ item.title }}</h4>
                  <p>{{ getMediaSubtitle(item) }}</p>
                  <small>Added {{ getRelativeTime(item.favoriteDate) }}</small>
                </div>
              </div>
            </div>
          </div>
        </mat-tab>
      </mat-tab-group>

      <!-- Genre Sections -->
      <section class="genre-sections">
        <div class="genre-section" *ngFor="let genre of topGenres">
          <div class="section-header">
            <h3>{{ genre.name }}</h3>
            <button mat-button (click)="viewGenre(genre)">View All</button>
          </div>
          <div class="horizontal-scroll">
            <div 
              class="media-card-small"
              *ngFor="let item of genre.content"
              (click)="playMedia(item)"
            >
              <img [src]="getMediaImage(item)" [alt]="item.title" />
              <div class="card-overlay">
                <h5>{{ item.title }}</h5>
                <p>{{ getMediaSubtitle(item) }}</p>
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  `,
  styleUrls: ['./dashboard.component.scss']
})
export class DashboardComponent implements OnInit, OnDestroy {
  trendingContent: (Music | Video)[] = [];
  recommendations: (Music | Video)[] = [];
  recentlyPlayed: any[] = [];
  favorites: (Music | Video)[] = [];
  featuredContent: (Music | Video)[] = [];
  topGenres: any[] = [];

  userStats$: Observable<any>;
  
  private destroy$ = new Subject<void>();

  constructor(private store: Store<AppState>) {
    this.userStats$ = this.store.select(state => state.user.profile?.stats);
  }

  ngOnInit(): void {
    this.loadDashboardData();
    this.subscribeToStoreUpdates();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  private loadDashboardData(): void {
    // Load trending content
    this.store.dispatch(MediaActions.loadTrendingMedia());
    
    // Load user-specific data
    this.store.dispatch(UserActions.loadWatchHistory());
    this.store.dispatch(UserActions.loadFavorites());
    
    // Load recommendations (mock data for now)
    this.loadMockData();
  }

  private subscribeToStoreUpdates(): void {
    this.store.select(state => state.media)
      .pipe(takeUntil(this.destroy$))
      .subscribe(mediaState => {
        this.trendingContent = [
          ...mediaState.trendingMusic,
          ...mediaState.trendingVideos
        ].slice(0, 12);
        
        this.recommendations = mediaState.recommendations.slice(0, 8);
      });

    this.store.select(state => state.user)
      .pipe(takeUntil(this.destroy$))
      .subscribe(userState => {
        this.recentlyPlayed = userState.watchHistory.slice(0, 10);
        this.favorites = userState.favorites.slice(0, 12);
      });
  }

  private loadMockData(): void {
    // Mock featured content
    this.featuredContent = [
      // This would come from your API
    ];

    // Mock genre sections
    this.topGenres = [
      { name: 'Pop Hits', content: [] },
      { name: 'Rock Classics', content: [] },
      { name: 'Electronic', content: [] },
      { name: 'Action Movies', content: [] }
    ];
  }

  // Action handlers
  resumeLastPlayed(): void {
    if (this.recentlyPlayed.length > 0) {
      this.playMedia(this.recentlyPlayed[0]);
    }
  }

  shuffleAll(): void {
    // Implement shuffle all functionality
    console.log('Shuffle all media');
  }

  discoverNew(): void {
    // Navigate to discovery page
    console.log('Navigate to discovery');
  }

  viewFavorites(): void {
    // Navigate to favorites page
    console.log('Navigate to favorites');
  }

  playMedia(item: Music | Video): void {
    // Dispatch play action
    console.log('Playing:', item);
  }

  toggleFavorite(item: Music | Video, event: Event): void {
    event.stopPropagation();
    // Toggle favorite status
    console.log('Toggle favorite:', item);
  }

  removeFromHistory(item: any, event: Event): void {
    event.stopPropagation();
    // Remove from history
    console.log('Remove from history:', item);
  }

  // Helper methods
  isMusic(item: any): boolean {
    return 'artists' in item;
  }

  getMediaImage(item: Music | Video): string {
    return item.thumbnailUrl || 
           (this.isMusic(item) ? 'assets/default-music.png' : 'assets/default-video.jpg');
  }

  getMediaSubtitle(item: Music | Video): string {
    if (this.isMusic(item)) {
      const music = item as Music;
      return music.artists?.map(a => a.name).join(', ') || 'Unknown Artist';
    } else {
      const video = item as Video;
      return video.genre || 'Video';
    }
  }

  formatDuration(seconds: number): string {
    if (!seconds) return '0:00';
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
  }

  formatTime(minutes: number): string {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return hours > 0 ? `${hours}h ${mins}m` : `${mins}m`;
  }

  getRelativeTime(date: Date | string): string {
    const now = new Date();
    const past = new Date(date);
    const diffMs = now.getTime() - past.getTime();
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffHours / 24);

    if (diffHours < 1) return 'Just now';
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return past.toLocaleDateString();
  }

  getPlaybackProgress(item: any): number {
    // Return progress percentage (0-100)
    return (item.currentTime / item.durationInSeconds) * 100 || 0;
  }

  getPlaybackTime(item: any): number {
    // Return current playback time in minutes
    return Math.floor((item.currentTime || 0) / 60);
  }

  getRecommendationScore(item: any): number {
    // Mock recommendation score
    return Math.floor(Math.random() * 30) + 70; // 70-100%
  }

  getRecommendationReason(item: any): string {
    // Mock recommendation reason
    const reasons = ['similar artists', 'your recent activity', 'trending now', 'your favorites'];
    return reasons[Math.floor(Math.random() * reasons.length)];
  }

  // Navigation methods
  viewAllTrending(): void {
    console.log('Navigate to trending');
  }

  refreshRecommendations(): void {
    console.log('Refresh recommendations');
  }

  clearHistory(): void {
    console.log('Clear history');
  }

  shuffleFavorites(): void {
    console.log('Shuffle favorites');
  }

  viewGenre(genre: any): void {
    console.log('View genre:', genre);
  }
}