import { Component, OnInit, OnDestroy } from '@angular/core';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { CommonModule, NgIf } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { finalize, Subscription } from 'rxjs';

import { PlatformDetection } from '../../../Shared/Models/platform.model';
import { PlatformService } from '../../../Core/Services/Platform-Service/platform-service';
import { DownloaderService } from '../../../Core/Services/Downloader-Service/downloader-service';
import { YoutubeApiService } from '../../../Core/Services/Youtube-Extracter-Service/youtube-api.service';

@Component({
  selector: 'app-stream-engine',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, NgIf],
  templateUrl: './stream-engine-component.html',
  styleUrls: ['./stream-engine-component.scss']
})
export class StreamEngineComponent implements OnInit, OnDestroy {
  form: FormGroup;
  detection: PlatformDetection | null = null;

  embedSafeUrl: SafeResourceUrl | null = null;
  videoSrc: SafeResourceUrl | null = null;

  loadingPreview = false;
  loadingDownload = false;

  previewInfo: { title?: string; thumbnail?: string; streamUrl?: string; type?: string } | null = null;
  error: string | null = null;

  private subs: Subscription[] = []; // ✅ collect subs to clean up

  constructor(
    private fb: FormBuilder,
    private platformService: PlatformService,
    private downloader: DownloaderService,
    private sanitizer: DomSanitizer,
    private youtubeService: YoutubeApiService
  ) {
    this.form = this.fb.group({
      url: ['', [Validators.required, Validators.pattern(/^https?:\/\/.+/i)]]
    });
  }

  ngOnInit(): void {}

  ngOnDestroy(): void {
    // ✅ avoid memory leaks
    this.subs.forEach((s) => s.unsubscribe());
  }

  onDetect(): void {
    this.resetState();

    const raw = (this.urlControl?.value || '').trim();
    if (!raw) {
      this.error = 'Please provide a URL.';
      return;
    }
    if (this.form.invalid) {
      this.error = 'Please enter a valid URL (starting with http/https).';
      return;
    }

    this.detection = this.platformService.detect(raw);

    if (this.detection.embedUrl) {
      this.embedSafeUrl = this.sanitizer.bypassSecurityTrustResourceUrl(this.detection.embedUrl);
    }
    this.error = null;

    if (this.detection.platform === 'terabox') {
      const sub = this.platformService
        .streamTerabox(this.detection.id ?? undefined, this.detection.rawUrl ?? undefined)
        .subscribe({
          next: (blob) => {
            const objectUrl = URL.createObjectURL(blob);
            this.videoSrc = this.sanitizer.bypassSecurityTrustUrl(objectUrl);
          },
          error: () => {
            this.error = 'Terabox stream failed. Check backend.';
          }
        });
      this.subs.push(sub);
    }
  }

  onPreview(): void {
    if (!this.detection) {
      this.error = 'Detect platform first.';
      return;
    }

    this.loadingPreview = true;
    this.previewInfo = null;
    this.error = null;

    if (this.detection.platform === 'youtube' && this.embedSafeUrl) {
      this.previewInfo = {
        streamUrl: typeof this.detection.embedUrl === 'string' ? this.detection.embedUrl : undefined,
        type: 'embed',
        title: 'YouTube (embed)'
      };
      this.loadingPreview = false;
      return;
    }

    const sub = this.downloader
      .getPreviewUrl(this.detection.rawUrl)
      .pipe(finalize(() => (this.loadingPreview = false)))
      .subscribe({
        next: (info) => {
          if (info?.streamUrl) {
            this.embedSafeUrl = this.sanitizer.bypassSecurityTrustResourceUrl(info.streamUrl);
            this.previewInfo = info;
          } else {
            this.error = 'Preview not available for this URL. Use Download instead.';
          }
        },
        error: (err) => {
          console.error(err);
          this.error = 'Preview failed — backend may not support this platform or CORS blocked the request.';
        }
      });

    this.subs.push(sub);
  }

  onDownload(): void {
    if (!this.detection) {
      this.error = 'Detect platform first.';
      return;
    }

    this.loadingDownload = true;
    this.error = null;

    const sub = this.downloader
      .downloadAsBlob(this.detection.rawUrl)
      .pipe(finalize(() => (this.loadingDownload = false)))
      .subscribe({
        next: (blob) => this.triggerDownload(blob),
        error: (err) => {
          console.error(err);
          this.error = 'Download failed — backend extraction may have failed or file is restricted.';
        }
      });

    this.subs.push(sub);
  }

  private triggerDownload(blob: Blob): void {
    const filename = this.suggestFileName(this.previewInfo?.title || this.detection?.platform || 'download');
    const url = window.URL.createObjectURL(blob);

    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();

    window.URL.revokeObjectURL(url);
  }

  private suggestFileName(base?: string): string {
    const b = (base || 'file').replace(/[^a-z0-9_\-\. ]/gi, '_').slice(0, 80);
    return `${b}.mp4`;
  }

  resetState(): void {
    this.detection = null;
    this.embedSafeUrl = null;
    this.videoSrc = null;
    this.previewInfo = null;
    this.error = null;
    this.loadingPreview = false;
    this.loadingDownload = false;
  }

  get urlControl() {
    return this.form.get('url');
  }
}
