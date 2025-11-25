import { IsString, IsNotEmpty } from 'class-validator';

export class TelegramLoginDto {
  @IsString() @IsNotEmpty() id: string;
  @IsString() username?: string;
  @IsString() first_name?: string;
  @IsString() photo_url?: string;
  @IsString() auth_date: string;
  @IsString() hash: string;
}
