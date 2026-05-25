import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { LaserMeasurement } from './laser-measurements.entity';
import { LaserMeasurementsController } from './laser-measurements.controller';

@Module({
  imports: [TypeOrmModule.forFeature([LaserMeasurement])],
  controllers: [LaserMeasurementsController],
})
export class LaserMeasurementsModule {}