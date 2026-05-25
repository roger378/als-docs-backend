import { Controller, Post, Get, Body, Param } from '@nestjs/common';
import { ObservationsService } from './observations.service';

@Controller('observations')
export class ObservationsController {

  constructor(private service: ObservationsService) {}

  @Post()
  create(@Body() body) {
    return this.service.create(body);
  }

  @Get()
  findAll() {
    return this.service.findAll();
  }

  @Get('room/:roomId')
  findByRoom(@Param('roomId') roomId: string) {
    return this.service.findByRoom(Number(roomId));
  }
}