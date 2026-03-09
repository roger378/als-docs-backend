import { Module } from '@nestjs/common';
import { JobsModule } from './jobs/jobs.module';
import { RoomsModule } from './rooms/rooms.module';

@Module({
  imports: [JobsModule, RoomsModule],
  controllers: [],
  providers: [],
})
export class AppModule {}