import { Injectable } from '@angular/core';
import { HttpClient, HttpParams, HttpResponse } from '@angular/common/http';
import { Observable } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class DownloaderService {
 // NOTE: these endpoints are placeholders. Implement server-side extraction & stream/download endpoints.
  private extractEndpoint = '/api/extract'; // GET ?url=...
  private downloadEndpoint = '/api/download'; // GET ?url=... (returns file stream)
  private previewEndpoint = '/api/preview'; // optional, returns playable url/info

  constructor(private http: HttpClient) {}

  extractMetadata(url: string): Observable<any> {
    const params = new HttpParams().set('url', url);
    return this.http.get<any>(this.extractEndpoint, { params });
  }

  // returns a redirect URL or direct streamable link (implementation depends on your server)
  getPreviewUrl(url: string): Observable<{ streamUrl?: string; type?: string; title?: string; thumbnail?: string }> {
    const params = new HttpParams().set('url', url);
    return this.http.get<{ streamUrl?: string; type?: string; title?: string; thumbnail?: string }>(this.previewEndpoint, { params });
  }

  // returns file as blob for download
  downloadAsBlob(url: string): Observable<Blob> {
    const params = new HttpParams().set('url', url);
    return this.http.get(this.downloadEndpoint, { params, responseType: 'blob' });
  }
}