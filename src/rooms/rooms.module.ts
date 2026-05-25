import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { RoomsController } from './rooms.controller';
import { RoomsService } from './rooms.service';
import { Room } from './room.entity';
import { Wall } from '../walls/walls.entity';
import { LaserMeasurement } from '../laser-measurements/laser-measurements.entity';
import { Project } from '../projects/project.entity';
import { SketchService } from '../sketch/sketch.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Room,
      Wall,
      LaserMeasurement,
      Project,
    ]),
  ],
  controllers: [RoomsController],
  providers: [RoomsService, SketchService],
  exports: [RoomsService],
})
export class RoomsModule {}