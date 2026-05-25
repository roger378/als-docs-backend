import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ReportsService } from './reports.service';
import { ReportsController } from './reports.controller';
import { Room } from '../rooms/room.entity';
import { Wall } from '../walls/walls.entity';
import { Project } from '../projects/project.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Room, Wall, Project])],
  controllers: [ReportsController],
  providers: [ReportsService],
})
export class ReportsModule {}
