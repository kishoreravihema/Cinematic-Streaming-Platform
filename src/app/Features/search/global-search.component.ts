import { Component, OnInit, OnDestroy, ViewChild, ElementRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatChipsModule } from '@angular/material/chips';
import { MatMenuModule } from '@angular/material/menu';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatTabsModule } from '@angular/material/tabs';
import { Store } from '@ngrx/store';
import { Observable, Subject, debounceTime, distinctUntilChanged, filter } from 'rxjs';
import { takeUntil } from 'rxjs/operators';

import { AppState } from '../../Core/Store/app.state';
import { Music } from '../../Shared/Models/music.model';
import { Video } from '../../Shared/Models/video.model';
import * as MediaActions from '../../Core/Store/media/media.actions';

interface SearchFilters {
  type: 'all' | 'music' | 'video';
  genre: string[];
  year: { min: number; max: number };
  duration: { min: number; max: number };
  quality: 'all' | 'hd' | 'premium';
  language: string[];
}

@Component({
  selector: 'app-global-search',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatInputModule,
    MatButtonModule,
    MatIconModule,
    MatChipsModule,
    MatMenuModule,
    MatProgressSpinnerModule,
    MatTabsModule
  ],
  template: `
    <div class="global-search">
      <!-- Search Header -->
      <div class="search-header">
        <div class="search-input-container">
          <mat-icon class="search-icon">search</mat-icon>
          <input
            #searchInput
            type="text"
            placeholder="Search for music, videos, artists, albums..."
            [(ngModel)]="searchQuery"
            (input)="onSearchInput($event)"
            (keyup.enter)="performSearch()"
            class="search-input"
            autocomplete="off"
          />
          <button 
            mat-icon-button 
            *ngIf="searchQuery" 
            (click)="clearSearch()"
            class="clear-button"
          >
            <mat-icon>clear</mat-icon>
          </button>
          <button 
            mat-icon-button 
            [matMenuTriggerFor]="filtersMenu"
            class="filters-button"
            [class.active]="hasActiveFilters()"
          >
            <mat-icon>tune</mat-icon>
          </button>
        </div>

        <!-- Search Suggestions -->
        <div class="search-suggestions" *ngIf="showSuggestions && suggestions.length > 0">
          <div 
            class="suggestion-item"
            *ngFor="let suggestion of suggestions"
            (click)="selectSuggestion(suggestion)"
          >
            <mat-icon>{{ suggestion.type === 'music' ? 'music_note' : 'play_circle' }}</mat-icon>
            <span>{{ suggestion.title }}</span>
            <small>{{ suggestion.artist || suggestion.category }}</small>
          </div>
        </div>
      </div>

      <!-- Active Filters -->
      <div class="active-filters" *ngIf="hasActiveFilters()">
        <mat-chip-listbox>
          <mat-chip-option 
            *ngFor="let filter of getActiveFilters()"
            (removed)="removeFilter(filter)"
            removable
          >
            {{ filter.label }}
            <mat-icon matChipRemove>cancel</mat-icon>
          </mat-chip-option>
        </mat-chip-listbox>
        <button mat-button (click)="clearAllFilters()" class="clear-filters">
          Clear All
        </button>
      </div>

      <!-- Search Results -->
      <div class="search-results" *ngIf="searchQuery">
        <!-- Loading State -->
        <div class="loading-container" *ngIf="isLoading">
          <mat-spinner diameter="40"></mat-spinner>
          <p>Searching...</p>
        </div>

        <!-- Results Tabs -->
        <mat-tab-group *ngIf="!isLoading && searchResults.length > 0" class="results-tabs">
          <mat-tab [label]="'All (' + searchResults.length + ')'">
            <div class="results-grid">
              <div 
                class="result-card"
                *ngFor="let result of searchResults"
                (click)="selectResult(result)"
              >
                <div class="result-image">
                  <img 
                    [src]="getResultImage(result)" 
                    [alt]="result.title"
                    (error)="onImageError($event)"
                  />
                  <div class="result-type">
                    <mat-icon>{{ getResultIcon(result) }}</mat-icon>
                  </div>
                </div>
                <div class="result-info">
                  <h3>{{ result.title }}</h3>
                  <p>{{ getResultSubtitle(result) }}</p>
                  <div class="result-meta">
                    <span class="duration">{{ formatDuration(result.durationInSeconds) }}</span>
                    <span class="type">{{ getResultType(result) }}</span>
                  </div>
                </div>
              </div>
            </div>
          </mat-tab>

          <mat-tab [label]="'Music (' + getMusicResults().length + ')'">
            <div class="results-grid">
              <div 
                class="result-card music-card"
                *ngFor="let music of getMusicResults()"
                (click)="selectResult(music)"
              >
                <div class="result-image">
                  <img 
                    [src]="music.thumbnailUrl || 'assets/default-music.png'" 
                    [alt]="music.title"
                  />
                  <div class="play-overlay">
                    <mat-icon>play_arrow</mat-icon>
                  </div>
                </div>
                <div class="result-info">
                  <h3>{{ music.title }}</h3>
                  <p>{{ getArtistNames(music) }}</p>
                  <small>{{ music.album?.title }}</small>
                </div>
              </div>
            </div>
          </mat-tab>

          <mat-tab [label]="'Videos (' + getVideoResults().length + ')'">
            <div class="results-grid">
              <div 
                class="result-card video-card"
                *ngFor="let video of getVideoResults()"
                (click)="selectResult(video)"
              >
                <div class="result-image">
                  <img 
                    [src]="video.thumbnailUrl || 'assets/default-video.jpg'" 
                    [alt]="video.title"
                  />
                  <div class="play-overlay">
                    <mat-icon>play_arrow</mat-icon>
                  </div>
                  <div class="video-duration">
                    {{ formatDuration(video.durationInSeconds) }}
                  </div>
                </div>
                <div class="result-info">
                  <h3>{{ video.title }}</h3>
                  <p>{{ video.genre }}</p>
                  <div class="video-meta">
                    <span class="rating">★ {{ video.rating }}/10</span>
                    <span class="year">{{ getYear(video.releaseDate) }}</span>
                  </div>
                </div>
              </div>
            </div>
          </mat-tab>
        </mat-tab-group>

        <!-- No Results -->
        <div class="no-results" *ngIf="!isLoading && searchResults.length === 0">
          <mat-icon>search_off</mat-icon>
          <h3>No results found</h3>
          <p>Try adjusting your search terms or filters</p>
          <button mat-button (click)="clearAllFilters()" *ngIf="hasActiveFilters()">
            Clear Filters
          </button>
        </div>
      </div>

      <!-- Filters Menu -->
      <mat-menu #filtersMenu="matMenu" class="filters-menu">
        <div class="filters-content" (click)="$event.stopPropagation()">
          <h4>Search Filters</h4>
          
          <!-- Content Type -->
          <div class="filter-group">
            <label>Content Type</label>
            <div class="filter-options">
              <button 
                mat-button 
                [class.active]="filters.type === 'all'"
                (click)="setFilter('type', 'all')"
              >
                All
              </button>
              <button 
                mat-button 
                [class.active]="filters.type === 'music'"
                (click)="setFilter('type', 'music')"
              >
                Music
              </button>
              <button 
                mat-button 
                [class.active]="filters.type === 'video'"
                (click)="setFilter('type', 'video')"
              >
                Videos
              </button>
            </div>
          </div>

          <!-- Genre -->
          <div class="filter-group">
            <label>Genre</label>
            <div class="genre-chips">
              <mat-chip-listbox multiple>
                <mat-chip-option 
                  *ngFor="let genre of availableGenres"
                  [selected]="filters.genre.includes(genre)"
                  (selectionChange)="toggleGenreFilter(genre)"
                >
                  {{ genre }}
                </mat-chip-option>
              </mat-chip-listbox>
            </div>
          </div>

          <!-- Year Range -->
          <div class="filter-group">
            <label>Release Year</label>
            <div class="year-range">
              <input 
                type="number" 
                [(ngModel)]="filters.year.min" 
                placeholder="From"
                min="1900"
                [max]="currentYear"
              />
              <span>to</span>
              <input 
                type="number" 
                [(ngModel)]="filters.year.max" 
                placeholder="To"
                min="1900"
                [max]="currentYear"
              />
            </div>
          </div>

          <!-- Quality -->
          <div class="filter-group">
            <label>Quality</label>
            <div class="filter-options">
              <button 
                mat-button 
                [class.active]="filters.quality === 'all'"
                (click)="setFilter('quality', 'all')"
              >
                All
              </button>
              <button 
                mat-button 
                [class.active]="filters.quality === 'hd'"
                (click)="setFilter('quality', 'hd')"
              >
                HD
              </button>
              <button 
                mat-button 
                [class.active]="filters.quality === 'premium'"
                (click)="setFilter('quality', 'premium')"
              >
                Premium
              </button>
            </div>
          </div>

          <div class="filter-actions">
            <button mat-button (click)="clearAllFilters()">Clear All</button>
            <button mat-raised-button color="primary" (click)="applyFilters()">Apply</button>
          </div>
        </div>
      </mat-menu>
    </div>
  `,
  styleUrls: ['./global-search.component.scss']
})
export class GlobalSearchComponent implements OnInit, OnDestroy {
  @ViewChild('searchInput') searchInput!: ElementRef<HTMLInputElement>;

  searchQuery = '';
  searchResults: (Music | Video)[] = [];
  suggestions: any[] = [];
  showSuggestions = false;
  isLoading = false;

  filters: SearchFilters = {
    type: 'all',
    genre: [],
    year: { min: 1900, max: new Date().getFullYear() },
    duration: { min: 0, max: 7200 },
    quality: 'all',
    language: []
  };

  availableGenres = [
    'Pop', 'Rock', 'Hip Hop', 'Electronic', 'Classical', 'Jazz', 'Country',
    'R&B', 'Reggae', 'Blues', 'Folk', 'Punk', 'Metal', 'Alternative',
    'Action', 'Comedy', 'Drama', 'Horror', 'Sci-Fi', 'Romance', 'Thriller'
  ];

  currentYear = new Date().getFullYear();
  private destroy$ = new Subject<void>();
  private searchSubject = new Subject<string>();

  constructor(private store: Store<AppState>) {}

  ngOnInit(): void {
    this.setupSearchDebounce();
    this.subscribeToSearchResults();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  private setupSearchDebounce(): void {
    this.searchSubject
      .pipe(
        debounceTime(300),
        distinctUntilChanged(),
        filter(query => query.length >= 2),
        takeUntil(this.destroy$)
      )
      .subscribe(query => {
        this.performSearch();
      });
  }

  private subscribeToSearchResults(): void {
    this.store.select(state => state.media)
      .pipe(takeUntil(this.destroy$))
      .subscribe(mediaState => {
        this.searchResults = mediaState.searchResults;
        this.isLoading = mediaState.searchLoading;
      });
  }

  onSearchInput(event: any): void {
    const query = event.target.value;
    this.searchQuery = query;
    
    if (query.length >= 2) {
      this.searchSubject.next(query);
      this.showSuggestions = true;
      // Generate suggestions (mock implementation)
      this.generateSuggestions(query);
    } else {
      this.showSuggestions = false;
      this.suggestions = [];
    }
  }

  private generateSuggestions(query: string): void {
    // Mock suggestions - in real app, this would come from API
    this.suggestions = [
      { title: `${query} songs`, type: 'music', artist: 'Various Artists' },
      { title: `${query} videos`, type: 'video', category: 'Entertainment' },
      { title: `Best of ${query}`, type: 'music', artist: 'Compilation' }
    ].slice(0, 5);
  }

  performSearch(): void {
    if (!this.searchQuery.trim()) return;

    this.showSuggestions = false;
    this.store.dispatch(MediaActions.searchMedia({
      query: this.searchQuery,
      filters: this.filters
    }));
  }

  selectSuggestion(suggestion: any): void {
    this.searchQuery = suggestion.title;
    this.showSuggestions = false;
    this.performSearch();
  }

  selectResult(result: Music | Video): void {
    // Handle result selection - navigate or play
    if ('artists' in result) {
      // It's music
      console.log('Selected music:', result);
    } else {
      // It's video
      console.log('Selected video:', result);
    }
  }

  clearSearch(): void {
    this.searchQuery = '';
    this.searchResults = [];
    this.suggestions = [];
    this.showSuggestions = false;
    this.store.dispatch(MediaActions.clearSearch());
  }

  // Filter methods
  hasActiveFilters(): boolean {
    return this.filters.type !== 'all' ||
           this.filters.genre.length > 0 ||
           this.filters.year.min > 1900 ||
           this.filters.year.max < this.currentYear ||
           this.filters.quality !== 'all' ||
           this.filters.language.length > 0;
  }

  getActiveFilters(): { label: string; key: string; value: any }[] {
    const active = [];
    
    if (this.filters.type !== 'all') {
      active.push({ label: `Type: ${this.filters.type}`, key: 'type', value: 'all' });
    }
    
    this.filters.genre.forEach(genre => {
      active.push({ label: `Genre: ${genre}`, key: 'genre', value: genre });
    });
    
    if (this.filters.year.min > 1900 || this.filters.year.max < this.currentYear) {
      active.push({ 
        label: `Year: ${this.filters.year.min}-${this.filters.year.max}`, 
        key: 'year', 
        value: null 
      });
    }
    
    if (this.filters.quality !== 'all') {
      active.push({ label: `Quality: ${this.filters.quality}`, key: 'quality', value: 'all' });
    }
    
    return active;
  }

  removeFilter(filter: { key: string; value: any }): void {
    switch (filter.key) {
      case 'type':
        this.filters.type = 'all';
        break;
      case 'genre':
        this.filters.genre = this.filters.genre.filter(g => g !== filter.value);
        break;
      case 'year':
        this.filters.year = { min: 1900, max: this.currentYear };
        break;
      case 'quality':
        this.filters.quality = 'all';
        break;
    }
    this.performSearch();
  }

  clearAllFilters(): void {
    this.filters = {
      type: 'all',
      genre: [],
      year: { min: 1900, max: this.currentYear },
      duration: { min: 0, max: 7200 },
      quality: 'all',
      language: []
    };
    this.performSearch();
  }

  setFilter(key: keyof SearchFilters, value: any): void {
    (this.filters as any)[key] = value;
  }

  toggleGenreFilter(genre: string): void {
    const index = this.filters.genre.indexOf(genre);
    if (index > -1) {
      this.filters.genre.splice(index, 1);
    } else {
      this.filters.genre.push(genre);
    }
  }

  applyFilters(): void {
    this.performSearch();
  }

  // Helper methods
  getMusicResults(): Music[] {
    return this.searchResults.filter(result => 'artists' in result) as Music[];
  }

  getVideoResults(): Video[] {
    return this.searchResults.filter(result => !('artists' in result)) as Video[];
  }

  getResultImage(result: Music | Video): string {
    return result.thumbnailUrl || 
           ('artists' in result ? 'assets/default-music.png' : 'assets/default-video.jpg');
  }

  getResultIcon(result: Music | Video): string {
    return 'artists' in result ? 'music_note' : 'play_circle';
  }

  getResultType(result: Music | Video): string {
    return 'artists' in result ? 'Music' : 'Video';
  }

  getResultSubtitle(result: Music | Video): string {
    if ('artists' in result) {
      return this.getArtistNames(result);
    } else {
      return result.genre || 'Video';
    }
  }

  getArtistNames(music: Music): string {
    return music.artists?.map(a => a.name).join(', ') || 'Unknown Artist';
  }

  formatDuration(seconds: number): string {
    if (!seconds) return '0:00';
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
  }

  getYear(date: Date | string): number {
    return new Date(date).getFullYear();
  }

  onImageError(event: any): void {
    event.target.src = 'assets/default-thumbnail.jpg';
  }
}