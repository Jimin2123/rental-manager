import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsDateString, IsInt, IsOptional, Min } from 'class-validator';

export class ExtendRentalContractDto {
  @ApiProperty({ example: '2028-06-30', description: '연장 종료일 (현재 종료일보다 이후여야 함)' })
  @IsDateString()
  endDate: string;

  @ApiPropertyOptional({ example: 24, description: '계약 개월 수 (생략 시 startDate~endDate 개월 차로 자동 계산)' })
  @IsInt()
  @Min(1)
  @IsOptional()
  contractMonths?: number;
}
