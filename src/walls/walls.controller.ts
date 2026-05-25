import { Controller, Post, Get, Patch, Body, Param } from '@nestjs/common';
import { WallsService } from './walls.service';

@Controller('walls')
export class WallsController {

  constructor(private service: WallsService) {}

  @Post()
  create(@Body() body) {
    return this.service.create(body);
  }

  @Get('room/:roomId')
  findByRoom(@Param('roomId') roomId: string) {
    return this.service.findByRoom(Number(roomId));
  }

  @Patch(':id')
  patch(@Param('id') id: string, @Body() body: { length?: number; direction?: string }) {
    return this.service.patch(Number(id), body);
  }

}