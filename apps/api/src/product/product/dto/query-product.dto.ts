import { IsBoolean, IsOptional, IsString } from 'class-validator';

export class QueryProductDto {
  @IsOptional()
  @IsString()
  category?: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @IsString()
  search?: string;
}
