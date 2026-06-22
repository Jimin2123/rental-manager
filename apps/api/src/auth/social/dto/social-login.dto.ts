import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';

export class SocialLoginDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  accessToken: string;
}
