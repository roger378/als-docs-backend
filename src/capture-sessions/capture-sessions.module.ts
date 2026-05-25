import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { CaptureSession } from './capture-session.entity';
import { CaptureSessionsController } from './capture-sessions.controller';
import { CaptureSessionsService } from './capture-sessions.service';
import { Project } from '../projects/project.entity';
import { Room } from '../rooms/room.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      CaptureSession,
      Project,
      Room,
    ]),
  ],
  controllers: [CaptureSessionsController],
  providers: [CaptureSessionsService],
  exports: [CaptureSessionsService],
})
export class CaptureSessionsModule {}