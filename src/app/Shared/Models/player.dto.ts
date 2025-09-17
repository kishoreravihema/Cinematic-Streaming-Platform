import { SafeUrl } from "@angular/platform-browser";
/**
 * Defines the configuration object required by the MediaPlayerComponent
 * to render the correct player and set its source URL.
 */
export interface PlayerConfig {
  url: SafeUrl;
  type: 'video' | 'music';
}