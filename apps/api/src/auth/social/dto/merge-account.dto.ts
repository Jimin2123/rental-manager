import { IsNotEmpty, IsString } from 'class-validator';

export class MergeAccountDto {
  @IsString()
  @IsNotEmpty()
  token: string;
}
