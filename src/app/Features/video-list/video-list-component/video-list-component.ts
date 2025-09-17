// video-list-Component.ts
import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { Playlist, Video } from '../../../Shared/Models/video.model';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { BaseResponse } from '../../../Shared/Models/BaseResponse';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { VideoService } from '../../../Core/Services/Video-Service/video-service';
@Component({
  selector: 'app-video-list-component',
  imports: [CommonModule, FormsModule],
  standalone: true,
  templateUrl: './video-list-component.html',
  styleUrls: ['./video-list-component.scss']
})
export class VideoListComponent implements OnInit {
  videoList: Video[] = [];
  playlists: Playlist[] = [];
  selectedPlaylistId?: number;
  selectedPlaylistUrl?: string;
  selectedCategory?: string;
  videoPage = 1;
  pageSize = 10;
  errorMessage?: string;
  isLoading = false;

  constructor(
    private videoService: VideoService,
    private router: Router,
    private sanitizer: DomSanitizer
  ) {}

  ngOnInit(): void {
    this.loadVideoPage(1);
    this.loadPlaylists();
  }

  loadVideoPage(page: number): void {
    this.isLoading = true;
    this.errorMessage = undefined;
    this.videoService.getAllVideos(page, this.pageSize).subscribe({
      next: (res: BaseResponse<Video[]>) => {
        this.isLoading = false;
        if (res.success && res.data) {
          this.videoList = res.data;
          this.videoPage = page;
        } else {
          this.videoList=[];
          this.errorMessage = res.message || 'Failed to load videos.';
        }
      },
      error: (err) => {
        this.isLoading = false;
        console.error('Error loading videos:', err);
        this.errorMessage = 'Error loading video list. Please try again later.';
        this.videoList=[];
      }
    });
  }

  loadPlaylists(): void {
    this.errorMessage = undefined;
    this.videoService.getPlaylists().subscribe({
      next: (res: BaseResponse<Playlist[]>) => {
        if (res.success && res.data) {
          this.playlists = res.data.filter(p => p.isPublic);
        } else {
          this.playlists=[];
          this.errorMessage = res.message || 'Failed to load playlists.';
        }
      },
      error: (err) => {
        console.error('Error loading playlists:', err);
        this.playlists=[];
        this.errorMessage = 'Error loading playlists.Please try again later.';
      }
    });
  }

  selectPlaylist(input: number | Playlist): void {
    this.isLoading=true;
    this.errorMessage=undefined;
    this.selectedCategory=undefined;
    this.selectedPlaylistUrl=undefined;
    const playlist =
      typeof input === 'number'
        ? this.playlists.find(p => p.id === +input)
        : input;

    if (!playlist) {
      this.isLoading=false;
      this.errorMessage = 'Selected playlist not found.';
      this.videoList=[];
      return;
    }

    this.selectedPlaylistId = playlist.id;
    this.selectedPlaylistUrl = undefined;

    this.videoService.getVideosByPlaylistId(playlist.id).subscribe({
      next: (res: BaseResponse<Video[]>) => {
        this.isLoading=false;
          if (res.success && res.data) {
          this.videoList = res.data;
          this.extractYouTubePlaylistUrl(res.data);
        } else {
          this.videoList=[];
          this.errorMessage = res.message || 'Failed to load playlist videos.';
        }
      },
      error: (err) => {
        this.isLoading=false;
        this.videoList=[];
        console.error('Error loading playlist videos:', err);
        this.errorMessage = 'Error loading playlist videos.';
      }
    });
  }

  filterByCategory(category: string): void {
    this.isLoading=true;
    this.errorMessage=undefined;
    this.selectedPlaylistId=undefined;
    this.selectedPlaylistUrl=undefined;
    this.selectedCategory = category;
    this.videoService.getVideosByCategory(category).subscribe({
      next: (res: BaseResponse<Video[]>) => {
        this.isLoading=false;
        if (res.success && res.data) {
          this.videoList = res.data;
          this.extractYouTubePlaylistUrl(res.data);
        } else {
          this.videoList=[];
          this.errorMessage = res.message || 'No videos found for this category.';
        }
      },
      error: (err) => {
        this.isLoading=false;
        this.videoList=[];
        console.error('Error filtering by category:', err);
        this.errorMessage = 'Error loading category videos.';
      }
    });
  }

  extractYouTubePlaylistUrl(videos: Video[]): void {
    const youtubeVideo = videos.find(v =>
      v.url?.includes('youtube.com') && v.url?.includes('list=')
    );

    if (youtubeVideo && youtubeVideo.url) {
      const match = youtubeVideo.url.match(/list=([a-zA-Z0-9_-]+)/);
      const playlistId = match ? match[1] : null;

      if (playlistId) {
        this.selectedPlaylistUrl = `https://www.youtube.com/embed/videoseries?list=${playlistId}`;
      }
      else{
        this.selectedPlaylistUrl=undefined;
      }
    }
  }

  onPlaylistChange(event: Event): void {
    const target = event.target as HTMLSelectElement;
    const selectedId = +target.value;
    if (selectedId === 0) { // ✨ Handle "All Videos" or default option
      this.loadVideoPage(1);
      this.selectedPlaylistId = undefined;
      this.selectedCategory = undefined;
      this.selectedPlaylistUrl = undefined;
      return;
    }
    const selectedPlaylist = this.playlists.find(p => p.id === selectedId);
    if (selectedPlaylist) {
      this.selectPlaylist(selectedPlaylist);
    } else {
      this.errorMessage = 'Selected playlist not found.';
      this.videoList=[];
    }
  }

  openVideo(id: number): void {
    this.router.navigate(['/watch', id]);
  }

  async checkThumbnailExists(url?: string): Promise<boolean> {
    if (!url) return false;
    try {
      const res = await fetch(url, { method: 'HEAD' });
      return res.ok;
    } catch {
      return false;
    }
  }

onThumbnailError(event: Event): void {
  const img = event.target as HTMLImageElement;
  if (!img.src.includes('DefaultVideoImage.png')) {
    img.src = 'assets/DefaultVideoImage.png';
  }
}


  getSafeUrl(url: string): SafeResourceUrl {
    return this.sanitizer.bypassSecurityTrustResourceUrl(url);
  }

  prevPage(): void {
    if (this.videoPage > 1) {
      this.loadVideoPage(this.videoPage - 1);
    }
  }

  nextPage(): void {
    this.loadVideoPage(this.videoPage + 1);
  }
  trackByVideoId(index: number, video: Video):number{
    return video.id;
  }
  trackByPlaylistId(index:number,playlist:Playlist):number{
    return playlist.id;
  }
}

// export class VideoListComponent implements OnInit {
//   videoList: Video[] = [];
//   playlists: Playlist[] = [];
//   selectedPlaylistId?: number;
//   selectedPlaylistUrl?: string;
//   videoPage = 1;
//   pageSize = 10;
//   errorMessage?: string;

//   constructor(
//     private videoService: VideoService,
//     private router: Router,
//     private sanitizer: DomSanitizer
//   ) {}

//   ngOnInit(): void {
//     this.loadVideoPage(1);
//     this.loadPlaylists();
//   }

//   loadVideoPage(page: number): void {
//     this.videoService.getAllVideos(page, this.pageSize).subscribe({
//       next: (res: BaseResponse<Video[]>) => {
//         if (res.success && res.data) {
//           this.videoList = res.data;
//           this.videoPage = page;
//         } else {
//           this.errorMessage = res.message || 'Failed to load videos.';
//         }
//       },
//       error: (err) => {
//         console.error('Error loading videos:', err);
//         this.errorMessage = 'Error loading video list.';
//       }
//     });
//   }

//   loadPlaylists(): void {
//     this.videoService.getPlaylists().subscribe({
//       next: (res: BaseResponse<Playlist[]>) => {
//         if (res.success && res.data) {
//           this.playlists = res.data.filter(p => p.isPublic);
//         } else {
//           this.errorMessage = res.message || 'Failed to load playlists.';
//         }
//       },
//       error: (err) => {
//         console.error('Error loading playlists:', err);
//         this.errorMessage = 'Error loading playlists.';
//       }
//     });
//   }

// selectPlaylist(input: number | Playlist): void {
//   const playlist =
//     typeof input === 'number'
//       ? this.playlists.find(p => p.id === +input)
//       : input;

//   if (!playlist) {
//     this.errorMessage = 'Selected playlist not found.';
//     return;
//   }

//   this.selectedPlaylistId = playlist.id;
//   this.selectedPlaylistUrl = undefined;

//   this.videoService.getVideosByPlaylistId(playlist.id).subscribe({
//     next: (res: BaseResponse<Video[]>) => {
//       if (res.success && res.data) {
//         this.videoList = res.data;

//         const youtubeVideo = res.data.find(v =>
//           v.url?.includes('youtube.com') && v.url?.includes('list=')
//         );

//         if (youtubeVideo) {
//           const match = youtubeVideo.url.match(/list=([a-zA-Z0-9_-]+)/);
//           const playlistId = match ? match[1] : null;

//           if (playlistId) {
//             this.selectedPlaylistUrl = `https://www.youtube.com/embed/videoseries?list=${playlistId}`;
//           }
//         }
//       } else {
//         this.errorMessage = res.message || 'Failed to load playlist videos.';
//       }
//     },
//     error: (err) => {
//       console.error('Error loading playlist videos:', err);
//       this.errorMessage = 'Error loading playlist videos.';
//     }
//   });
// }

// onPlaylistChange(event: Event): void {
//   const target = event.target as HTMLSelectElement;
//   const selectedId = +target.value;

//   const selectedPlaylist = this.playlists.find(p => p.id === selectedId);
//   if (selectedPlaylist) {
//     this.selectPlaylist(selectedPlaylist);
//   } else {
//     this.errorMessage = 'Selected playlist not found.';
//   }
// }



//   openVideo(id: number): void {
//     this.router.navigate(['/watch', id]);
//   }

//   async checkThumbnailExists(url?: string): Promise<boolean> {
//     if (!url) return false;
//     try {
//       const res = await fetch(url, { method: 'HEAD' });
//       return res.ok;
//     } catch {
//       return false;
//     }
//   }

//   onThumbnailError(event: Event): void {
//     const img = event.target as HTMLImageElement;
//     img.src = 'assets/default-thumbnail.jpg';
//   }

//   getSafeUrl(url: string): SafeResourceUrl {
//     return this.sanitizer.bypassSecurityTrustResourceUrl(url);
//   }

//   prevPage(): void {
//     if (this.videoPage > 1) {
//       this.loadVideoPage(this.videoPage - 1);
//     }
//   }

//   nextPage(): void {
//     this.loadVideoPage(this.videoPage + 1);
//   }
// }


