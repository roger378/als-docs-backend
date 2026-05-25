import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Wall } from './walls.entity';
import { WallsController } from './walls.controller';
import { WallsService } from './walls.service';

@Module({
  imports: [TypeOrmModule.forFeature([Wall])],
  controllers: [WallsController],
  providers: [WallsService],
})
export class WallsModule {}