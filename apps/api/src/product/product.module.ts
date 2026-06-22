import { Module } from '@nestjs/common';
import { OrganizationModule } from '../organization/organization.module';
import { ProductController } from './product/product.controller';
import { ProductService } from './product/product.service';
import { AssetController } from './asset/asset.controller';
import { AssetService } from './asset/asset.service';
import { AssetEventController } from './asset-event/asset-event.controller';
import { AssetEventService } from './asset-event/asset-event.service';

@Module({
  imports: [OrganizationModule],
  providers: [ProductService, AssetService, AssetEventService],
  controllers: [ProductController, AssetController, AssetEventController],
  exports: [AssetService],
})
export class ProductModule {}
