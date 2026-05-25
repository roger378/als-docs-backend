import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { Observation } from './observation.entity';
import { ObservationsController } from './observations.controller';
import { ObservationsService } from './observations.service';

@Module({
  imports: [TypeOrmModule.forFeature([Observation])],
  controllers: [ObservationsController],
  providers: [ObservationsService],
})
export class ObservationsModule {}