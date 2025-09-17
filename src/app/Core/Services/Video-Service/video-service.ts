//video-service.ts
import { Injectable } from '@angular/core';
import { BaseResponse } from '../../../Shared/Models/BaseResponse';
import { Playlist, Video } from '../../../Shared/Models/video.model';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { PlayInfo } from '../../../Shared/Models/playInfo.model';
import { VideoDto } from '../../../Shared/Models/video.dto';
import { VideoResponseDto } from '../../../Shared/Models/VideoResponseDto';
import { buildApiUrl } from '../../../Shared/Utilities/api-url.util';
//import { buildApiUrl } from '../../../Shared/Utilities/api-url.util';
//import { buildApiUrl } from 'c:/Users/kr470/OneDrive/Desktop/Netflix app/KApp_NewDevelopment/KApp-Frontend/src/app/Shared/Utilities/api-url.util';


@Injectable({
  providedIn: 'root'
})
export class VideoService {
  
  private videoBaseUrl = buildApiUrl('/videos');
  private featuresBaseUrl = buildApiUrl('/features');
   

    constructor(private http: HttpClient) {}

    getAllVideos(page: number = 1, pageSize: number = 10): Observable<BaseResponse<Video[]>>
    {
    return this.http.get<BaseResponse<Video[]>>(`${this.videoBaseUrl}?page=${page}&pageSize=${pageSize}`);
    }

    getVideoById(id: number): Observable<BaseResponse<Video>>
    {
        return this.http.get<BaseResponse<Video>>(`${this.videoBaseUrl}/${id}`);
    }
    
    getVideosByCategory(category: string): Observable<BaseResponse<Video[]>> 
    {
    return this.http.get<BaseResponse<Video[]>>(`${this.videoBaseUrl}/categories/${encodeURIComponent(category)}`);
    }
    
    exists(id: number):Observable<BaseResponse<boolean>>{
      return this.http.get<BaseResponse<boolean>>('${this.videoBaseUrl}/${id}/exists');
    }
    addVideoWithManualId(id: number,dto: VideoDto): Observable<BaseResponse<VideoResponseDto>> 
    {
    return this.http.post<BaseResponse<VideoResponseDto>>(`${this.videoBaseUrl}/${id}`,dto);
   }
    updateVideo(dto: VideoResponseDto): Observable<BaseResponse<VideoResponseDto>> 
    {
    return this.http.put<BaseResponse<VideoResponseDto>>(this.videoBaseUrl, dto);
    }
     updateVideoById(id: number, dto: VideoDto ): Observable<BaseResponse<VideoResponseDto>> 
     {
    return this.http.put<BaseResponse<VideoResponseDto>>(`${this.videoBaseUrl}/${id}`, dto);
    }
     deleteVideo(id: number): Observable<BaseResponse<boolean>> {
    return this.http.delete<BaseResponse<boolean>>(`${this.videoBaseUrl}/${id}`);
  }

    getStreamNewUrl(id: number): string 
    {
    return `${this.featuresBaseUrl}/video/streamNew/${id}`;
    }
    getStreamOLdUrl(id: number): string 
    {
    return `${this.featuresBaseUrl}/video/streamOld/${id}`;
    }
    getHlsStreamUrl(id: number): string {
    return `${this.featuresBaseUrl}/video/Hlsstream/${id}`;
  }
  getHlsPlaylistUrl(id: number): string {
  return `${this.featuresBaseUrl}/video/HlsSegmentstream/${id}/output.m3u8`;
  }

  getHlsSegmentUrl(id: number, segment: string): string {
   return `${this.featuresBaseUrl}/video/HlsSegmentstream/${id}/${segment}`;
  }
   getHlsPlaylistText(id: number) {
    const url = this.getHlsPlaylistUrl(id);
    return this.http.get(url, { responseType: 'text' });
  }
    getPlaybackInfo(id: number): Observable<BaseResponse<PlayInfo>>
     {
    return this.http.get<BaseResponse<PlayInfo>>(`${this.featuresBaseUrl}/video/${id}/play-info`);
  }
    getPlaylists(): Observable<BaseResponse<Playlist[]>> 
    {
    return this.http.get<BaseResponse<Playlist[]>>(`${this.featuresBaseUrl}/playlists`);
    }

  getVideosByPlaylistId(playlistId: number): Observable<BaseResponse<Video[]>>
   {
    return this.http.get<BaseResponse<Video[]>>(`${this.featuresBaseUrl}/playlists/${playlistId}/videos`);

   }

}


  // getThumbnailUrl(id: number): string {
  //   return `${this.featuresBaseUrl}/video/${id}/thumbnail.jpg`;
  // }