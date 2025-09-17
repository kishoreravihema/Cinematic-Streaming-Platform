import { Routes } from '@angular/router';
import { MusicComponent } from './Features/music/music-component/music-component';
import { VideoListComponent } from './Features/video-list/video-list-component/video-list-component';
import { HomeComponent } from './Features/home/home-component/home-component';
import { StreamEngineComponent } from './Features/StreamEngineComponent/stream-engine-component/stream-engine-component';
import { VideoPlayerComponent } from './Features/video/video-component/video-component';

export const routes: Routes = [
  { path: '', redirectTo: 'videos', pathMatch: 'full' },
  { path: 'videos', component: VideoListComponent },
  { path: 'music', component: MusicComponent },
  { path: 'watch/:id', component: VideoPlayerComponent },
  { path: 'music/:id', component: MusicComponent },
  { path: 'stream', component: StreamEngineComponent }, 
  { path: '**', redirectTo: 'videos' }
];


