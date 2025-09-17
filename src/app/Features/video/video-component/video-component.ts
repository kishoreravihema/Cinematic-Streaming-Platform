//video-component.ts
import { Component, OnInit, Inject, AfterViewInit, OnDestroy, ViewChild, ElementRef } from '@angular/core';
import { PlayerConfig } from '../../../Shared/Models/player.dto';
import { CommonModule } from '@angular/common';
import { Video } from '../../../Shared/Models/video.model';
import { VideoService } from '../../../Core/Services/Video-Service/video-service';
import { BaseResponse } from '../../../Shared/Models/BaseResponse';
import { PlayInfo } from '../../../Shared/Models/playInfo.model';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { environment } from '../../../../environments/environment';
import { ActivatedRoute, RouterModule } from '@angular/router';
import { resolveStreamUrl, resolveThumbnailUrl } from '../../../Shared/Utilities/api-url.util';
import Hls, { HlsConfig } from 'hls.js';
@Component({
  selector: 'app-video-component',
  standalone: true, 
  imports: [CommonModule,RouterModule],
  templateUrl: './video-component.html',
  styleUrls: ['./video-component.scss']
})

export class VideoPlayerComponent implements OnInit, AfterViewInit, OnDestroy {
  @ViewChild('videoPlayer', { static: false }) videoPlayerRef!: ElementRef<HTMLVideoElement>;

  playbackInfo?: PlayInfo;
  safeUrl?: SafeResourceUrl;
  thumbnailUrl?: string;
  errorMessage?: string;
  embedType?: 'VIDEO' | 'PLAYLIST' | 'CHANNEL_PLAYLISTS' | 'REMOTE' | 'LOCAL';
  isLoading = true;

  availableAudioTracks: { label: string; lang: string }[] = [];
  selectedAudioTrack: string = 'default';

  private hlsInstance?: Hls;
  private videoId?: number;
  private maxHlsRetries = 2;
  private hlsRetryCount = 0;

  constructor(
    private route: ActivatedRoute,
    private videoService: VideoService,
    private sanitizer: DomSanitizer
  ) {}

  ngOnInit(): void {
    this.videoId = Number(this.route.snapshot.paramMap.get('id'));
    if (!this.videoId || isNaN(this.videoId)) {
      this.errorMessage = 'Invalid video ID';
      this.isLoading = false;
      return;
    }
  }

  ngAfterViewInit(): void {
    if (this.videoId) {
      this.loadVideoPlaybackInfo(this.videoId);
    }
  }

  ngOnDestroy(): void {
    this.cleanupHls();
  }

  private cleanupHls(): void {
    if (this.hlsInstance) {
      try { this.hlsInstance.destroy(); } catch (e) { console.warn('Error destroying Hls instance', e); }
      this.hlsInstance = undefined;
    }
  }

  private loadVideoPlaybackInfo(id: number): void {
    this.isLoading = true;
    this.errorMessage = undefined;

    this.videoService.getPlaybackInfo(id).subscribe({
      next: async (res: BaseResponse<PlayInfo>) => {
        this.isLoading = false;
        if (!res.success || !res.data) {
          this.errorMessage = res.message || 'Failed to load video.';
          return;
        }

        this.playbackInfo = res.data;
        this.cleanupHls();

        if (res.data.playbackType === 'LOCAL_STREAM') {
          this.embedType = 'LOCAL';

          const candidatesRaw: (string | undefined)[] = [
            res.data.url,
            this.videoService.getStreamOLdUrl(id),
            this.videoService.getHlsStreamUrl(id),
            (this.videoService as any).getHlsPlaylistUrl?.(id),
            this.videoService.getStreamNewUrl(id)
          ];

          let resolvedStreamUrl: string | undefined;

          for (const raw of candidatesRaw) {
            if (!raw) continue;
            const normalized = this.normalizeUrl(raw);
            console.log('Trying candidate stream URL:', normalized);

            try {
              if (normalized.toLowerCase().endsWith('.m3u8') && Hls.isSupported()) {
                const ok = await this.tryLoadHls(normalized);
                if (ok) {
                  resolvedStreamUrl = normalized;
                  break;
                }
              } else {
                // Fallback: treat as direct file or probe playlist text
                this.safeUrl = this.sanitizer.bypassSecurityTrustResourceUrl(normalized);
                this.embedType = 'REMOTE';
                resolvedStreamUrl = normalized;
                break;
              }
            } catch (err) {
              console.warn('Candidate failed, trying next', normalized, err);
            }
          }

          this.thumbnailUrl = res.data.thumbnailUrl ? this.resolveThumbnail(res.data.thumbnailUrl) : resolveThumbnailUrl(id);

          if (!resolvedStreamUrl) this.errorMessage = 'Stream URL could not be resolved.';
          return;
        }

        // REMOTE_URL
        if (res.data.playbackType === 'REMOTE_URL') {
          this.embedType = 'REMOTE';
          if (res.data.url) this.safeUrl = this.sanitizer.bypassSecurityTrustResourceUrl(res.data.url);
          else this.errorMessage = 'Remote URL not provided.';
          this.thumbnailUrl = res.data.thumbnailUrl ? `${environment.apiBaseUrl}${res.data.thumbnailUrl}` : 'assets/DefaultVideoImage.jpg';
          return;
        }

        // YouTube / playlist handling
        const { type, id: ytId } = this.extractYouTubeIdOrPlaylist(res.data.url || '');
        this.embedType = type;

        if (type === 'VIDEO' && ytId) {
          this.safeUrl = this.sanitizer.bypassSecurityTrustResourceUrl(`https://www.youtube.com/embed/${ytId}?autoplay=1`);
          this.thumbnailUrl = await this.pickYouTubeThumbnail(ytId);
        } else if (type === 'PLAYLIST' && ytId) {
          this.safeUrl = this.sanitizer.bypassSecurityTrustResourceUrl(`https://www.youtube.com/embed/videoseries?list=${ytId}&autoplay=1`);
          this.thumbnailUrl = 'assets/DefaultVideoImage.jpg';
        } else if (type === 'CHANNEL_PLAYLISTS') {
          this.safeUrl = undefined;
          this.thumbnailUrl = 'assets/DefaultVideoImage.jpg';
          this.errorMessage = 'YouTube channel playlist cannot be embedded. Opening in new tab.';
          if (res.data.url) window.open(res.data.url, '_blank');
        } else {
          this.errorMessage = 'Unsupported playback type or invalid YouTube URL.';
        }
      },
      error: (err) => {
        this.isLoading = false;
        this.errorMessage = 'Error fetching video playback info. Please try again later.';
        console.error(err);
      }
    });
  }

  private normalizeUrl(url: string): string {
    if (!url) return url;
    if (/^https?:\/\//i.test(url)) return url;
    if (url.startsWith('/')) return `${environment.BaseUrl}${url}`;
    return `${environment.BaseUrl}/${url}`;
  }

  private async tryLoadHls(url: string): Promise<boolean> {
    const videoEl = this.videoPlayerRef?.nativeElement;
    if (!videoEl) return false;

    this.cleanupHls();

    const finalUrl = this.normalizeUrl(url);
    console.log('[HLS] loading manifest:', finalUrl);

    this.hlsInstance = new Hls({
      xhrSetup: (xhr, fragmentUrl) => {
        if (fragmentUrl.endsWith('.ts')) {
          xhr.open('GET', `${environment.BaseUrl}/api/features/video/Hlsstream?id=${this.videoId}&segment=${fragmentUrl}`, true);
        }
      }
    });

    return new Promise<boolean>((resolve) => {
      this.hlsInstance!.attachMedia(videoEl);

      this.hlsInstance!.on(Hls.Events.MEDIA_ATTACHED, () => { this.hlsInstance!.loadSource(finalUrl); });

      this.hlsInstance!.on(Hls.Events.MANIFEST_PARSED, () => {
        this.hlsRetryCount = 0;
        try { videoEl.play().catch(() => {}); } catch {}
        resolve(true);
      });

      this.hlsInstance!.on(Hls.Events.ERROR, (event, data) => {
        console.error('Hls.js error', data);
        if (data && data.fatal) {
          switch (data.type) {
            case Hls.ErrorTypes.NETWORK_ERROR:
              if (this.hlsRetryCount < this.maxHlsRetries) {
                this.hlsRetryCount++;
                console.warn(`HLS network error - retry ${this.hlsRetryCount}`);
                this.hlsInstance!.startLoad();
                return;
              }
              this.hlsInstance!.destroy();
              resolve(false);
              return;
            case Hls.ErrorTypes.MEDIA_ERROR:
              try { this.hlsInstance!.recoverMediaError(); } catch { this.hlsInstance!.destroy(); resolve(false); }
              return;
            default:
              this.hlsInstance!.destroy();
              resolve(false);
          }
        }
      });

      setTimeout(() => { if (!this.hlsInstance) resolve(false); }, 10000);
    });
  }

  private resolveThumbnail(path: string): string {
    if (/^https?:\/\//i.test(path)) return path;
    if (path.startsWith('/')) return `${environment.BaseUrl}${path}`;
    return `${environment.BaseUrl}/${path}`;
  }

  private async pickYouTubeThumbnail(ytId: string): Promise<string> {
    const maxRes = `https://img.youtube.com/vi/${ytId}/maxresdefault.jpg`;
    const hqDefault = `https://img.youtube.com/vi/${ytId}/hqdefault.jpg`;
    try { if (await this.checkThumbnailExists(maxRes)) return maxRes; } catch {}
    return hqDefault;
  }

  extractYouTubeIdOrPlaylist(url: string): { type: 'VIDEO' | 'PLAYLIST' | 'CHANNEL_PLAYLISTS'; id: string | null } {
    if (!url) return { type: 'VIDEO', id: null };
    if (url.includes('/@') && url.includes('/playlists')) return { type: 'CHANNEL_PLAYLISTS', id: null };
    const videoMatch = url.match(/[?&]v=([^&]+)/) || url.match(/youtu\.be\/([^?&]+)/);
    if (videoMatch && videoMatch[1].length === 11) return { type: 'VIDEO', id: videoMatch[1] };
    const playlistMatch = url.match(/[?&]list=([^#&]+)/);
    if (playlistMatch) return { type: 'PLAYLIST', id: playlistMatch[1] };
    return { type: 'VIDEO', id: null };
  }

  async checkThumbnailExists(url: string): Promise<boolean> {
    try { const res = await fetch(url, { method: 'HEAD' }); return res.ok; } catch { return false; }
  }

  onThumbnailError(event: Event): void {
    const img = event.target as HTMLImageElement;
    if (this.playbackInfo?.url) {
      const { type, id } = this.extractYouTubeIdOrPlaylist(this.playbackInfo.url);
      img.src = type === 'VIDEO' && id ? `https://img.youtube.com/vi/${id}/hqdefault.jpg` : 'assets/DefaultVideoImage.jpg';
    } else img.src = 'assets/DefaultVideoImage.jpg';
  }

  onAudioTrackChange(event: Event) {
    const value = (event.target as HTMLSelectElement).value;
    this.selectedAudioTrack = value;

    if (this.hlsInstance && this.hlsInstance.audioTracks) {
      const trackIndex = this.hlsInstance.audioTracks.findIndex(track => track.lang === value || track.name === value);
      if (trackIndex !== -1) this.hlsInstance.audioTrack = trackIndex;
    } else if (this.videoPlayerRef?.nativeElement) {
      const tracks = (this.videoPlayerRef.nativeElement as any).audioTracks;
      if (tracks && tracks.length > 0) {
        for (let i = 0; i < tracks.length; i++) tracks[i].enabled = tracks[i].language === value;
      }
    }
  }
}



// export class VideoPlayerComponent implements OnInit, AfterViewInit, OnDestroy { 
// @ViewChild('videoPlayer', { static: false }) videoPlayerRef!: ElementRef<HTMLVideoElement>; // <<< UPDATED
//   private videoId?: number;
//   playbackInfo?: PlayInfo;
//   safeUrl?: SafeResourceUrl;
//   thumbnailUrl?: string;
//   errorMessage?: string;
//   embedType?: 'VIDEO' | 'PLAYLIST' | 'CHANNEL_PLAYLISTS' | 'REMOTE' | 'LOCAL';
//   isLoading = true; 

//   availableAudioTracks: { label: string; lang: string }[] = []; 
//   selectedAudioTrack: string = 'default'; 

//   private hlsInstance?: Hls; 

//   constructor(
//     private route: ActivatedRoute,
//     private videoService: VideoService,
//     private sanitizer: DomSanitizer
//   ) {}

//   ngOnInit(): void {
//     const id = Number(this.route.snapshot.paramMap.get('id'));
//     if (!id || isNaN(id)) {
//       this.errorMessage = 'Invalid video ID';
//       this.isLoading = false;
//       return;
//     }
//     this.loadVideoPlaybackInfo(id);
//   }

//   ngAfterViewInit(): void {
//     // HLS initialization will happen here once the video element is ready,
//     // but triggered by loadVideoPlaybackInfo for LOCAL_STREAM type.
//   }

//   ngOnDestroy(): void {
//     if (this.hlsInstance) {
//       this.hlsInstance.destroy(); // ✨ Destroy HLS instance to prevent memory leaks
//     }
//   }

//   private loadVideoPlaybackInfo(id: number): void {
//     this.isLoading = true;
//     this.errorMessage = undefined;
//     this.videoService.getPlaybackInfo(id).subscribe({
//       next: async (res: BaseResponse<PlayInfo>) => {
//         this.isLoading = false;
//         if (!res.success || !res.data) {
//           this.errorMessage = res.message || 'Failed to load video.';
//           return;
//         }

//         this.playbackInfo = res.data;
//         //  this.cleanupHls();
//         console.log('Playback Info:', res.data);

//         // Clear previous HLS instance if any
//         if (this.hlsInstance) {
//           this.hlsInstance.destroy();
//           this.hlsInstance = undefined;
//         }

//         // ✅ Handle LOCAL_STREAM first
//         if (res.data.playbackType === 'LOCAL_STREAM') {
//           this.embedType = 'LOCAL';

//          let streamUrl: string | undefined;

//       if (res.data.url) {
//             streamUrl = `${environment.BaseUrl}${res.data.url}`;
//           }   
//           else if (this.videoService.getStreamOLdUrl(id)) {
//             streamUrl = this.videoService.getStreamOLdUrl(id);
//           } 
                  
//           else if (this.videoService.getHlsStreamUrl(id)) {
//             streamUrl = this.videoService.getHlsStreamUrl(id);
//           }
//           else if (this.videoService.getHlsPlaylistUrl(id)) {
//             streamUrl = this.videoService.getHlsPlaylistUrl(id);
//           }
//            else if (this.videoService.getStreamOLdUrl(id)) {
//             streamUrl = this.videoService.getStreamOLdUrl(id);
//           } 
//           else {
//             streamUrl = this.videoService.getStreamNewUrl(id);
//           }
//           console.log('Resolved streamUrl:', streamUrl);

//           this.thumbnailUrl = res.data.thumbnailUrl
//             ? `${environment.BaseUrl}${res.data.thumbnailUrl}`
//             : resolveThumbnailUrl(id);

//           // ✨ Use HLS.js if it's an .m3u8 stream
//           if (streamUrl && streamUrl.endsWith('.m3u8') && Hls.isSupported()) {
//             const videoEl = this.videoPlayerRef?.nativeElement;
//             if (videoEl) {
//               this.hlsInstance = new Hls();
//               this.hlsInstance.loadSource(streamUrl);
//               this.hlsInstance.attachMedia(videoEl);

//               this.hlsInstance.on(
//                 Hls.Events.MANIFEST_PARSED,
//                 (event, data) => {
//                   this.availableAudioTracks = data.audioTracks.map(track => ({
//                     label: track.name || track.lang || `Track ${track.id}`,
//                     lang: track.lang || `Track ${track.id}`,
//                   }));

//                   this.selectedAudioTrack =
//                     this.availableAudioTracks.length > 0
//                       ? this.availableAudioTracks[
//                           this.hlsInstance!.audioTrack
//                         ]?.lang || 'default'
//                       : 'default';

//                   videoEl.play();
//                 }
//               );

//               this.hlsInstance.on(Hls.Events.ERROR, (event, data) => {
//                 console.error('HLS.js error:', data);
//                 if (data.fatal) {
//                   this.errorMessage =
//                     'Fatal HLS playback error. Falling back to native player.';
//                   this.safeUrl =
//                     this.sanitizer.bypassSecurityTrustResourceUrl(streamUrl!);
//                   this.embedType = 'REMOTE';
//                 }
//               });
//             } else {
//               this.errorMessage = 'Video element not found.';
//             }
//           }
//           // ✨ If not HLS, just use native video/iframe
//           else if (streamUrl) {
//             this.safeUrl =
//               this.sanitizer.bypassSecurityTrustResourceUrl(streamUrl);
//             this.embedType = 'REMOTE';
//           } else {
//             this.errorMessage = 'Stream URL could not be resolved.';
//           }

//           return; // stop here
//         }
     


//         // ✅ Handle REMOTE_URL
//         if (res.data.playbackType === 'REMOTE_URL') {
//           this.embedType = 'REMOTE';
//           if (res.data.url) {
//              this.safeUrl = this.sanitizer.bypassSecurityTrustResourceUrl(res.data.url);
//           } else {
//              this.errorMessage = 'Remote URL not provided.';
//           }
//           this.thumbnailUrl = res.data.thumbnailUrl
//             ? `${environment.apiBaseUrl}${res.data.thumbnailUrl}`
//             : 'assets/DefaultVideoImage.jpg';
//           return;
//         }

//         // ✅ Handle YouTube / Playlist / Channel Playlists
//         const { type, id: ytId } = this.extractYouTubeIdOrPlaylist(res.data.url || '');
//         this.embedType = type;

//         if (type === 'VIDEO' && ytId) {
//           this.safeUrl = this.sanitizer.bypassSecurityTrustResourceUrl(
//             `https://www.youtube.com/embed/${ytId}?autoplay=1` // ✨ Added autoplay
//           );
//           this.thumbnailUrl = await this.pickYouTubeThumbnail(ytId);
//         } else if (type === 'PLAYLIST' && ytId) {
//           this.safeUrl = this.sanitizer.bypassSecurityTrustResourceUrl(
//             `https://www.youtube.com/embed/videoseries?list=${ytId}&autoplay=1` // ✨ Added autoplay
//           );
//           this.thumbnailUrl = 'assets/DefaultVideoImage.jpg'; // YouTube playlists often don't have a single thumbnail
//         } else if (type === 'CHANNEL_PLAYLISTS') {
//           this.safeUrl = undefined;
//           this.thumbnailUrl = 'assets/DefaultVideoImage.jpg';
//           this.errorMessage = 'This is a YouTube channel playlist page and cannot be embedded. Opening in new tab.';
//           if (res.data.url) window.open(res.data.url, '_blank');
//         } else {
//           this.errorMessage = 'Unsupported playback type or invalid YouTube URL.';
//         }
//       },
//       error: (err) => {
//         this.isLoading = false;
//         this.errorMessage = 'Error fetching video playback info. Please try again later.';
//         console.error(err);
//       }
//     });
//   }

//   private async pickYouTubeThumbnail(ytId: string): Promise<string> {
//     const maxRes = `https://img.youtube.com/vi/${ytId}/maxresdefault.jpg`;
//     const hqDefault = `https://img.youtube.com/vi/${ytId}/hqdefault.jpg`;
//     try {
//       if (await this.checkThumbnailExists(maxRes)) {
//         return maxRes;
//       }
//     } catch (e) {
//       console.warn('Maxresdefault thumbnail not available, falling back.', e);
//     }
//     return hqDefault; // Always fallback to hqdefault
//   }

//   extractYouTubeIdOrPlaylist(url: string): { type: 'VIDEO' | 'PLAYLIST' | 'CHANNEL_PLAYLISTS'; id: string | null } {
//     if (!url) return { type: 'VIDEO', id: null };
//     // Check for YouTube channel playlist page (e.g., https://www.youtube.com/@ChannelName/playlists)
//     if (url.includes('/@') && url.includes('/playlists')) {
//       return { type: 'CHANNEL_PLAYLISTS', id: null };
//     }
//     // Check for regular YouTube video (v= or youtu.be/)
//     const videoMatch = url.match(/[?&]v=([^&]+)/) || url.match(/youtu\.be\/([^?&]+)/);
//     if (videoMatch && videoMatch[1].length === 11) {
//       return { type: 'VIDEO', id: videoMatch[1] };
//     }
//     // Check for YouTube playlist (list=)
//     const playlistMatch = url.match(/[?&]list=([^#&]+)/);
//     if (playlistMatch) {
//       return { type: 'PLAYLIST', id: playlistMatch[1] };
//     }
//     return { type: 'VIDEO', id: null }; // Default to video type if no specific match
//   }

//   async checkThumbnailExists(url: string): Promise<boolean> {
//     try {
//       const res = await fetch(url, { method: 'HEAD' });
//       return res.ok;
//     } catch {
//       return false;
//     }
//   }

//   onThumbnailError(event: Event): void {
//     const img = event.target as HTMLImageElement;
//     // Fallback based on embed type or a generic default
//     if (this.playbackInfo?.url) {
//       const { type, id: ytId } = this.extractYouTubeIdOrPlaylist(this.playbackInfo.url);
//       if (type === 'VIDEO' && ytId) {
//         img.src = `https://img.youtube.com/vi/${ytId}/hqdefault.jpg`;
//       } else {
//         img.src = 'assets/DefaultVideoImage.jpg';
//       }
//     } else {
//       img.src = 'assets/DefaultVideoImage.jpg';
//     }
//   }

//   onAudioTrackChange(event: Event) {
//     const value = (event.target as HTMLSelectElement).value;
//     this.selectedAudioTrack = value;

//     if (this.hlsInstance && this.hlsInstance.audioTracks) {
//       const trackIndex = this.hlsInstance.audioTracks.findIndex(track => track.lang === value || track.name === value);
//       if (trackIndex !== -1) {
//         this.hlsInstance.audioTrack = trackIndex;
//         console.log(`HLS.js switched to audio track: ${value}`);
//       }
//     } else if (this.videoPlayerRef && this.videoPlayerRef.nativeElement) {
//       // Fallback for native audio tracks if HLS is not active
//       const videoEl = this.videoPlayerRef.nativeElement;
//       const tracks = (videoEl as any).audioTracks; // This is a standard HTMLMediaElement property
//       if (tracks && tracks.length > 0) {
//         for (let i = 0; i < tracks.length; i++) {
//           tracks[i].enabled = tracks[i].language === value; // Use language for native tracks
//         }
//         console.log(`Native player switched to audio track: ${value}`);
//       }
//     }
//   }
// }



// export class VideoPlayerComponent implements OnInit {
//   playbackInfo?: PlayInfo;
//   safeUrl?: SafeResourceUrl;
//   thumbnailUrl?: string;
//   errorMessage?: string;
//   embedType?: 'VIDEO' | 'PLAYLIST' | 'CHANNEL_PLAYLISTS' | 'REMOTE' | 'LOCAL';

//   availableAudioTracks: string[] = ['Tamil', 'Telugu', 'Hindi', 'Malayalam', 'Kannada'];
//   selectedAudioTrack: string = 'Tamil';

//   constructor(
//     private route: ActivatedRoute,
//     private videoService: VideoService,
//     private sanitizer: DomSanitizer
//   ) {}

//   ngOnInit(): void {
//     const id = Number(this.route.snapshot.paramMap.get('id'));
//     if (!id || isNaN(id)) {
//       this.errorMessage = 'Invalid video ID';
//       return;
//     }

//     this.videoService.getPlaybackInfo(id).subscribe({
//       next: async (res: BaseResponse<PlayInfo>) => {
//         if (!res.success || !res.data) {
//           this.errorMessage = res.message || 'Failed to load video.';
//           return;
//         }

//         this.playbackInfo = res.data;
//         console.log('Playback Info:', res.data);

//         // ✅ Handle LOCAL_STREAM first
//         if (res.data.playbackType === 'LOCAL_STREAM') {
//           this.embedType = 'LOCAL';

//           const streamUrl = res.data.url
//             ? `${environment.apiBaseUrl}${res.data.url}`
//             : resolveStreamUrl(`Features/video/streamNew/${id}`);

//           this.thumbnailUrl = res.data.thumbnailUrl
//             ? `${environment.apiBaseUrl}${res.data.thumbnailUrl}`
//             : resolveThumbnailUrl(id);

//           if (streamUrl.endsWith('.m3u8') && Hls.isSupported()) {
//             const videoEl = document.querySelector<HTMLVideoElement>('.video-player');
//             if (videoEl) {
//               const hls = new Hls();
//               hls.loadSource(streamUrl);
//               hls.attachMedia(videoEl);
//               hls.on(Hls.Events.MANIFEST_PARSED, () => videoEl.play());
//             }
//           } else {
//             this.safeUrl = this.sanitizer.bypassSecurityTrustResourceUrl(streamUrl);
//           }
//           return; // stop here for local videos
//         }

//         // ✅ Handle REMOTE_URL
//         if (res.data.playbackType === 'REMOTE_URL') {
//           this.embedType = 'REMOTE';
//           this.safeUrl = this.sanitizer.bypassSecurityTrustResourceUrl(res.data.url!);
//           this.thumbnailUrl = res.data.thumbnailUrl
//             ? `${environment.apiBaseUrl}${res.data.thumbnailUrl}`
//             : 'assets/DefaultVideoImage.jpg';
//           return;
//         }

//         // ✅ Handle YouTube / Playlist / Channel Playlists
//         const { type, id: ytId } = this.extractYouTubeIdOrPlaylist(res.data.url || '');
//         this.embedType = type;

//         if (type === 'VIDEO' && ytId) {
//           this.safeUrl = this.sanitizer.bypassSecurityTrustResourceUrl(
//             `https://www.youtube.com/embed/${ytId}`
//           );
//           this.thumbnailUrl = await this.pickYouTubeThumbnail(ytId);
//         } else if (type === 'PLAYLIST' && ytId) {
//           this.safeUrl = this.sanitizer.bypassSecurityTrustResourceUrl(
//             `https://www.youtube.com/embed/videoseries?list=${ytId}`
//           );
//           this.thumbnailUrl = 'assets/DefaultVideoImage.jpg';
//         } else if (type === 'CHANNEL_PLAYLISTS') {
//           this.safeUrl = undefined;
//           this.thumbnailUrl = 'assets/DefaultVideoImage.jpg';
//           this.errorMessage = 'This is a YouTube channel playlist page and cannot be embedded.';
//           if (res.data.url) window.open(res.data.url, '_blank');
//         } else {
//           this.errorMessage = 'Unsupported playback type.';
//         }
//       },
//       error: (err) => {
//         this.errorMessage = 'Error fetching video playback info.';
//         console.error(err);
//       }
//     });
//   }

//   private async pickYouTubeThumbnail(ytId: string): Promise<string> {
//     const maxRes = `https://img.youtube.com/vi/${ytId}/maxresdefault.jpg`;
//     return (await this.checkThumbnailExists(maxRes))
//       ? maxRes
//       : `https://img.youtube.com/vi/${ytId}/hqdefault.jpg`;
//   }

//   extractYouTubeIdOrPlaylist(url: string): { type: 'VIDEO' | 'PLAYLIST' | 'CHANNEL_PLAYLISTS'; id: string | null } {
//     if (!url) return { type: 'VIDEO', id: null };
//     if (url.includes('/@') && url.includes('/playlists')) {
//       return { type: 'CHANNEL_PLAYLISTS', id: null };
//     }
//     const videoMatch = url.match(/[?&]v=([^&]+)/) || url.match(/youtu\.be\/([^?&]+)/);
//     if (videoMatch && videoMatch[1].length === 11) {
//       return { type: 'VIDEO', id: videoMatch[1] };
//     }
//     const playlistMatch = url.match(/[?&]list=([^#&]+)/);
//     if (playlistMatch) {
//       return { type: 'PLAYLIST', id: playlistMatch[1] };
//     }
//     return { type: 'VIDEO', id: null };
//   }

//   async checkThumbnailExists(url: string): Promise<boolean> {
//     try {
//       const res = await fetch(url, { method: 'HEAD' });
//       return res.ok;
//     } catch {
//       return false;
//     }
//   }

//   onThumbnailError(event: Event): void {
//     const img = event.target as HTMLImageElement;
//     const { type, id: ytId } = this.extractYouTubeIdOrPlaylist(this.playbackInfo?.url || '');
//     img.src = type === 'VIDEO' && ytId
//       ? `https://img.youtube.com/vi/${ytId}/hqdefault.jpg`
//       : 'assets/DefaultVideoImage.jpg';
//   }

//   onAudioTrackChange(event: Event) {
//     const value = (event.target as HTMLSelectElement).value;
//     this.selectedAudioTrack = value;
//     const videoEl = document.querySelector<HTMLVideoElement>('.video-player');
//     if (videoEl) {
//       const tracks = (videoEl as any).audioTracks;
//       if (tracks && tracks.length > 0) {
//         for (let i = 0; i < tracks.length; i++) {
//           tracks[i].enabled = tracks[i].label === value;
//         }
//       }
//     }
//     console.log(`Switched to audio track: ${value}`);
//   }
// }



// export class VideoPlayerComponent implements OnInit {
//   playbackInfo?: PlayInfo;
//   safeUrl?: SafeResourceUrl;
//   thumbnailUrl?: string;
//   errorMessage?: string;
//   embedType?: 'VIDEO' | 'PLAYLIST' | 'CHANNEL_PLAYLISTS' | 'REMOTE' | 'LOCAL';

//   // 🎵 audio track handling
//   availableAudioTracks: string[] = [
//     'Tamil', 'Telugu', 'Hindi', 'Malayalam', 'Kannada'
//   ];
//   selectedAudioTrack: string = 'Tamil'; // default

//   constructor(
//     private route: ActivatedRoute,
//     private videoService: VideoService,
//     private sanitizer: DomSanitizer
//   ) {}

//   ngOnInit(): void {
//     const id = Number(this.route.snapshot.paramMap.get('id'));
//     if (!id || isNaN(id)) {
//       this.errorMessage = 'Invalid video ID';
//       return;
//     }

//     this.videoService.getPlaybackInfo(id).subscribe({
//       next: async (res: BaseResponse<PlayInfo>) => {
//         if (res.success && res.data) {
//           this.playbackInfo = res.data;
//           const { type, id: ytId } = this.extractYouTubeIdOrPlaylist(res.data.url);
//           this.embedType = type;

//           console.log('Playback URL:', res.data.url);
//           console.log('Parsed Type:', type, 'ID:', ytId);

//           if (type === 'VIDEO' && ytId) {
//             this.safeUrl = this.sanitizer.bypassSecurityTrustResourceUrl(
//               `https://www.youtube.com/embed/${ytId}`
//             );
//             const maxRes = `https://img.youtube.com/vi/${ytId}/maxresdefault.jpg`;
//             const maxResExists = await this.checkThumbnailExists(maxRes);
//             this.thumbnailUrl = maxResExists
//               ? maxRes
//               : `https://img.youtube.com/vi/${ytId}/hqdefault.jpg`;
//           } else if (type === 'PLAYLIST' && ytId) {
//             this.safeUrl = this.sanitizer.bypassSecurityTrustResourceUrl(
//               `https://www.youtube.com/embed/videoseries?list=${ytId}`
//             );
//             this.thumbnailUrl = 'assets/DefaultVideoImage.jpg';
//           } else if (type === 'CHANNEL_PLAYLISTS') {
//             this.safeUrl = undefined;
//             this.thumbnailUrl = 'assets/DefaultVideoImage.jpg';
//             this.errorMessage = 'This is a YouTube channel playlist page and cannot be embedded.';
//             window.open(res.data.url, '_blank');
//           } else {
//             // Handle non-YouTube types
//             switch (res.data.playbackType) {
//               case 'REMOTE_URL': {
//                 this.embedType = 'REMOTE';
//                 this.safeUrl = this.sanitizer.bypassSecurityTrustResourceUrl(res.data.url);
//                 const remoteThumb = resolveThumbnailUrl(id);
//                 const remoteExists = await this.checkThumbnailExists(remoteThumb);
//                 this.thumbnailUrl = remoteExists
//                   ? remoteThumb
//                   : 'assets/DefaultVideoImage.jpg';
//                 break;
//               }

//               case 'LOCAL_STREAM': {
//                 this.embedType = 'LOCAL';
//                 const streamUrl = resolveStreamUrl(`Features/video/streamNew/${id}`);
//                 this.safeUrl = this.sanitizer.bypassSecurityTrustResourceUrl(streamUrl);
//                 const localThumb = resolveThumbnailUrl(id);
//                 const localExists = await this.checkThumbnailExists(localThumb);
//                 this.thumbnailUrl = localExists
//                   ? localThumb
//                   : 'assets/DefaultVideoImage.jpg';
//                 break;
//               }

//               default:
//                 this.errorMessage = 'Unsupported playback type.';
//             }
//           }
//         } else {
//           this.errorMessage = res.message || 'Failed to load video.';
//         }
//       },
//       error: (err) => {
//         this.errorMessage = 'Error fetching video playback info.';
//         console.error(err);
//       }
//     });
//   }

//   extractYouTubeIdOrPlaylist(url: string): { type: 'VIDEO' | 'PLAYLIST' | 'CHANNEL_PLAYLISTS', id: string | null } {
//     if (!url) return { type: 'VIDEO', id: null };

//     if (url.includes('/@') && url.includes('/playlists')) {
//       return { type: 'CHANNEL_PLAYLISTS', id: null };
//     }

//     const videoMatch = url.match(/[?&]v=([^&]+)/) || url.match(/youtu\.be\/([^?&]+)/);
//     if (videoMatch && videoMatch[1].length === 11) {
//       return { type: 'VIDEO', id: videoMatch[1] };
//     }

//     const playlistMatch = url.match(/[?&]list=([^#&]+)/);
//     if (playlistMatch) {
//       return { type: 'PLAYLIST', id: playlistMatch[1] };
//     }

//     return { type: 'VIDEO', id: null };
//   }

//   async checkThumbnailExists(url: string): Promise<boolean> {
//     try {
//       const res = await fetch(url, { method: 'HEAD' });
//       return res.ok;
//     } catch {
//       return false;
//     }
//   }

//   onThumbnailError(event: Event): void {
//     const img = event.target as HTMLImageElement;
//     const { type, id: ytId } = this.extractYouTubeIdOrPlaylist(this.playbackInfo?.url || '');
//     img.src = type === 'VIDEO' && ytId
//       ? `https://img.youtube.com/vi/${ytId}/hqdefault.jpg`
//       : 'assets/DefaultVideoImage.jpg';
//   }
// // 🔄 Switch audio track (frontend simulation)
// onAudioTrackChange(event: Event) {
//   const value = (event.target as HTMLSelectElement).value;
//   this.selectedAudioTrack = value;

//   const videoEl = document.querySelector<HTMLVideoElement>('.video-player');

//   if (videoEl) {
//     // 👇 explicitly cast to any to bypass TS typing, since audioTracks is not in lib.dom.d.ts
//     const tracks = (videoEl as any).audioTracks;

//     if (tracks && tracks.length > 0) {
//       for (let i = 0; i < tracks.length; i++) {
//         tracks[i].enabled = tracks[i].label === value;
//       }
//     }
//   }

//   console.log(`Switched to audio track: ${value}`);
// }

// }

// export class VideoPlayerComponent implements OnInit, AfterViewInit, OnDestroy {
//   @ViewChild('videoPlayer', { static: false })
//   videoRef!: ElementRef<HTMLVideoElement>;

//   playbackInfo?: PlayInfo;
//   safeUrl?: SafeResourceUrl;
//   thumbnailUrl: string = 'assets/DefaultVideoImage.jpg';
//   errorMessage?: string;
//   embedType?: 'VIDEO' | 'PLAYLIST' | 'CHANNEL_PLAYLISTS' | 'REMOTE' | 'LOCAL';

//   availableAudioTracks: Array<{ name: string; index: number }> = [];
//   selectedAudioIndex = 0;

//   private hls?: Hls;

//   constructor(
//     private route: ActivatedRoute,
//     private videoService: VideoService,
//     private sanitizer: DomSanitizer
//   ) {}

//   ngOnInit(): void {
//     const id = Number(this.route.snapshot.paramMap.get('id'));
//     if (!id || isNaN(id)) {
//       this.errorMessage = 'Invalid video ID';
//       return;
//     }

//     this.videoService.getPlaybackInfo(id).subscribe({
//       next: async (res: BaseResponse<PlayInfo>) => {
//         if (!res.success || !res.data) {
//           this.errorMessage = res.message || 'Failed to load video info';
//           return;
//         }

//         this.playbackInfo = res.data;
//         const { type, id: ytId } = this.extractYouTubeIdOrPlaylist(res.data.url);
//         this.embedType = type;

//         if (type === 'VIDEO' && ytId) {
//           this.safeUrl = this.sanitizer.bypassSecurityTrustResourceUrl(
//             `https://www.youtube.com/embed/${ytId}`
//           );
//           const maxRes = `https://img.youtube.com/vi/${ytId}/maxresdefault.jpg`;
//           const maxResExists = await this.checkThumbnailExists(maxRes);
//           this.thumbnailUrl = maxResExists
//             ? maxRes
//             : `https://img.youtube.com/vi/${ytId}/hqdefault.jpg`;
//         } else if (type === 'PLAYLIST' && ytId) {
//           this.safeUrl = this.sanitizer.bypassSecurityTrustResourceUrl(
//             `https://www.youtube.com/embed/videoseries?list=${ytId}`
//           );
//         } else if (type === 'CHANNEL_PLAYLISTS') {
//           this.safeUrl = undefined;
//           this.errorMessage = 'This is a YouTube channel playlist page and cannot be embedded.';
//           window.open(res.data.url, '_blank');
//         } else {
//           const manifestUrl = this.videoService.getStreamUrl(id);
//           console.log('Manifest URL:', manifestUrl);
//           this.safeUrl = this.sanitizer.bypassSecurityTrustResourceUrl(manifestUrl);

//           if (res.data.playbackType === 'LOCAL_STREAM' || res.data.playbackType === 'REMOTE_URL') {
//             this.initHlsPlayer(manifestUrl);
//           } else {
//             this.errorMessage = 'This video type doesn’t support in-player audio switching';
//           }
//         }
//       },
//       error: err => {
//         console.error('Playback info fetch error:', err);
//         this.errorMessage = 'Error fetching playback info';
//       }
//     });
//   }

//   ngAfterViewInit(): void {
//     if (!this.videoRef) {
//       console.warn('Video element not found');
//     }
//   }

//   ngOnDestroy(): void {
//     this.hls?.destroy();
//   }

//   private async checkThumbnailExists(url: string): Promise<boolean> {
//     try {
//       const res = await fetch(url, { method: 'HEAD' });
//       return res.ok;
//     } catch {
//       return false;
//     }
//   }

//   private initHlsPlayer(manifestUrl: string): void {
//     const video = this.videoRef.nativeElement;

//     if ((video.canPlayType('application/vnd.apple.mpegurl') ?? '') !== '') {
//       video.src = manifestUrl;
//       video.addEventListener('loadedmetadata', () => video.play());
//       this.discoverNativeAudio(video);
//       return;
//     }

//     const config: Partial<HlsConfig> = {
//       debug: true
//     };
//     this.hls = new Hls(config);
//     this.hls.loadSource(manifestUrl);
//     this.hls.attachMedia(video);

//     this.hls.on(Hls.Events.MANIFEST_PARSED, () => {
//       this.availableAudioTracks = this.hls!.audioTracks.map((t, idx) => ({
//         name: t.name || t.lang || `Audio ${idx + 1}`,
//         index: idx
//       }));
//       this.selectedAudioIndex = this.hls!.audioTrack;
//       video.play();
//     });

//     this.hls.on(Hls.Events.AUDIO_TRACK_SWITCHED, (_evt, data) => {
//       this.selectedAudioIndex = data.id;
//     });

//     this.hls.on(Hls.Events.ERROR, (event, data) => {
//       console.error('HLS error:', data);
//       this.errorMessage = `Playback error: ${data.details || 'Unknown error'}`;
//     });
//   }

//   private discoverNativeAudio(video: HTMLVideoElement): void {
//     const tracks = (video as any).audioTracks as AudioTrackList;
//     if (!tracks) return;

//     this.availableAudioTracks = [];
//     for (let i = 0; i < tracks.length; i++) {
//       const t = tracks[i];
//       this.availableAudioTracks.push({ name: t.label || `Audio ${i + 1}`, index: i });
//       if (t.enabled) {
//         this.selectedAudioIndex = i;
//       }
//     }
//   }

//   onAudioTrackChange(event: Event): void {
//     const idx = Number((event.target as HTMLSelectElement).value);
//     this.selectedAudioIndex = idx;

//     if (this.hls) {
//       this.hls.audioTrack = idx;
//     } else {
//       const video = this.videoRef.nativeElement as any;
//       const tracks = video.audioTracks as AudioTrackList;
//       for (let i = 0; i < tracks.length; i++) {
//         tracks[i].enabled = i === idx;
//       }
//     }

//     console.log(`Switched to audio track index: ${idx}`);
//   }

//   onThumbnailError(event: Event): void {
//     const img = event.target as HTMLImageElement;
//     const { type, id: ytId } = this.extractYouTubeIdOrPlaylist(this.playbackInfo?.url || '');
//     img.src = type === 'VIDEO' && ytId
//       ? `https://img.youtube.com/vi/${ytId}/hqdefault.jpg`
//       : 'assets/DefaultVideoImage.jpg';
//   }

//   extractYouTubeIdOrPlaylist(url: string): { type: 'VIDEO' | 'PLAYLIST' | 'CHANNEL_PLAYLISTS', id: string | null } {
//     if (!url) return { type: 'VIDEO', id: null };

//     if (url.includes('/@') && url.includes('/playlists')) {
//       return { type: 'CHANNEL_PLAYLISTS', id: null };
//     }

//     const videoMatch = url.match(/[?&]v=([^&]+)/) || url.match(/youtu\.be\/([^?&]+)/);
//     if (videoMatch && videoMatch[1].length === 11) {
//       return { type: 'VIDEO', id: videoMatch[1] };
//     }

//     const playlistMatch = url.match(/[?&]list=([^#&]+)/);
//     if (playlistMatch) {
//       return { type: 'PLAYLIST', id: playlistMatch[1] };
//     }

//     return { type: 'VIDEO', id: null };
//   }
// }