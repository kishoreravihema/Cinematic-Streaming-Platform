export interface AuthResponseDto {
  isSuccess: string;
  token: string;
  message: string;
}

export interface UserProfileDto {
  id: string;
  username: string;
  email: string;
  roles: string[];
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}
