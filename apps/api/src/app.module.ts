import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { ScheduleModule } from '@nestjs/schedule';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AuthModule } from './auth/auth.module';
import { CustomerModule } from './customer/customer.module';
import { FinanceModule } from './finance/finance.module';
import { MailModule } from './mail/mail.module';
import { OrganizationModule } from './organization/organization.module';
import { PrismaModule } from './prisma/prisma.module';
import { ProductModule } from './product/product.module';
import { OrderModule } from './order/order.module';
import { AfterServiceModule } from './after-service/after-service.module';
import { CommonModule } from './common/common.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, envFilePath: '.env' }),
    ThrottlerModule.forRoot([{ ttl: 60000, limit: 20 }]),
    ScheduleModule.forRoot(),
    PrismaModule,
    MailModule,
    AuthModule,
    OrganizationModule,
    CustomerModule,
    ProductModule,
    OrderModule,
    FinanceModule,
    AfterServiceModule,
    CommonModule,
  ],
  controllers: [AppController],
  providers: [AppService, { provide: APP_GUARD, useClass: ThrottlerGuard }],
})
export class AppModule {}
