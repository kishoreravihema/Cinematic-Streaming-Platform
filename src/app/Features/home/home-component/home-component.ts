import { Component, OnInit } from '@angular/core';

import { CommonModule } from '@angular/common';
import { RouterModule, RouterOutlet } from '@angular/router';
import { Music } from '../../../Shared/Models/music.model';
import { Category, Video } from '../../../Shared/Models/video.model';
import { MusicService } from '../../../Core/Services/Music-Service/music-service';
import { VideoService } from '../../../Core/Services/Video-Service/video-service';

@Component({
  selector: 'app-home-component',
  standalone: true,
  imports: [CommonModule, RouterModule, RouterOutlet], // ✅ Add RouterModule
  templateUrl: './home-component.html',
  styleUrls: ['./home-component.scss']
})
export class HomeComponent implements OnInit {

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
  getCategoryName(categoryId: number): string {
  const category = this.category.find(c => c.id === categoryId);
  return category ? category.name : 'Unknown';
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

  switchTab(tab: 'music' | 'video') {
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

  getArtistNames(_music: Music) {
    return _music.artists.map(artist => artist.name).join(', ');
  }
}