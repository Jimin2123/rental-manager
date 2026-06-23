import { Module } from '@nestjs/common';
import { OrganizationModule } from '../organization/organization.module';
import { ProductController } from './product/product.controller';
import { ProductService } from './product/product.service';
import { AssetController } from './asset/asset.controller';
import { AssetService } from './asset/asset.service';
import { AssetEventController } from './asset-event/asset-event.controller';
import { AssetEventService } from './asset-event/asset-event.service';
import { MeterReadingService } from './meter-reading/meter-reading.service';
import { AssetMeterReadingController } from './meter-reading/asset-meter-reading.controller';
import { MeterReadingController } from './meter-reading/meter-reading.controller';

@Module({
  imports: [OrganizationModule],
  providers: [ProductService, AssetService, AssetEventService, MeterReadingService],
  controllers: [
    ProductController,
    AssetController,
    AssetEventController,
    AssetMeterReadingController,
    MeterReadingController,
  ],
  exports: [AssetService],
})
export class ProductModule {}
