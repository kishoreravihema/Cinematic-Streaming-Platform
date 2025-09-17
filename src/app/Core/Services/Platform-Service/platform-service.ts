// src/app/Core/Services/platform-service.ts
import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { PlatformDetection, SupportedPlatform } from '../../../Shared/Models/platform.model';
import { buildApiUrl } from '../../../Shared/Utilities/api-url.util';

@Injectable({
  providedIn: 'root'
})
export class PlatformService {
  
  constructor(private http: HttpClient) {}

  private regexes: {
    platform: SupportedPlatform;
    rx: RegExp;
    extractor?: (m: RegExpMatchArray) => string | null;
  }[] = [
    // YouTube
    { platform: 'youtube', rx: /(?:https?:\/\/)?(?:www\.)?(?:youtube\.com\/watch\?v=|youtube\.com\/embed\/|youtu\.be\/)([A-Za-z0-9_-]{6,})/i, extractor: (m) => m[1] || null },

    // Terabox
    { platform: 'terabox', rx: /(?:https?:\/\/)?(?:www\.)?(?:terabox\.com|1024terabox\.com)\/s\/([A-Za-z0-9_-]+)/i, extractor: (m) => m[1] || null },

    // Instagram
    { platform: 'instagram', rx: /(?:https?:\/\/)?(?:www\.)?instagram\.com\/(p|reel|tv)\/([A-Za-z0-9-_]+)/i, extractor: (m) => m[2] || null },

    // Facebook / fb.watch /
    { platform: 'facebook', rx: /(?:https?:\/\/)?(?:www\.)?(?:facebook\.com\/.+\/videos\/(\d+)|fb\.watch\/[A-Za-z0-9_-]+)/i, extractor: (m) => m[1] || null },

    // X / Twitter
    { platform: 'x', rx: /(?:https?:\/\/)?(?:www\.)?(?:x\.com|twitter\.com)\/[^\/]+\/status\/(\d+)/i, extractor: (m) => m[1] || null },

    // Reddit
    { platform: 'reddit', rx: /(?:https?:\/\/)?(?:www\.)?reddit\.com\/r\/[^\/]+\/comments\/([A-Za-z0-9]+)\/?/i, extractor: (m) => m[1] || null },
    { platform: 'reddit', rx: /(?:https?:\/\/)?v\.redd\.it\/([A-Za-z0-9_-]+)/i, extractor: (m) => m[1] || null },

    // Pinterest
    { platform: 'pinterest', rx: /(?:https?:\/\/)?(?:www\.)?pinterest\.(?:com|co\.uk)\/pin\/(\d+)/i, extractor: (m) => m[1] || null },

    // TikTok
    { platform: 'tiktok', rx: /(?:https?:\/\/)?(?:www\.)?tiktok\.com\/@[^\/]+\/video\/(\d+)|vm\.tiktok\.com\/([A-Za-z0-9]+)/i, extractor: (m) => m[1] || m[2] || null },

    // Twitch
    { platform: 'twitch', rx: /(?:https?:\/\/)?(?:www\.)?twitch\.tv\/videos\/(\d+)|(?:twitch\.tv\/clip\/([A-Za-z0-9_-]+))/i, extractor: (m) => m[1] || m[2] || null },

    // Google Drive
    { platform: 'google-drive', rx: /(?:https?:\/\/)?(?:drive\.google\.com\/file\/d\/([A-Za-z0-9_-]+)\/|drive\.google\.com\/open\?id=([A-Za-z0-9_-]+))/i, extractor: (m) => m[1] || m[2] || null },

    // Dropbox
    { platform: 'dropbox', rx: /(?:https?:\/\/)?(?:www\.)?dropbox\.com\/s\/([A-Za-z0-9]+)\/?/i, extractor: (m) => m[1] || null },

    // OneDrive
    { platform: 'onedrive', rx: /(?:https?:\/\/)?(?:www\.)?1drv\.ms\/[A-Z]\/([A-Za-z0-9_-]+)/i, extractor: (m) => m[1] || null },

    // Mega
    { platform: 'mega', rx: /(?:https?:\/\/)?mega\.nz\/(?:file|#!)\/([A-Za-z0-9_-]+)/i, extractor: (m) => m[1] || null },
  ];

  detect(url: string): PlatformDetection {
    const normalized = (url || '').trim();
    if (!normalized) {
      return { platform: 'unknown', rawUrl: url, canEmbed: false, id: null, embedUrl: null };
    }

    for (const r of this.regexes) {
      const m = normalized.match(r.rx);
      if (m) {
        const id = r.extractor ? r.extractor(m) : null;
        const canEmbed = this.platformSupportsEmbedding(r.platform, id);
        const embedUrl = this.buildEmbedUrl(r.platform, id, normalized);
        return {
          platform: r.platform,
          id,
          rawUrl: normalized,
          canEmbed,
          embedUrl
        };
      }
    }

    // fallback: cloud drives
    try {
      const u = new URL(normalized);
      const host = u.hostname.toLowerCase();
      if (host.includes('drive.google')) return { platform: 'google-drive', id: null, rawUrl: normalized, canEmbed: false, embedUrl: null };
      if (host.includes('dropbox')) return { platform: 'dropbox', id: null, rawUrl: normalized, canEmbed: false, embedUrl: null };
      if (host.includes('mega')) return { platform: 'mega', id: null, rawUrl: normalized, canEmbed: false, embedUrl: null };
    } catch (e) {}

    return { platform: 'unknown', rawUrl: normalized, canEmbed: false, id: null, embedUrl: null };
  }

  // 🔹 Stream Terabox directly through backend proxy
  streamTerabox(id?: string, url?: string): Observable<Blob> {
    const params: any = {};
    if (id) params.id = id;
    if (url) params.url = url;

 
     const apiUrl = 'http://localhost:5008/api/Features/streamTeraBox';
     return this.http.get(apiUrl, { params, responseType: 'blob' });

 
  }

  private platformSupportsEmbedding(platform: SupportedPlatform, id?: string | null): boolean {
    switch (platform) {
      case 'youtube': return !!id;
      case 'twitch': return !!id;
      case 'reddit': return !!id;
      case 'instagram': return true;
      case 'facebook': return true;
      default: return false;
    }
  }

  private buildEmbedUrl(platform: SupportedPlatform, id: string | null | undefined, rawUrl: string): string | null {
    try {
      switch (platform) {
        case 'youtube':
          return id ? `https://www.youtube.com/embed/${id}` : null;
        case 'twitch':
          return id ? `https://player.twitch.tv/?video=v${id}&parent=${window.location.hostname}` : null;
        case 'reddit':
          return id ? `https://www.redditmedia.com/r//comments/${id}/?ref_source=embed&amp;ref=share&amp;embed=true` : rawUrl;
        case 'instagram':
        case 'facebook':
          return rawUrl;
        default:
          return null;
      }
    } catch (e) {
      return null;
    }
  }
}
