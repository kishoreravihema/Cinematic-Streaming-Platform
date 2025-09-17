export interface ActorResponseDto {
    id:number;
    name:string;
}

export interface VideoDto {
    // id: number;
    // title: string;
    // description: string;
    // thumbnailUrl: string;
    // videoUrl: string;
    // duration: number; // Duration in seconds
    // uploadDate: Date;
    // actors: ActorResponseDto[];
    // genres: string[];
    // isPublic: boolean;
  title?: string;
  url?: string;
  description?: string;
  playlistId: number;
  categoryId: number;
  thumbnailUrl?: string;
  rating: number;
  durationInSeconds: number;
  language?: string;
  ageRating?: string;
  genre?: string;
  actors: ActorResponseDto[];
  director?: string;
  isPremium: boolean;
  releaseDate: string;  
  createdAt: string;
}