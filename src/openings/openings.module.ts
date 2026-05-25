import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Opening } from './opening.entity';
import { Wall } from '../walls/walls.entity';
import { Room } from '../rooms/room.entity';
import { OpeningsService } from './openings.service';
import { OpeningsController } from './openings.controller';

@Module({
  imports: [TypeOrmModule.forFeature([Opening, Wall, Room])],
  controllers: [OpeningsController],
  providers: [OpeningsService],
  exports: [OpeningsService, TypeOrmModule],
})
export class OpeningsModule {}