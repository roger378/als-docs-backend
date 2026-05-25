import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { ReferenceJob } from './reference-job.entity';
import { ReferenceJobsController } from './reference-jobs.controller';
import { ReferenceJobsService } from './reference-jobs.service';

@Module({
  imports: [TypeOrmModule.forFeature([ReferenceJob])],
  controllers: [ReferenceJobsController],
  providers: [ReferenceJobsService],
  exports: [ReferenceJobsService],
})
export class ReferenceJobsModule {}