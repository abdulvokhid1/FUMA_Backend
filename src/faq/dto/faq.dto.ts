import { IsString } from 'class-validator';

export class CreateFaqDto {
  @IsString()
  question: string;

  @IsString()
  answer: string;
}

export class UpdateFaqDto {
  @IsString()
  question?: string;

  @IsString()
  answer?: string;
}
