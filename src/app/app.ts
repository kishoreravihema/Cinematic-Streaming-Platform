import { CommonModule } from '@angular/common';
import { Component, OnInit, signal } from '@angular/core';
import { RouterModule } from '@angular/router';
import { Music } from './Shared/Models/music.model';
import { Category, Video } from './Shared/Models/video.model';
import { MusicService } from './Core/Services/Music-Service/music-service';
import { VideoService } from './Core/Services/Video-Service/video-service';
import { EnhancedPlayerComponent } from './Features/enhanced-player/enhanced-player.component';


@Component({
  selector: 'app-root',
    standalone: true,
  // Import the directives used in the template
  imports: [RouterModule, CommonModule, EnhancedPlayerComponent],
  templateUrl: './app.html',
 styleUrls: ['./app.scss']
})
export class App implements OnInit {

  musicList: Music[] = [];
  videoList: Video[] = [];
  category: Category[] = [];
  activeTab: 'music' | 'video' = 'music';

  musicPage = 1;
  videoPage = 1;
  pageSize = 10;

  constructor(
    private musicService: MusicService,
    private videoService: VideoService
  ) {}

  ngOnInit(): void {
    this.loadMusic();
    this.loadVideos();
  }

  loadMusic(): void {
    this.musicService.getMusic(this.musicPage, this.pageSize).subscribe(data => {
      this.musicList = data;
    });
  }

  loadVideos(): void {
    this.videoService.getAllVideos(this.videoPage, this.pageSize).subscribe(res => {
      this.videoList = res.data;
    });
  }

  getCategoryName(categoryId: number): string {
    const category = this.category.find(c => c.id === categoryId);
    return category ? category.name : 'Unknown';
  }

  getArtistNames(music: Music): string {
    return music.artists.map(a => a.name).join(', ');
  }

  switchTab(tab: 'music' | 'video'): void {
    this.activeTab = tab;
  }

  nextPage(): void {
    if (this.activeTab === 'music') {
      this.musicPage++;
      this.loadMusic();
    } else {
      this.videoPage++;
      this.loadVideos();
    }
  }

  prevPage(): void {
    if (this.activeTab === 'music' && this.musicPage > 1) {
      this.musicPage--;
      this.loadMusic();
    } else if (this.activeTab === 'video' && this.videoPage > 1) {
      this.videoPage--;
      this.loadVideos();
    }
  }
}
