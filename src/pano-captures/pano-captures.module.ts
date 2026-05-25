import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PanoCapture } from './pano-captures.entity';
import { PanoCapturesService } from './pano-captures.service';
import { PanoCapturesController } from './pano-captures.controller';

@Module({
  imports: [TypeOrmModule.forFeature([PanoCapture])],
  controllers: [PanoCapturesController],
  providers: [PanoCapturesService],
  exports: [TypeOrmModule, PanoCapturesService],
})
export class PanoCapturesModule {}