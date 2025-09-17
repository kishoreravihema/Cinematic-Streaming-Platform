// src/typings.d.ts
interface AudioTrack {
  readonly id: string;
  readonly kind: string;
  readonly label: string;
  readonly language: string;
  enabled: boolean;
}

interface AudioTrackList {
  readonly length: number;
  [index: number]: AudioTrack;
}