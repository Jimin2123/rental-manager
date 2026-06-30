import { PartialType } from '@nestjs/swagger';
import { CreateDepositAccountDto } from './create-deposit-account.dto';

export class UpdateDepositAccountDto extends PartialType(CreateDepositAccountDto) {}
