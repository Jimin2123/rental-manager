import { Module } from '@nestjs/common';
import { AuditLogService } from './audit-log/audit-log.service';
import { AuditLogController } from './audit-log/audit-log.controller';

@Module({
  providers: [AuditLogService],
  controllers: [AuditLogController],
  exports: [AuditLogService],
})
export class CommonModule {}
