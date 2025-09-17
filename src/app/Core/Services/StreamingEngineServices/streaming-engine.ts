import { Injectable } from '@angular/core';
import { HttpClient, HttpResponse } from '@angular/common/http';
import { DomSanitizer, SafeUrl } from '@angular/platform-browser';
import { Observable, throwError } from 'rxjs';
import { map, catchError } from 'rxjs/operators';
import { StreamApiResponse} from '../../../Shared/Models/StreamApiResponse';
import { PlayerConfig } from '../../../Shared/Models/player.dto';
import { buildApiUrl } from '../../../Shared/Utilities/api-url.util';

@Injectable({
  providedIn: 'root'
})
export class StreamingEngine {
  constructor(
    private http: HttpClient,
    private sanitizer: DomSanitizer
  ) {}

  getStream(id: number, mediaType: 'video' | 'music'): Observable<PlayerConfig> {
    const streamPath = mediaType === 'music'
      ? `/Features/stream/music/${id}`
      : `/Features/stream/${id}`;

    const streamUrl = buildApiUrl(streamPath);

    return this.http.get(streamUrl, { observe: 'response', responseType: 'blob' }).pipe(
      map((response: HttpResponse<Blob>) => {
        if (response.url && response.url !== streamUrl) {
          console.log('Redirect detected. Final URL:', response.url);
          return {
            url: this.sanitizer.bypassSecurityTrustUrl(response.url),
            type: mediaType
          };
        }

        const mediaBlob = response.body!;
        const objectUrl = URL.createObjectURL(mediaBlob);
        return {
          url: this.sanitizer.bypassSecurityTrustUrl(objectUrl),
          type: mediaType
        };
      }),

      catchError((error) => {
        if (error.error instanceof Blob && error.error.type.includes('application/json')) {
          return new Observable<PlayerConfig>((observer) => {
            const reader = new FileReader();
            reader.onload = (e: any) => {
              try {
                const errResponse: StreamApiResponse = JSON.parse(e.target.result);
                observer.error(errResponse.message || 'Unknown server error.');
              } catch {
                observer.error('Failed to parse error response from the server.');
              } finally {
                observer.complete();
              }
            };
            reader.onerror = () => {
              observer.error('Error reading server response.');
              observer.complete();
            };
            reader.readAsText(error.error);
          });
        }

        return throwError(() => new Error('A network error occurred. Please check your connection.'));
      })
    );
  }
}