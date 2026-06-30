import { Transform } from 'class-transformer';
import { IsBoolean, IsOptional } from 'class-validator';

export class QueryDepositAccountDto {
  @IsBoolean()
  @IsOptional()
  @Transform(({ value }) => value === true || value === 'true')
  includeInactive?: boolean;
}
