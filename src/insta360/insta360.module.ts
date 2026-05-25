import { Module } from '@nestjs/common';
import { Insta360Service } from './insta360.service';
import { Insta360Controller } from './insta360.controller';
import { PanoCapturesModule } from '../pano-captures/pano-captures.module';
import { PanoAnalysisModule } from '../pano-analysis/pano-analysis.module';

@Module({
  imports: [PanoCapturesModule, PanoAnalysisModule],
  controllers: [Insta360Controller],
  providers: [Insta360Service],
  exports: [Insta360Service],
})
export class Insta360Module {}
