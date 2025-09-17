export interface VideoResponseDto {
  id: number;
  title?: string;
  videoUrl?: string;
  description?: string;
  playlistId?: number;
  categoryId?: number;
  thumbnailUrl?: string;
  rating: number;
  durationInSeconds: number;
  language?: string;
  ageRating?: string;
  genre?: string;
  director?: string;
  isPremium: boolean;
  releaseDate: string; 
  createdAt: string;      
  actors: ActorResponseDto[];

}
export interface ActorResponseDto {
  id: number;
  name: string;
//   profileUrl?: string;

}