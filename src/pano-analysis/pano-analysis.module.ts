import { Module } from '@nestjs/common';
import { PanoAnalysisService } from './pano-analysis.service';
import { PanoAnalysisController } from './pano-analysis.controller';
import { PanoCapturesModule } from '../pano-captures/pano-captures.module';
import { RoomsModule } from '../rooms/rooms.module';
import { OpeningsModule } from '../openings/openings.module';

@Module({
  imports: [PanoCapturesModule, RoomsModule, OpeningsModule],
  controllers: [PanoAnalysisController],
  providers: [PanoAnalysisService],
  exports: [PanoAnalysisService],
})
export class PanoAnalysisModule {}
