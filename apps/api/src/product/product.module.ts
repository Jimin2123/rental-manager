import { Module } from '@nestjs/common';
import { OrganizationModule } from '../organization/organization.module';
import { ProductController } from './product/product.controller';
import { ProductService } from './product/product.service';

@Module({
  imports: [OrganizationModule],
  providers: [ProductService],
  controllers: [ProductController],
})
export class ProductModule {}
